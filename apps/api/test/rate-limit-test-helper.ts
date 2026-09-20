import type { RedisService } from "../src/infrastructure/redis/redis.service.js";

/**
 * Rate-limit counters live in Redis and persist across separate test runs
 * within the same hour, and are shared across every e2e test file hitting
 * the same real Redis instance — call this in each e2e file's `beforeAll`
 * so no file's suite depends on execution order or a previous run's state.
 */
export async function clearRateLimitState(redis: RedisService): Promise<void> {
  const keys = await redis.client.keys("ratelimit:*");
  if (keys.length > 0) {
    await redis.client.del(...keys);
  }
}
