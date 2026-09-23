import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import { ProblemDetailsSchema, ProviderProfileSchema, PublicProviderProfileSchema, type CreateProviderProfileInput } from "@fixiyi/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { login } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

/**
 * Real integration test against MongoDB/Redis Docker (04_ENVIRONMENT.md).
 * `POST /providers/me` is `@Roles("PROVIDER")` — the role granted by Phase
 * 2's `POST /auth/roles/provider`, so becoming a provider end-to-end is
 * exercised here too (age rule already covered by auth.e2e.test.ts).
 */
describe("Providers (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;

  const runId = Date.now().toString().slice(-6);
  let counter = 0;
  function uniquePhone(): string {
    counter += 1;
    return `+2128${runId}${counter.toString().padStart(2, "0")}`;
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

  function bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
  }

  async function loginAsClient(): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const session = await login(server, redis, uniquePhone());
    return { accessToken: session.accessToken, refreshToken: session.refreshToken, userId: session.user.id };
  }

  /** Logs in, sets an adult dateOfBirth, grants PROVIDER, then refreshes — a real access token must be re-minted to carry the new role. */
  async function loginAsProvider(): Promise<string> {
    const session = await loginAsClient();
    const twentyYearsAgo = new Date();
    twentyYearsAgo.setUTCFullYear(twentyYearsAgo.getUTCFullYear() - 20);
    await request(server)
      .patch("/api/v1/auth/me")
      .set(...bearer(session.accessToken))
      .send({ dateOfBirth: twentyYearsAgo.toISOString() });
    const grant = await request(server)
      .post("/api/v1/auth/roles/provider")
      .set(...bearer(session.accessToken));
    expect(grant.status).toBe(201);

    const refreshed = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    return z.object({ accessToken: z.string() }).parse(refreshed.body).accessToken;
  }

  const validProfile: CreateProviderProfileInput = { type: "BRICOLEUR", displayName: "Karim E." };

  it("rejects profile creation for a plain CLIENT (no PROVIDER role)", async () => {
    const client = await loginAsClient();
    const response = await request(server)
      .post("/api/v1/providers/me")
      .set(...bearer(client.accessToken))
      .send(validProfile);
    expect(response.status).toBe(403);
  });

  it("returns 404 for GET /providers/me before a profile exists", async () => {
    const token = await loginAsProvider();
    const response = await request(server).get("/api/v1/providers/me").set(...bearer(token));
    expect(response.status).toBe(404);
  });

  it("creates a profile, rejects a second create, then reads it back by id", async () => {
    const token = await loginAsProvider();

    const created = await request(server)
      .post("/api/v1/providers/me")
      .set(...bearer(token))
      .send(validProfile);
    expect(created.status).toBe(201);
    const profile = ProviderProfileSchema.parse(created.body);
    expect(profile).toMatchObject({ type: "BRICOLEUR", displayName: "Karim E.", skillIds: [], serviceAreas: [] });

    const duplicate = await request(server)
      .post("/api/v1/providers/me")
      .set(...bearer(token))
      .send(validProfile);
    expect(duplicate.status).toBe(409);
    expect(ProblemDetailsSchema.parse(duplicate.body).code).toBe("PROVIDER_PROFILE_ALREADY_EXISTS");

    // Public view since Decision 70 — `ProviderProfileSchema` no longer describes this response.
    const byId = await request(server).get(`/api/v1/providers/${profile.id}`);
    expect(byId.status).toBe(200);
    expect(PublicProviderProfileSchema.parse(byId.body).id).toBe(profile.id);
  });

  it("rejects skillIds/serviceIds that don't reference real catalog nodes", async () => {
    const token = await loginAsProvider();
    await request(server).post("/api/v1/providers/me").set(...bearer(token)).send(validProfile);

    const response = await request(server)
      .patch("/api/v1/providers/me")
      .set(...bearer(token))
      .send({ skillIds: ["018f5b0a-6e2a-7c3d-9b1a-1234567890ff"] });
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(response.body).code).toBe("PROVIDER_SKILL_INVALID");
  });

  it("accepts real skill/service ids, availability and a geospatial service area", async () => {
    const token = await loginAsProvider();
    await request(server).post("/api/v1/providers/me").set(...bearer(token)).send(validProfile);

    const skills = await request(server).get("/api/v1/catalog/skills");
    const firstSkillId = z.array(z.object({ id: z.string() })).parse(skills.body)[0]?.id;
    expect(firstSkillId).toBeDefined();

    const response = await request(server)
      .patch("/api/v1/providers/me")
      .set(...bearer(token))
      .send({
        skillIds: [firstSkillId],
        availability: [{ dayOfWeek: 1, startMinute: 480, endMinute: 1020 }],
        serviceAreas: [{ center: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: 20 }],
      });
    expect(response.status).toBe(200);
    const profile = ProviderProfileSchema.parse(response.body);
    expect(profile.skillIds).toEqual([firstSkillId]);
    expect(profile.availability).toHaveLength(1);
    expect(profile.serviceAreas[0]?.radiusKm).toBe(20);
  });
  /**
   * Decision 70. The exact centre is the whole point: a provider's service
   * area is their home or workshop often enough that publishing it would be
   * publishing their address. These assertions fail if the route is ever
   * widened back to the full `ProviderProfile`.
   */
  it("serves a public view that carries no identity, no exact position and no invented reputation", async () => {
    const token = await loginAsProvider();
    const created = await request(server).post("/api/v1/providers/me").set(...bearer(token)).send(validProfile);
    const providerId = ProviderProfileSchema.parse(created.body).id;

    const exactCenter: [number, number] = [-7.612345, 33.512345];
    await request(server)
      .patch("/api/v1/providers/me")
      .set(...bearer(token))
      .send({ serviceAreas: [{ center: { type: "Point", coordinates: exactCenter }, radiusKm: 20 }] });

    const response = await request(server).get(`/api/v1/providers/${providerId}`);
    expect(response.status).toBe(200);

    const body = response.body as Record<string, unknown>;
    for (const forbidden of ["userId", "serviceAreas", "phone", "email", "address", "updatedAt", "rating", "reviewCount", "interventionCount"]) {
      expect(body).not.toHaveProperty(forbidden);
    }

    const publicProfile = PublicProviderProfileSchema.parse(body);
    expect(publicProfile.serviceZones).toHaveLength(1);
    expect(publicProfile.serviceZones[0]?.radiusKm).toBe(20);
    // Blurred, not copied: an equal coordinate would mean the exact point went out.
    expect(publicProfile.serviceZones[0]?.approximateCenter.coordinates).not.toEqual(exactCenter);
  });

  it("does not claim a verification nobody granted", async () => {
    const token = await loginAsProvider();
    const created = await request(server).post("/api/v1/providers/me").set(...bearer(token)).send(validProfile);
    const providerId = ProviderProfileSchema.parse(created.body).id;

    const response = await request(server).get(`/api/v1/providers/${providerId}`);
    expect(PublicProviderProfileSchema.parse(response.body).verified).toBe(false);
  });

  it("keeps the full profile on GET /providers/me — it is the provider's own", async () => {
    const token = await loginAsProvider();
    await request(server).post("/api/v1/providers/me").set(...bearer(token)).send(validProfile);
    await request(server)
      .patch("/api/v1/providers/me")
      .set(...bearer(token))
      .send({ serviceAreas: [{ center: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: 20 }] });

    const mine = await request(server).get("/api/v1/providers/me").set(...bearer(token));
    const profile = ProviderProfileSchema.parse(mine.body);
    expect(profile.serviceAreas[0]?.center.coordinates).toEqual([-7.6, 33.5]);
    expect(profile.userId).toBeTruthy();
  });

  it("returns 404 for a provider id that does not exist", async () => {
    const response = await request(server).get("/api/v1/providers/018f5b0a-6e2a-7c3d-9b1a-1234567890ff");
    expect(response.status).toBe(404);
  });
});
