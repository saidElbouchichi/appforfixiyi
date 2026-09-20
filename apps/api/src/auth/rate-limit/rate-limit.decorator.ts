import { SetMetadata } from "@nestjs/common";

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = "rateLimit";

/** Applies an IP-keyed rate limit to a route via {@link RateLimitGuard}. */
export const RateLimit = (options: RateLimitOptions): MethodDecorator => SetMetadata(RATE_LIMIT_KEY, options);
