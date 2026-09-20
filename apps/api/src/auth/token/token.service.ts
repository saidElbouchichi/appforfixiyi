import type { Env } from "@fixiyi/config";
import type { UserRole } from "@fixiyi/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { decode, sign, verify, type SignOptions } from "jsonwebtoken";

import { ENV } from "../../infrastructure/env.token.js";

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  roles: UserRole[];
}

export interface RefreshTokenClaims {
  sub: string;
  sid: string;
  /** Must equal the session's current `tokenVersion` — mismatch means a rotated/stale token was replayed. */
  rtv: number;
}

export interface SignedToken {
  token: string;
  /** Epoch seconds, decoded straight back off the token that was just signed — never computed twice. */
  expiresAtSeconds: number;
}

/**
 * Signs/verifies the access and refresh JWTs (01_SPEC_PRODUCT.md #68-69).
 * Session revocation/rotation state lives in Mongo (`UserSessionEntity`), not
 * in the token — the token is only ever a self-contained, signed claim.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  signAccessToken(claims: AccessTokenClaims): SignedToken {
    return this.sign(claims, this.env.JWT_SECRET, this.env.JWT_ACCESS_TTL);
  }

  signRefreshToken(claims: RefreshTokenClaims): SignedToken {
    return this.sign(claims, this.env.JWT_REFRESH_SECRET, this.env.JWT_REFRESH_TTL);
  }

  /** Throws `jsonwebtoken`'s `TokenExpiredError`/`JsonWebTokenError` on an invalid or expired token. */
  verifyAccessToken(token: string): AccessTokenClaims {
    return this.verify(token, this.env.JWT_SECRET) as AccessTokenClaims;
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    return this.verify(token, this.env.JWT_REFRESH_SECRET) as RefreshTokenClaims;
  }

  /** Seconds remaining until `token` expires — used to size a cookie's `Max-Age` to match the token exactly. */
  remainingSeconds(token: string): number {
    const expiresAtSeconds = this.decodeExpiry(token, "Cannot determine the expiry of a malformed token");
    return expiresAtSeconds - Math.floor(Date.now() / 1000);
  }

  private sign(claims: object, secret: string, ttl: string): SignedToken {
    // `ttl` is a validated-at-boot config string (e.g. "15m"), not the narrow
    // template-literal type `jsonwebtoken` infers for literals — safe to widen here.
    const token = sign(claims, secret, { expiresIn: ttl as NonNullable<SignOptions["expiresIn"]> });
    const expiresAtSeconds = this.decodeExpiry(token, "Failed to decode the expiry of a token that was just signed");
    return { token, expiresAtSeconds };
  }

  private verify(token: string, secret: string): unknown {
    return verify(token, secret);
  }

  private decodeExpiry(token: string, errorMessage: string): number {
    const decoded = decode(token);
    if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
      throw new Error(errorMessage);
    }
    return decoded.exp;
  }
}
