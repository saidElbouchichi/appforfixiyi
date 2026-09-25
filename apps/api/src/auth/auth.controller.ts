import type { Env } from "@fixiyi/config";
import {
  EmailAttachInputSchema,
  EmailVerifyInputSchema,
  OtpRequestInputSchema,
  OtpVerifyInputSchema,
  RefreshInputSchema,
  UpdateMeInputSchema,
  type EmailAttachInput,
  type EmailVerifyInput,
  type OtpRequestInput,
  type OtpRequestOutput,
  type OtpVerifyInput,
  type RefreshInput,
  type Session,
  type UpdateMeInput,
  type User as UserDto,
} from "@fixiyi/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ENV } from "../infrastructure/env.token.js";

import {
  clearAuthCookies,
  extractRequestContext,
  readRefreshTokenCookie,
  setAuthCookies,
} from "./auth-cookies.util.js";
import type { AuthenticatedUser } from "./auth-request.types.js";
import { OTP_MAX_REQUESTS_PER_IP_PER_HOUR } from "./auth.constants.js";
import { AuthService, type AuthSessionResult, type AuthTokensResult } from "./auth.service.js";
import { CsrfGuard } from "./csrf/csrf.guard.js";
import { CsrfService } from "./csrf/csrf.service.js";
import { AuthGuard } from "./guards/auth.guard.js";
import { CurrentUser } from "./guards/current-user.decorator.js";
import { RateLimit } from "./rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "./rate-limit/rate-limit.guard.js";
import { AUTHENTICATED_READ_LIMIT } from "./rate-limit/read-budget.js";
import { TokenService } from "./token/token.service.js";

/** Account changes of a signed-in user (audit 2026-09-21: were unlimited). */
const ACCOUNT_LIMIT = {
  scope: "account-write",
  limit: 20,
  windowSeconds: 60,
  key: "user",
} as const;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
    private readonly tokens: TokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("otp/request")
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: "otp-request", limit: OTP_MAX_REQUESTS_PER_IP_PER_HOUR, windowSeconds: 3600 })
  requestOtp(
    @Body(new ZodValidationPipe(OtpRequestInputSchema)) body: OtpRequestInput,
  ): Promise<OtpRequestOutput> {
    return this.auth.requestPhoneOtp(body.phone);
  }

  @Post("otp/verify")
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: "otp-verify", limit: 30, windowSeconds: 3600 })
  async verifyOtp(
    @Body(new ZodValidationPipe(OtpVerifyInputSchema)) body: OtpVerifyInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResult> {
    const result = await this.auth.verifyPhoneOtp(body, extractRequestContext(request));
    setAuthCookies(reply, this.env, this.tokens, result, this.csrf.generateToken());
    return result;
  }

  @Post("refresh")
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: "refresh", limit: 60, windowSeconds: 3600 })
  async refresh(
    @Body(new ZodValidationPipe(RefreshInputSchema)) body: RefreshInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthTokensResult> {
    const token = body.refreshToken ?? readRefreshTokenCookie(request);
    if (!token) {
      throw new DomainHttpException(
        HttpStatus.UNAUTHORIZED,
        "REFRESH_TOKEN_MISSING",
        "No refresh token provided.",
      );
    }
    const result = await this.auth.refresh(token, extractRequestContext(request));
    setAuthCookies(reply, this.env, this.tokens, result, this.csrf.generateToken());
    return result;
  }

  @Post("logout")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(ACCOUNT_LIMIT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ success: true }> {
    await this.auth.logout(user.sessionId);
    clearAuthCookies(reply, this.env);
    return { success: true };
  }

  @Post("logout-all")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(ACCOUNT_LIMIT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ success: true }> {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(reply, this.env);
    return { success: true };
  }

  @Get("sessions")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(AuthGuard, RateLimitGuard)
  listSessions(@CurrentUser() user: AuthenticatedUser): Promise<Session[]> {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @Delete("sessions/:id")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(ACCOUNT_LIMIT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") sessionId: string,
  ): Promise<{ success: true }> {
    await this.auth.revokeSession(user.id, sessionId);
    return { success: true };
  }

  @Get("me")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(AuthGuard, RateLimitGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.auth.getMe(user.id);
  }

  @Patch("me")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(ACCOUNT_LIMIT)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateMeInputSchema)) body: UpdateMeInput,
  ): Promise<UserDto> {
    return this.auth.updateMe(user.id, body.dateOfBirth);
  }

  @Post("roles/provider")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(ACCOUNT_LIMIT)
  becomeProvider(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.auth.becomeProvider(user.id);
  }

  @Post("email")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit({ scope: "email-attach", limit: 10, windowSeconds: 3600, key: "user" })
  attachEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(EmailAttachInputSchema)) body: EmailAttachInput,
  ): Promise<OtpRequestOutput> {
    return this.auth.attachEmail(user.id, body.email);
  }

  @Post("email/verify")
  @UseGuards(AuthGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(ACCOUNT_LIMIT)
  verifyEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(EmailVerifyInputSchema)) body: EmailVerifyInput,
  ): Promise<UserDto> {
    return this.auth.verifyEmail(user.id, body.code);
  }
}
