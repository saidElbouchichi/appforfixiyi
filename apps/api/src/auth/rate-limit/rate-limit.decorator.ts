import { SetMetadata } from "@nestjs/common";

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowSeconds: number;
  /**
   * What the quota is counted against. `ip` (default) for unauthenticated
   * routes such as OTP. `user` for authenticated ones: behind a NAT or a
   * carrier-grade NAT many users share one IP, and an IP quota would let one
   * of them exhaust everyone's (finding B4). `user` requires `AuthGuard` to
   * run first, so `request.user` is set.
   */
  key?: "ip" | "user";
}

export const RATE_LIMIT_KEY = "rateLimit";

/** Applies a rate limit to a route via {@link RateLimitGuard} — IP-keyed unless `key: "user"`. */
export const RateLimit = (options: RateLimitOptions): MethodDecorator => SetMetadata(RATE_LIMIT_KEY, options);
