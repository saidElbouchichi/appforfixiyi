import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";

import { DomainHttpException } from "../../common/exceptions/domain-http.exception.js";

import { RATE_LIMIT_KEY, type RateLimitOptions } from "./rate-limit.decorator.js";
import { RateLimitService } from "./rate-limit.service.js";

function rateLimitKey(options: RateLimitOptions, request: FastifyRequest): string {
  if (options.key === "user") {
    // Fail closed: a user-keyed limit on a route AuthGuard does not protect is
    // a wiring bug, and silently falling back to the IP would hide it.
    if (!request.user) {
      throw new Error(`RateLimit "${options.scope}" is keyed by user but the route is not authenticated.`);
    }
    return `${options.scope}:user:${request.user.id}`;
  }
  return `${options.scope}:ip:${request.ip}`;
}

/** Rate limiting per route (02_SPEC_ENGINEERING.md #152, #634, #640): by IP by default, by user where `key: "user"`. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const result = await this.rateLimit.consume(rateLimitKey(options, request), options.limit, options.windowSeconds);

    if (!result.allowed) {
      const reply = context.switchToHttp().getResponse<FastifyReply>();
      reply.header("Retry-After", String(result.retryAfterSeconds));
      throw new DomainHttpException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests. Try again later.");
    }
    return true;
  }
}
