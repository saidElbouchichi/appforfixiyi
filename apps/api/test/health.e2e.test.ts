import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";

/**
 * Real integration test: boots the full Nest app and hits it against the
 * actual MongoDB/Redis dev containers (04_ENVIRONMENT.md), not mocks.
 */
describe("Health (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(loadEnv())] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("reports ok with real MongoDB and Redis connectivity", async () => {
    const server = app.getHttpAdapter().getInstance().server;
    const response = await request(server).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      checks: {
        mongo: { status: "up" },
        redis: { status: "up" },
      },
    });
  });

  it("is not prefixed by /api/v1", async () => {
    const server = app.getHttpAdapter().getInstance().server;
    const response = await request(server).get("/api/v1/health");
    expect(response.status).toBe(404);
  });
});
