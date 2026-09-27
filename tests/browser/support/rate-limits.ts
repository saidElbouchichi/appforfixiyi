import Redis from "ioredis";

/**
 * Clears the API's rate-limit counters on the DEV stack.
 *
 * Every browser test signs in from the same loopback address, and the auth
 * routes are budgeted per IP per hour (`otp-verify` 30, `otp-request` 60,
 * `refresh` 60). A whole run is one "user" to the API: once it grew past 30
 * sign-ins (design phase 12: 32 measured in Redis), the last specs to sign in
 * were refused with "Too many requests" whatever their order. `apps/api`'s e2e
 * helper already clears `ratelimit:*` per test (Decision 32); the browser
 * suite now does the same. The limits themselves are untouched, and still
 * enforced within each test.
 */
export async function clearRateLimits(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const keys = await redis.keys("ratelimit:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } finally {
    redis.disconnect();
  }
}
