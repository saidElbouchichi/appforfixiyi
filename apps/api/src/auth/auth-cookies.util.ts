import type { Env } from "@fixiyi/config";
import type { FastifyReply, FastifyRequest } from "fastify";

import { parseCookies, serializeCookie, serializeExpiredCookie } from "../common/http/cookie.util.js";

import { AUTH_COOKIE_ACCESS, AUTH_COOKIE_CSRF, AUTH_COOKIE_REFRESH, AUTH_COOKIE_REFRESH_PATH } from "./auth.constants.js";
import type { AuthTokensResult } from "./auth.service.js";
import type { RequestContext } from "./session/session.service.js";
import type { TokenService } from "./token/token.service.js";

export function extractRequestContext(request: FastifyRequest): RequestContext {
  const userAgent = request.headers["user-agent"] as string | string[] | undefined;
  return { ip: request.ip, userAgent: (Array.isArray(userAgent) ? userAgent[0] : userAgent) ?? null };
}

export function readRefreshTokenCookie(request: FastifyRequest): string | undefined {
  return parseCookies(request.headers.cookie)[AUTH_COOKIE_REFRESH];
}

/** Sets access/refresh/csrf cookies sized exactly to each token's real expiry. */
export function setAuthCookies(reply: FastifyReply, env: Env, tokens: TokenService, result: AuthTokensResult, csrfToken: string): void {
  const secure = env.NODE_ENV === "production";
  const refreshMaxAge = tokens.remainingSeconds(result.refreshToken);

  reply.header(
    "set-cookie",
    serializeCookie(AUTH_COOKIE_ACCESS, result.accessToken, { httpOnly: true, secure, sameSite: "Lax", path: "/", maxAgeSeconds: result.expiresIn }),
  );
  reply.header(
    "set-cookie",
    serializeCookie(AUTH_COOKIE_REFRESH, result.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: AUTH_COOKIE_REFRESH_PATH,
      maxAgeSeconds: refreshMaxAge,
    }),
  );
  reply.header(
    "set-cookie",
    serializeCookie(AUTH_COOKIE_CSRF, csrfToken, { httpOnly: false, secure, sameSite: "Lax", path: "/", maxAgeSeconds: refreshMaxAge }),
  );
}

export function clearAuthCookies(reply: FastifyReply, env: Env): void {
  const secure = env.NODE_ENV === "production";
  reply.header("set-cookie", serializeExpiredCookie(AUTH_COOKIE_ACCESS, { httpOnly: true, secure, sameSite: "Lax", path: "/" }));
  reply.header(
    "set-cookie",
    serializeExpiredCookie(AUTH_COOKIE_REFRESH, { httpOnly: true, secure, sameSite: "Lax", path: AUTH_COOKIE_REFRESH_PATH }),
  );
  reply.header("set-cookie", serializeExpiredCookie(AUTH_COOKIE_CSRF, { httpOnly: false, secure, sameSite: "Lax", path: "/" }));
}
