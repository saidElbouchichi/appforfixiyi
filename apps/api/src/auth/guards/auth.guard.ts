import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { parseCookies } from "../../common/http/cookie.util.js";
import { AUTH_COOKIE_ACCESS } from "../auth.constants.js";
import { SessionService } from "../session/session.service.js";
import { TokenService, type AccessTokenClaims } from "../token/token.service.js";

/**
 * Requires a valid, non-revoked session (01_SPEC_PRODUCT.md #66 — RBAC
 * starts with "is there a session at all"). Accepts the access token from
 * either `Authorization: Bearer` (any client, including a future mobile
 * app) or the `fixiyi_at` cookie (web) — checked in that order.
 *
 * Also re-checks the session is still ACTIVE in Mongo on every call: a
 * purely stateless JWT check would let a revoked session (remote logout,
 * refresh-reuse detection) keep working until the short-lived access token's
 * natural expiry, which 01_SPEC_PRODUCT.md #70's "remote logout" requirement
 * doesn't allow.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { token, source } = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    let claims: AccessTokenClaims;
    try {
      claims = this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    const session = await this.sessions.findActiveById(claims.sid);
    if (!session) {
      throw new UnauthorizedException("Session has been revoked or expired");
    }

    request.user = { id: claims.sub, sessionId: claims.sid, roles: claims.roles };
    request.authTokenSource = source;
    return true;
  }

  private extractToken(request: FastifyRequest): { token: string | undefined; source: "header" | "cookie" } {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return { token: authHeader.slice("Bearer ".length), source: "header" };
    }

    const cookies = parseCookies(request.headers.cookie);
    return { token: cookies[AUTH_COOKIE_ACCESS], source: "cookie" };
  }
}
