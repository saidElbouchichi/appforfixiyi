import { describe, expect, it, vi } from "vitest";

import type { RedisService } from "../../infrastructure/redis/redis.service.js";

import { RateLimitService } from "./rate-limit.service.js";

function createRedisServiceMock(): RedisService {
  const store = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    client: {
      incr: vi.fn((key: string) => {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return Promise.resolve(next);
      }),
      expire: vi.fn((key: string, seconds: number) => {
        ttls.set(key, seconds);
        return Promise.resolve(1);
      }),
      ttl: vi.fn((key: string) => Promise.resolve(ttls.get(key) ?? -1)),
    },
  } as unknown as RedisService;
}

describe("RateLimitService", () => {
  it("allows requests under the limit and reports remaining count", async () => {
    const service = new RateLimitService(createRedisServiceMock());
    const first = await service.consume("otp-request:ip:1.2.3.4", 3, 60);
    expect(first).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    const second = await service.consume("otp-request:ip:1.2.3.4", 3, 60);
    expect(second.remaining).toBe(1);
  });

  it("blocks once the limit is exceeded and reports a retryAfterSeconds", async () => {
    const service = new RateLimitService(createRedisServiceMock());
    const key = "otp-request:ip:5.6.7.8";
    await service.consume(key, 1, 60);
    const result = await service.consume(key, 1, 60);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent across scopes", async () => {
    const service = new RateLimitService(createRedisServiceMock());
    await service.consume("scope-a:1", 1, 60);
    const result = await service.consume("scope-b:1", 1, 60);
    expect(result.allowed).toBe(true);
  });
});
