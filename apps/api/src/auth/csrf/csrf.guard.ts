import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { DomainHttpException } from "../../common/exceptions/domain-http.exception.js";
import { parseCookies } from "../../common/http/cookie.util.js";
import { AUTH_COOKIE_CSRF } from "../auth.constants.js";

import { CsrfService } from "./csrf.service.js";

/**
 * Enforced only when the caller authenticated via cookie — a Bearer-header
 * client (e.g. a future mobile app, Phase 13) is inherently immune to CSRF,
 * since browsers never auto-attach a custom header cross-site.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.authTokenSource !== "cookie") {
      return true;
    }

    const cookies = parseCookies(request.headers.cookie);
    const headerValue = request.headers["x-csrf-token"];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!this.csrf.matches(cookies[AUTH_COOKIE_CSRF], headerToken)) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, "CSRF_TOKEN_MISMATCH", "Missing or invalid CSRF token.");
    }
    return true;
  }
}
