import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import { ProblemDetailsSchema } from "@fixiyi/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { CATALOG_PUBLIC_READ_LIMIT } from "../src/catalog/catalog.controller.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { COMPANY_PUBLIC_READ_LIMIT } from "../src/companies/company.controller.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";
import { PROVIDER_PUBLIC_READ_LIMIT } from "../src/providers/public/public-provider.controller.js";

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
});
