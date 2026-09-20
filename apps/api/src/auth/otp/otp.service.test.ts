import type { Env } from "@fixiyi/config";
import { beforeEach, describe, expect, it } from "vitest";

import type { RedisService } from "../../infrastructure/redis/redis.service.js";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";

import { OtpService } from "./otp.service.js";

/** Minimal in-memory stand-in for the subset of ioredis used by OtpService/RateLimitService — no TTL expiry simulation needed for these assertions. */
function createRedisServiceMock(): RedisService {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    client: {
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      set: (key: string, value: string, _mode: "EX", ttlSeconds: number) => {
        store.set(key, value);
        ttls.set(key, ttlSeconds);
        return Promise.resolve("OK");
      },
      del: (key: string) => {
        store.delete(key);
        ttls.delete(key);
        return Promise.resolve(1);
      },
      ttl: (key: string) => Promise.resolve(store.has(key) ? ttls.get(key) ?? -1 : -2),
      incr: (key: string) => {
        const next = (Number(store.get(key)) || 0) + 1;
        store.set(key, String(next));
        return Promise.resolve(next);
      },
      expire: (key: string, seconds: number) => {
        ttls.set(key, seconds);
        return Promise.resolve(1);
      },
    },
  } as unknown as RedisService;
}

const env = { OTP_SECRET: "test-otp-secret-long-enough" } as unknown as Env;
const options = { codeLength: 6, ttlSeconds: 300, cooldownSeconds: 60, maxPerHour: 100 };

describe("OtpService", () => {
  let service: OtpService;

  beforeEach(() => {
    const redis = createRedisServiceMock();
    service = new OtpService(redis, new RateLimitService(redis), env);
  });

  it("issues a code and enforces the cooldown on a second request", async () => {
    const first = await service.issueCode("phone", "+212600000000", options);
    expect(first.status).toBe("issued");

    const second = await service.issueCode("phone", "+212600000000", options);
    expect(second.status).toBe("cooldown");
  });

  it("verifies the correct code once, then reports NOT_FOUND on reuse (one-time use)", async () => {
    const issued = await service.issueCode("phone", "+212600000000", options);
    if (issued.status !== "issued") throw new Error("expected issued");

    const first = await service.verifyCode("phone", "+212600000000", issued.code, 5);
    expect(first).toEqual({ status: "valid" });

    const second = await service.verifyCode("phone", "+212600000000", issued.code, 5);
    expect(second).toEqual({ status: "invalid", reason: "NOT_FOUND" });
  });

  it("reports MISMATCH for a wrong code and MAX_ATTEMPTS once the limit is reached", async () => {
    const issued = await service.issueCode("phone", "+212600000000", options);
    if (issued.status !== "issued") throw new Error("expected issued");

    for (let i = 0; i < 2; i++) {
      const result = await service.verifyCode("phone", "+212600000000", "000000", 3);
      expect(result).toEqual({ status: "invalid", reason: "MISMATCH" });
    }
    const final = await service.verifyCode("phone", "+212600000000", "000000", 3);
    expect(final).toEqual({ status: "invalid", reason: "MAX_ATTEMPTS" });

    // Even the correct code is now rejected — the record was deleted on lockout.
    const correctAfterLockout = await service.verifyCode("phone", "+212600000000", issued.code, 3);
    expect(correctAfterLockout).toEqual({ status: "invalid", reason: "NOT_FOUND" });
  });

  it("keeps phone and email namespaces independent for the same subject string", async () => {
    await service.issueCode("phone", "shared-subject", options);
    const emailResult = await service.issueCode("email", "shared-subject", options);
    expect(emailResult.status).toBe("issued");
  });

  it("enforces the hourly cap per subject, independently of the cooldown", async () => {
    const redis = createRedisServiceMock();
    const limitedService = new OtpService(redis, new RateLimitService(redis), env);
    const limitedOptions = { ...options, maxPerHour: 2 };
    const subject = "+212611111111";

    const first = await limitedService.issueCode("phone", subject, limitedOptions);
    expect(first.status).toBe("issued");
    await redis.client.del(`otp:cooldown:phone:${subject}`); // simulate the cooldown having elapsed

    const second = await limitedService.issueCode("phone", subject, limitedOptions);
    expect(second.status).toBe("issued");
    await redis.client.del(`otp:cooldown:phone:${subject}`);

    const third = await limitedService.issueCode("phone", subject, limitedOptions);
    expect(third.status).toBe("rate_limited");
  });
});
