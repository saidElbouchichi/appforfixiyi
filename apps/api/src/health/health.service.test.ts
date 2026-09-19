import type { Connection } from "mongoose";
import { describe, expect, it, vi } from "vitest";

import type { RedisService } from "../infrastructure/redis/redis.service.js";

import { HealthService } from "./health.service.js";

function createHealthService(options: {
  mongoOk?: boolean;
  redisOk?: boolean;
}): HealthService {
  const { mongoOk = true, redisOk = true } = options;

  const connection = {
    db: {
      admin: () => ({
        command: mongoOk
          ? vi.fn().mockResolvedValue({ ok: 1 })
          : vi.fn().mockRejectedValue(new Error("mongo unreachable")),
      }),
    },
  } as unknown as Connection;

  const redis = {
    ping: redisOk ? vi.fn().mockResolvedValue(true) : vi.fn().mockRejectedValue(new Error("redis unreachable")),
  } as unknown as RedisService;

  return new HealthService(connection, redis);
}

describe("HealthService", () => {
  it("reports ok when both dependencies are reachable", async () => {
    const service = createHealthService({ mongoOk: true, redisOk: true });
    const result = await service.check();
    expect(result).toEqual({
      status: "ok",
      checks: { mongo: { status: "up" }, redis: { status: "up" } },
    });
  });

  it("reports degraded and surfaces the failure message when MongoDB is unreachable", async () => {
    const service = createHealthService({ mongoOk: false, redisOk: true });
    const result = await service.check();
    expect(result.status).toBe("degraded");
    expect(result.checks.mongo.status).toBe("down");
    expect(result.checks.mongo.message).toBe("mongo unreachable");
    expect(result.checks.redis.status).toBe("up");
  });

  it("reports degraded when Redis is unreachable", async () => {
    const service = createHealthService({ mongoOk: true, redisOk: false });
    const result = await service.check();
    expect(result.status).toBe("degraded");
    expect(result.checks.redis.status).toBe("down");
    expect(result.checks.redis.message).toBe("redis unreachable");
  });

  it("reports degraded when both dependencies are unreachable", async () => {
    const service = createHealthService({ mongoOk: false, redisOk: false });
    const result = await service.check();
    expect(result.status).toBe("degraded");
  });
});
