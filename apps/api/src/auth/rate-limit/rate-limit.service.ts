import { Injectable } from "@nestjs/common";

import { RedisService } from "../../infrastructure/redis/redis.service.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter backed by Redis (02_SPEC_ENGINEERING.md #152 — rate
 * limit by IP/user/phone/device/operation). `INCR` then `EXPIRE` only on the
 * first hit of the window: a crash between the two calls just means that one
 * window's key never expires-on-schedule and gets overwritten by the next
 * `INCR` cycle — acceptable for abuse-prevention, not a billing meter.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.client.incr(redisKey);
    if (count === 1) {
      await this.redis.client.expire(redisKey, windowSeconds);
    }

    if (count > limit) {
      const ttl = await this.redis.client.ttl(redisKey);
      return { allowed: false, remaining: 0, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
    }
    return { allowed: true, remaining: limit - count, retryAfterSeconds: 0 };
  }
}
