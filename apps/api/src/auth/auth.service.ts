import type { Env } from "@fixiyi/config";
import type { DeviceInput, OtpRequestOutput, OtpVerifyInput, Session, User as UserDto } from "@fixiyi/contracts";
import { calculateAgeYears, generateId } from "@fixiyi/shared-utils";
import { HttpStatus, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { Model } from "mongoose";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { ENV } from "../infrastructure/env.token.js";

import {
  EMAIL_CODE_LENGTH,
  EMAIL_MAX_REQUESTS_PER_HOUR,
  EMAIL_MAX_VERIFY_ATTEMPTS,
  EMAIL_REQUEST_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_TTL_SECONDS,
  OTP_CODE_LENGTH,
  OTP_MAX_REQUESTS_PER_PHONE_PER_HOUR,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_REQUEST_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
} from "./auth.constants.js";
import { EMAIL_PROVIDER, type EmailProvider } from "./email/email-provider.interface.js";
import { OtpService } from "./otp/otp.service.js";
import { UserEntity, type UserDocument } from "./schemas/user.schema.js";
import { type RequestContext, SessionService } from "./session/session.service.js";
import { SMS_PROVIDER, type SmsProvider } from "./sms/sms-provider.interface.js";
import { TokenService, type RefreshTokenClaims } from "./token/token.service.js";

export interface AuthTokensResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSessionResult extends AuthTokensResult {
  user: UserDto;
}

/**
 * Orchestrates the auth module (01_SPEC_PRODUCT.md #66-72): OTP request/verify,
 * refresh rotation, logout, device/session management, self-service role
 * grant (with the age rule), and email attach/verify. Delegates pure logic
 * to `OtpService`/`TokenService`/`SessionService` and only itself knows
 * about `User` persistence.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserEntity>,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // --- Phone OTP -----------------------------------------------------------

  async requestPhoneOtp(phone: string): Promise<OtpRequestOutput> {
    if (!isValidPhoneNumber(phone)) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "INVALID_PHONE", "This phone number is not valid.");
    }

    const result = await this.otp.issueCode("phone", phone, {
      codeLength: OTP_CODE_LENGTH,
      ttlSeconds: OTP_TTL_SECONDS,
      cooldownSeconds: OTP_REQUEST_COOLDOWN_SECONDS,
      maxPerHour: OTP_MAX_REQUESTS_PER_PHONE_PER_HOUR,
    });
    if (result.status !== "issued") {
      return { retryAfterSeconds: result.retryAfterSeconds };
    }

    await this.sms.send(phone, `Your Fixiyi verification code is ${result.code}`);
    return {
      retryAfterSeconds: result.retryAfterSeconds,
      ...(this.shouldExposeDevCode(this.env.SMS_PROVIDER) ? { devCode: result.code } : {}),
    };
  }

  async verifyPhoneOtp(input: OtpVerifyInput, context: RequestContext): Promise<AuthSessionResult> {
    const verification = await this.otp.verifyCode("phone", input.phone, input.code, OTP_MAX_VERIFY_ATTEMPTS);
    if (verification.status !== "valid") {
      throw new DomainHttpException(
        HttpStatus.UNAUTHORIZED,
        `OTP_${verification.reason}`,
        "This verification code is invalid or has expired.",
      );
    }

    const now = new Date();
    let user = await this.userModel.findOne({ phone: input.phone });
    if (!user) {
      user = await this.userModel.create({
        _id: generateId(),
        phone: input.phone,
        phoneVerifiedAt: now,
        roles: ["CLIENT"],
        status: "ACTIVE",
      });
    } else if (!user.phoneVerifiedAt) {
      user.phoneVerifiedAt = now;
      await user.save();
    }

    return this.issueNewSession(user, input.device, context);
  }

  // --- Sessions --------------------------------------------------------------

  async refresh(refreshToken: string, context: RequestContext): Promise<AuthTokensResult> {
    let claims: RefreshTokenClaims;
    try {
      claims = this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "The refresh token is invalid or has expired.");
    }

    const rotation = await this.sessions.rotate(claims.sid, claims.rtv, context);
    if (rotation.status === "reuse_detected") {
      this.logger.warn(`[security] refresh token reuse detected for session ${claims.sid} (user ${claims.sub}) — session revoked`);
    }
    if (rotation.status !== "success") {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "The refresh token is invalid or has expired.");
    }

    const user = await this.userModel.findById(claims.sub);
    if (!user) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "The refresh token is invalid or has expired.");
    }

    return this.signTokens(user, rotation.session._id, rotation.session.tokenVersion);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, "LOGOUT");
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId, "LOGOUT_ALL");
  }

  async listSessions(userId: string, currentSessionId: string): Promise<Session[]> {
    const activeSessions = await this.sessions.listActiveForUser(userId);
    const devices = await this.sessions.getDevicesByIds(activeSessions.map((session) => session.deviceId));

    return activeSessions.map((session) => ({
      id: session._id,
      deviceName: devices.get(session.deviceId)?.name ?? null,
      ip: session.ip,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session._id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findActiveById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException("Session not found");
    }
    await this.sessions.revoke(sessionId, "REVOKED_BY_USER");
  }

  // --- Profile / RBAC self-service --------------------------------------------

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.requireUser(userId);
    return toUserDto(user);
  }

  async updateMe(userId: string, dateOfBirth: string): Promise<UserDto> {
    const user = await this.requireUser(userId);
    user.dateOfBirth = new Date(dateOfBirth);
    await user.save();
    return toUserDto(user);
  }

  /** Self-service RBAC role grant (01_SPEC_PRODUCT.md #66) — the only real role-granting action in Phase 2, so it's also where the age rule (#71) is enforced. */
  async becomeProvider(userId: string): Promise<UserDto> {
    const user = await this.requireUser(userId);

    if (user.roles.includes("PROVIDER")) {
      return toUserDto(user);
    }
    if (!user.phoneVerifiedAt) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, "PHONE_NOT_VERIFIED", "Your phone number must be verified first.");
    }
    if (!user.dateOfBirth) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "DATE_OF_BIRTH_REQUIRED",
        "Set your date of birth (PATCH /auth/me) before becoming a provider.",
      );
    }
    const age = calculateAgeYears(user.dateOfBirth.toISOString());
    if (age < this.env.MIN_PROVIDER_AGE) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        "MIN_AGE_NOT_MET",
        `You must be at least ${this.env.MIN_PROVIDER_AGE.toString()} years old to become a provider.`,
      );
    }

    user.roles = [...user.roles, "PROVIDER"];
    await user.save();
    return toUserDto(user);
  }

  // --- Email -------------------------------------------------------------------

  async attachEmail(userId: string, email: string): Promise<OtpRequestOutput> {
    const existing = await this.userModel.findOne({ email, emailVerifiedAt: { $ne: null } });
    if (existing && existing._id !== userId) {
      throw new DomainHttpException(HttpStatus.CONFLICT, "EMAIL_ALREADY_TAKEN", "This email is already associated with another account.");
    }

    const user = await this.requireUser(userId);
    user.pendingEmail = email;
    await user.save();

    const result = await this.otp.issueCode("email", email, {
      codeLength: EMAIL_CODE_LENGTH,
      ttlSeconds: EMAIL_VERIFICATION_TTL_SECONDS,
      cooldownSeconds: EMAIL_REQUEST_COOLDOWN_SECONDS,
      maxPerHour: EMAIL_MAX_REQUESTS_PER_HOUR,
    });
    if (result.status !== "issued") {
      return { retryAfterSeconds: result.retryAfterSeconds };
    }

    await this.emailProvider.send(email, "Verify your Fixiyi email", `Your verification code is ${result.code}`);
    return {
      retryAfterSeconds: result.retryAfterSeconds,
      ...(this.shouldExposeDevCode(this.env.EMAIL_PROVIDER) ? { devCode: result.code } : {}),
    };
  }

  async verifyEmail(userId: string, code: string): Promise<UserDto> {
    const user = await this.requireUser(userId);
    if (!user.pendingEmail) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "NO_PENDING_EMAIL", "No email verification is pending — call POST /auth/email first.");
    }

    const verification = await this.otp.verifyCode("email", user.pendingEmail, code, EMAIL_MAX_VERIFY_ATTEMPTS);
    if (verification.status !== "valid") {
      throw new DomainHttpException(
        HttpStatus.UNAUTHORIZED,
        `EMAIL_${verification.reason}`,
        "This verification code is invalid or has expired.",
      );
    }

    user.email = user.pendingEmail;
    user.emailVerifiedAt = new Date();
    user.pendingEmail = null;
    await user.save();
    return toUserDto(user);
  }

  // --- Internal helpers ----------------------------------------------------

  private async issueNewSession(user: UserDocument, device: DeviceInput | undefined, context: RequestContext): Promise<AuthSessionResult> {
    const sessionId = generateId();
    const refresh = this.tokens.signRefreshToken({ sub: user._id, sid: sessionId, rtv: 0 });
    await this.sessions.createSession(sessionId, user._id, device, context, new Date(refresh.expiresAtSeconds * 1000));

    const access = this.tokens.signAccessToken({ sub: user._id, sid: sessionId, roles: user.roles });
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresAtSeconds - nowSeconds(),
      user: toUserDto(user),
    };
  }

  private signTokens(user: UserDocument, sessionId: string, tokenVersion: number): AuthTokensResult {
    const refresh = this.tokens.signRefreshToken({ sub: user._id, sid: sessionId, rtv: tokenVersion });
    const access = this.tokens.signAccessToken({ sub: user._id, sid: sessionId, roles: user.roles });
    return { accessToken: access.token, refreshToken: refresh.token, expiresIn: access.expiresAtSeconds - nowSeconds() };
  }

  private async requireUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private shouldExposeDevCode(providerName: string): boolean {
    return this.env.NODE_ENV !== "production" && (providerName === "dev" || providerName === "fake");
  }
}

function toUserDto(user: UserDocument): UserDto {
  return {
    id: user._id,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt ? user.phoneVerifiedAt.toISOString() : null,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
