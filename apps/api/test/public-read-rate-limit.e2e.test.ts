import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import { ProblemDetailsSchema } from "@fixiyi/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { AUTHENTICATED_READ_LIMIT } from "../src/auth/rate-limit/read-budget.js";
import { CATALOG_PUBLIC_READ_LIMIT } from "../src/catalog/catalog.controller.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { COMPANY_PUBLIC_READ_LIMIT } from "../src/companies/company.controller.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";
import { PROVIDER_PUBLIC_READ_LIMIT } from "../src/providers/public/public-provider.controller.js";

import { login } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

/**
 * Decision 72 — the six reads that answer without an account are the only
 * ones an anonymous client can hammer. These check the budget is real, that
 * it is keyed by IP (no account to key it by), and that `/health` is
 * deliberately left out.
 *
 * The budgets are large on purpose: behind a carrier-grade NAT many people
 * share one address, so an IP quota tight enough to stop a determined
 * scraper would also lock out a neighbourhood.
 */
describe("Public read rate limits (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;

  const runId = Date.now().toString().slice(-6);
  let counter = 0;
  function uniquePhone(): string {
    counter += 1;
    return `+2126${runId}${counter.toString().padStart(2, "0")}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(loadEnv())] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    server = app.getHttpAdapter().getInstance().server;
    redis = app.get(RedisService);
    await clearRateLimitState(redis);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  /** Spends a whole budget plus one, and returns the last response. */
  async function exhaust(path: string, limit: number): Promise<request.Response> {
    let last = await request(server).get(path);
    for (let sent = 1; sent <= limit; sent += 1) {
      last = await request(server).get(path);
    }
    return last;
  }

  it("answers a provider profile until the budget runs out, then 429s with Retry-After", async () => {
    await clearRateLimitState(redis);
    const unknownId = "018f5b0a-6e2a-7c3d-9b1a-1234567890ff";

    const first = await request(server).get(`/api/v1/providers/${unknownId}`);
    // 404 — the point is the budget, not the profile; a missing one still spends a request.
    expect(first.status).toBe(404);

    const last = await exhaust(`/api/v1/providers/${unknownId}`, PROVIDER_PUBLIC_READ_LIMIT.limit);
    expect(last.status).toBe(429);
    expect(ProblemDetailsSchema.parse(last.body).code).toBe("RATE_LIMITED");
    expect(last.headers["retry-after"]).toBeDefined();
  }, 60_000);

  it("gives company profiles their own budget, spent independently", async () => {
    await clearRateLimitState(redis);
    const unknownId = "018f5b0a-6e2a-7c3d-9b1a-1234567890fe";

    const last = await exhaust(`/api/v1/companies/${unknownId}`, COMPANY_PUBLIC_READ_LIMIT.limit);
    expect(last.status).toBe(429);

    // Spending the company budget must not have spent the provider one.
    const provider = await request(server).get("/api/v1/providers/018f5b0a-6e2a-7c3d-9b1a-1234567890ff");
    expect(provider.status).toBe(404);
  }, 60_000);

  it("gives the catalogue a wider budget than personal data — it is reference, and every screen reads it", () => {
    expect(CATALOG_PUBLIC_READ_LIMIT.limit).toBeGreaterThan(PROVIDER_PUBLIC_READ_LIMIT.limit);
    expect(CATALOG_PUBLIC_READ_LIMIT.limit).toBeGreaterThan(COMPANY_PUBLIC_READ_LIMIT.limit);
  });

  it("keys every public budget by IP — there is no account to key it by", () => {
    for (const budget of [PROVIDER_PUBLIC_READ_LIMIT, COMPANY_PUBLIC_READ_LIMIT, CATALOG_PUBLIC_READ_LIMIT]) {
      expect(budget.key).toBe("ip");
    }
  });

  /** A probe that gets rate-limited reports an outage that is not happening. */
  it("leaves /health unlimited", async () => {
    await clearRateLimitState(redis);
    for (let sent = 0; sent < 40; sent += 1) {
      const response = await request(server).get("/health");
      expect(response.status).toBe(200);
    }
  }, 30_000);

  /**
   * Decision 77. Exhausting 600 requests would make this suite slow for no
   * extra proof, so it checks the two things that actually matter: the guard
   * runs on an authenticated read, and the counter is keyed by the USER. The
   * key is the whole point — an IP-keyed budget behind a carrier-grade NAT
   * would let one subscriber spend a neighbourhood's quota.
   */
  describe("authenticated reads (Decision 77)", () => {
    it("counts a read against the reader, not their address", async () => {
      await clearRateLimitState(redis);
      const session = await login(server, redis, uniquePhone());

      const first = await request(server).get("/api/v1/requests/mine").set("Authorization", `Bearer ${session.accessToken}`);
      expect(first.status).toBe(200);

      const key = `ratelimit:authenticated-read:user:${session.user.id}`;
      expect(await redis.client.get(key)).toBe("1");

      await request(server).get("/api/v1/requests/mine").set("Authorization", `Bearer ${session.accessToken}`);
      expect(await redis.client.get(key)).toBe("2");
    }, 30_000);

    it("gives each user their own budget", async () => {
      await clearRateLimitState(redis);
      const mine = await login(server, redis, uniquePhone());
      const theirs = await login(server, redis, uniquePhone());

      await request(server).get("/api/v1/requests/mine").set("Authorization", `Bearer ${mine.accessToken}`);
      await request(server).get("/api/v1/requests/mine").set("Authorization", `Bearer ${theirs.accessToken}`);

      expect(await redis.client.get(`ratelimit:authenticated-read:user:${mine.user.id}`)).toBe("1");
      expect(await redis.client.get(`ratelimit:authenticated-read:user:${theirs.user.id}`)).toBe("1");
    }, 30_000);

    it("leaves the budget generous enough for a screen that fires several reads", () => {
      expect(AUTHENTICATED_READ_LIMIT.limit).toBeGreaterThanOrEqual(600);
      expect(AUTHENTICATED_READ_LIMIT.key).toBe("user");
    });
  });
});
