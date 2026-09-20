import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";

import { DomainHttpException } from "../../common/exceptions/domain-http.exception.js";

import { RATE_LIMIT_KEY, type RateLimitOptions } from "./rate-limit.decorator.js";
import { RateLimitService } from "./rate-limit.service.js";

/** IP-keyed complement to the phone/email-keyed limits enforced inside OtpService (02_SPEC_ENGINEERING.md #152). */
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
    const result = await this.rateLimit.consume(`${options.scope}:ip:${request.ip}`, options.limit, options.windowSeconds);

    if (!result.allowed) {
      const reply = context.switchToHttp().getResponse<FastifyReply>();
      reply.header("Retry-After", String(result.retryAfterSeconds));
      throw new DomainHttpException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests. Try again later.");
    }
    return true;
  }
}
