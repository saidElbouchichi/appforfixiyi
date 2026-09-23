import Redis from "ioredis";

/**
 * Clears the rate-limit counters of the DEV stack before a run.
 *
 * Why this exists: `otp-request` (60/h), `otp-verify` (30/h) and `refresh`
 * (60/h) are counted per IP, and every browser test signs in from the same
 * loopback address. The counters live in Redis for a full hour, so they
 * accumulate across runs — re-running the suite twice within the hour made
 * unrelated specs fail with "Too many requests" (seen for real during design
 * phase 6).
 *
 * Design phase 7 widened this from `ratelimit:otp-*` to every scope: the
 * suite grew past 60 sign-ins an hour and started tripping `refresh` instead,
 * which the narrower pattern left behind (a 401 out of `setUpProvider`, which
 * reads nothing like a rate limit). `apps/api`'s e2e helper already clears
 * `ratelimit:*` wholesale (`rate-limit-test-helper.ts`, Decision 32); the
 * limits themselves are untouched and still enforced inside each test.
 */
async function globalSetup(): Promise<void> {
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

export default globalSetup;
