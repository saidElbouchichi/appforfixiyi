import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import {
  MatchCandidateSchema,
  MatchSchema,
  ProblemDetailsSchema,
  ProviderMatchSchema,
  ProviderProfileSchema,
  ServiceRequestSchema,
} from "@fixiyi/contracts";
import { getModelToken } from "@nestjs/mongoose";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Model } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { UserEntity } from "../src/auth/schemas/user.schema.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { login } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

/** Casablanca — the request's location in every test below. */
const CASABLANCA = { lng: -7.589843, lat: 33.573109 };

/** One degree of latitude is ~111km, so this gives a predictable north-south offset. */
function offsetKm(base: { lng: number; lat: number }, km: number): { lng: number; lat: number } {
  return { lng: base.lng, lat: base.lat + km / 111 };
}

interface TestProvider {
  token: string;
  profileId: string;
  userId: string;
}

/** A catalog chain created per test, so providers from another test are never eligible here. */
interface TestChain {
  serviceId: string;
  interventionTypeId: string;
  simpleComplexityId: string;
  technicalComplexityId: string;
}

/**
 * Real integration test against MongoDB/Redis Docker (04_ENVIRONMENT.md),
 * exercising the real `2dsphere` geospatial index prepared in Phase 3 and a
 * real BullMQ queue. The point of this suite is the guarantee of
 * 01_SPEC_PRODUCT.md #15: a request is NEVER broadcast to every provider.
 */
describe("Matching (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;
  let adminToken: string;
  let categoryId: string;
  let requiredSkillId: string;

  const runId = Date.now().toString().slice(-6);
  let counter = 0;
  function uniquePhone(): string {
    counter += 1;
    return `+2127${runId}${counter.toString().padStart(2, "0")}`;
  }
  function uniqueName(prefix: string): string {
    counter += 1;
    return `${prefix} ${runId}-${counter.toString()}`;
  }

  function bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
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
    const userModel = app.get<Model<UserEntity>>(getModelToken(UserEntity.name));
    await clearRateLimitState(redis);

    adminToken = await grantAdmin(userModel);
    requiredSkillId = await createNode({ level: "SKILL", name: uniqueName("E2E Skill") });
    const domainId = await createNode({ level: "DOMAIN", name: uniqueName("E2E Domain") });
    categoryId = await createNode({ level: "CATEGORY", parentId: domainId, name: uniqueName("E2E Category") });
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  async function grantAdmin(userModel: Model<UserEntity>): Promise<string> {
    const session = await login(server, redis, uniquePhone());
    await userModel.updateOne({ _id: session.user.id }, { $set: { roles: ["CLIENT", "ADMIN"] } });
    const refreshed = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    return (refreshed.body as { accessToken: string }).accessToken;
  }

  async function createNode(body: Record<string, unknown>): Promise<string> {
    const response = await request(server)
      .post("/api/v1/catalog/nodes")
      .set(...bearer(adminToken))
      .send(body);
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  /**
   * Providers are global and long-lived in the shared test database, so each
   * test gets its OWN service: a provider from another test then simply does
   * not offer it and cannot fill this test's batch. Same class of
   * shared-real-infra interference as Decision 32, through data this time.
   */
  async function createChain(): Promise<TestChain> {
    const serviceId = await createNode({ level: "SERVICE", parentId: categoryId, name: uniqueName("E2E Service") });
    const interventionTypeId = await createNode({ level: "INTERVENTION_TYPE", parentId: serviceId, name: uniqueName("E2E Intervention") });
    const simpleComplexityId = await createNode({ level: "COMPLEXITY", parentId: interventionTypeId, name: uniqueName("E2E Simple") });
    const technicalComplexityId = await createNode({
      level: "COMPLEXITY",
      parentId: interventionTypeId,
      name: uniqueName("E2E Technical"),
      requiredSkillIds: [requiredSkillId],
    });
    return { serviceId, interventionTypeId, simpleComplexityId, technicalComplexityId };
  }

  async function createProvider(options: {
    chain: TestChain;
    displayName: string;
    center: { lng: number; lat: number };
    areaRadiusKm: number;
    experienceYears?: number;
    skillIds?: string[];
    available?: boolean;
  }): Promise<TestProvider> {
    const session = await login(server, redis, uniquePhone());

    const twentyYearsAgo = new Date();
    twentyYearsAgo.setUTCFullYear(twentyYearsAgo.getUTCFullYear() - 20);
    await request(server)
      .patch("/api/v1/auth/me")
      .set(...bearer(session.accessToken))
      .send({ dateOfBirth: twentyYearsAgo.toISOString() });
    await request(server)
      .post("/api/v1/auth/roles/provider")
      .set(...bearer(session.accessToken));

    const refreshed = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    const token = (refreshed.body as { accessToken: string }).accessToken;

    const created = await request(server)
      .post("/api/v1/providers/me")
      .set(...bearer(token))
      .send({ type: "TECHNICIEN", displayName: options.displayName, experienceYears: options.experienceYears ?? 3 });
    expect(created.status).toBe(201);
    const profile = ProviderProfileSchema.parse(created.body);
    expect(profile.availabilityStatus).toBe("OFFLINE");

    const updated = await request(server)
      .patch("/api/v1/providers/me")
      .set(...bearer(token))
      .send({
        serviceIds: [options.chain.serviceId],
        skillIds: options.skillIds ?? [],
        serviceAreas: [{ center: { type: "Point", coordinates: [options.center.lng, options.center.lat] }, radiusKm: options.areaRadiusKm }],
      });
    expect(updated.status).toBe(200);

    if (options.available !== false) {
      const availability = await request(server)
        .patch("/api/v1/providers/me/availability")
        .set(...bearer(token))
        .send({ status: "AVAILABLE" });
      expect(availability.status).toBe(200);
    }

    return { token, profileId: profile.id, userId: session.user.id };
  }

  async function createSubmittedRequest(chain: TestChain, options: { technical?: boolean } = {}): Promise<{
    token: string;
    requestId: string;
  }> {
    const session = await login(server, redis, uniquePhone());
    const created = await request(server)
      .post("/api/v1/requests")
      .set(...bearer(session.accessToken));
    const requestId = ServiceRequestSchema.parse(created.body).id;

    await request(server)
      .patch(`/api/v1/requests/${requestId}`)
      .set(...bearer(session.accessToken))
      .send({
        serviceId: chain.serviceId,
        interventionTypeId: chain.interventionTypeId,
        complexityId: options.technical === true ? chain.technicalComplexityId : chain.simpleComplexityId,
        description: "Prise de courant hors service.",
        urgency: "NORMAL",
        location: { address: "Casablanca", point: { type: "Point", coordinates: [CASABLANCA.lng, CASABLANCA.lat] } },
      });

    const submitted = await request(server)
      .post(`/api/v1/requests/${requestId}/submit`)
      .set(...bearer(session.accessToken));
    expect(submitted.status).toBe(201);

    return { token: session.accessToken, requestId };
  }

  async function startMatch(client: { token: string; requestId: string }, body: Record<string, unknown> = {}) {
    return request(server)
      .post(`/api/v1/requests/${client.requestId}/match`)
      .set(...bearer(client.token))
      .send(body);
  }

  async function listCandidateIds(client: { token: string; requestId: string }): Promise<string[]> {
    const response = await request(server)
      .get(`/api/v1/requests/${client.requestId}/match/candidates`)
      .set(...bearer(client.token));
    expect(response.status).toBe(200);
    return (response.body as unknown[]).map((candidate) => MatchCandidateSchema.parse(candidate).providerId);
  }

  it("dispatches to a small batch, never to every eligible provider", async () => {
    const chain = await createChain();
    // Sequential on purpose: concurrent OTP logins against the same in-process
    // server and the same Redis reset the connection.
    const providers: TestProvider[] = [];
    for (const index of [1, 2, 3, 4, 5]) {
      providers.push(
        await createProvider({ chain, displayName: `Batch ${index.toString()}`, center: offsetKm(CASABLANCA, index), areaRadiusKm: 25 }),
      );
    }
    const client = await createSubmittedRequest(chain);

    const started = await startMatch(client);
    expect(started.status).toBe(201);
    const match = MatchSchema.parse(started.body);
    expect(match.status).toBe("ACTIVE");
    expect(match.batchCount).toBe(1);

    const ids = await listCandidateIds(client);

    // The decisive assertion of 01_SPEC_PRODUCT.md #15.
    expect(ids.length).toBeLessThan(providers.length);
    expect(ids).toHaveLength(3);
    expect(match.candidateCount).toBe(3);

    // The request really entered MATCHING — the transition Phase 4 left prepared (Decision 35).
    const refreshedRequest = await request(server)
      .get(`/api/v1/requests/${client.requestId}`)
      .set(...bearer(client.token));
    expect(ServiceRequestSchema.parse(refreshedRequest.body).status).toBe("MATCHING");
  }, 60_000);

  it("ranks a closer provider above a farther one", async () => {
    const chain = await createChain();
    const near = await createProvider({ chain, displayName: "Near", center: offsetKm(CASABLANCA, 0.5), areaRadiusKm: 25 });
    const far = await createProvider({ chain, displayName: "Far", center: offsetKm(CASABLANCA, 8), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain);

    await startMatch(client);

    const response = await request(server)
      .get(`/api/v1/requests/${client.requestId}/match/candidates`)
      .set(...bearer(client.token));
    const candidates = (response.body as unknown[]).map((candidate) => MatchCandidateSchema.parse(candidate));

    const nearEntry = candidates.find((candidate) => candidate.providerId === near.profileId);
    const farEntry = candidates.find((candidate) => candidate.providerId === far.profileId);
    expect(nearEntry).toBeDefined();
    expect(farEntry).toBeDefined();
    expect(nearEntry?.score).toBeGreaterThan(farEntry?.score ?? 0);
    expect(nearEntry?.scoreBreakdown.distance).toBeGreaterThan(farEntry?.scoreBreakdown.distance ?? 0);

    // Signals with no data must stay at zero, never be invented (Decision 40).
    expect(nearEntry?.scoreBreakdown.reputation).toBe(0);
    expect(nearEntry?.scoreBreakdown.currentLoad).toBe(0);
  }, 60_000);

  it("expands the radius when nobody is eligible nearby", async () => {
    const chain = await createChain();
    // 22km away but willing to travel 30km: only the SEARCH radius (10km by
    // default) keeps them out, so finding them proves the expansion ran.
    const distant = await createProvider({ chain, displayName: "Distant", center: offsetKm(CASABLANCA, 22), areaRadiusKm: 30 });
    const client = await createSubmittedRequest(chain);

    const started = await startMatch(client);
    expect(started.status).toBe(201);
    const match = MatchSchema.parse(started.body);

    expect(match.currentRadiusKm).toBeGreaterThan(10);
    expect(await listCandidateIds(client)).toContain(distant.profileId);
  }, 60_000);

  it("never dispatches to a provider missing a required skill", async () => {
    const chain = await createChain();
    const withSkill = await createProvider({
      chain,
      displayName: "Certified",
      center: offsetKm(CASABLANCA, 1),
      areaRadiusKm: 25,
      skillIds: [requiredSkillId],
    });
    const withoutSkill = await createProvider({ chain, displayName: "Uncertified", center: offsetKm(CASABLANCA, 1), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain, { technical: true });

    await startMatch(client);
    const ids = await listCandidateIds(client);

    expect(ids).toContain(withSkill.profileId);
    expect(ids).not.toContain(withoutSkill.profileId);
  }, 60_000);

  it("never dispatches to a provider who is not AVAILABLE", async () => {
    const chain = await createChain();
    const offline = await createProvider({
      chain,
      displayName: "Offline",
      center: offsetKm(CASABLANCA, 1),
      areaRadiusKm: 25,
      available: false,
    });
    const client = await createSubmittedRequest(chain);

    await startMatch(client);
    expect(await listCandidateIds(client)).not.toContain(offline.profileId);
  }, 60_000);

  it("shows a dispatched provider only an approximate location, and only their own dispatch", async () => {
    const chain = await createChain();
    const provider = await createProvider({ chain, displayName: "Viewer", center: offsetKm(CASABLANCA, 0.2), areaRadiusKm: 25 });
    const otherChain = await createChain();
    const stranger = await createProvider({ chain: otherChain, displayName: "Stranger", center: offsetKm(CASABLANCA, 0.2), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain);

    await startMatch(client);

    const mine = await request(server)
      .get("/api/v1/matches/mine")
      .set(...bearer(provider.token));
    expect(mine.status).toBe(200);
    const dispatch = (mine.body as unknown[])
      .map((entry) => ProviderMatchSchema.parse(entry))
      .find((entry) => entry.requestId === client.requestId);
    expect(dispatch).toBeDefined();

    // 01_SPEC_PRODUCT.md #17 — the exact address is NOT released before acceptance.
    expect(dispatch?.approximateLocation.coordinates[0]).not.toBe(CASABLANCA.lng);
    expect(dispatch?.approximateLocation.coordinates[1]).not.toBe(CASABLANCA.lat);
    expect(dispatch?.approximateLocation.coordinates[1]).toBeCloseTo(33.57, 2);

    // A provider who was not dispatched to sees nothing of this request.
    const strangerView = await request(server)
      .get("/api/v1/matches/mine")
      .set(...bearer(stranger.token));
    const strangerRequestIds = (strangerView.body as unknown[]).map((entry) => ProviderMatchSchema.parse(entry).requestId);
    expect(strangerRequestIds).not.toContain(client.requestId);

    // The client has no PROVIDER role, so the provider-facing route is closed to them.
    const clientOnProviderRoute = await request(server)
      .get("/api/v1/matches/mine")
      .set(...bearer(client.token));
    expect(clientOnProviderRoute.status).toBe(403);
  }, 60_000);

  it("lets a dispatched provider decline, once", async () => {
    const chain = await createChain();
    const provider = await createProvider({ chain, displayName: "Decliner", center: offsetKm(CASABLANCA, 0.3), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain);

    await startMatch(client);

    const mine = await request(server)
      .get("/api/v1/matches/mine")
      .set(...bearer(provider.token));
    const dispatch = (mine.body as unknown[])
      .map((entry) => ProviderMatchSchema.parse(entry))
      .find((entry) => entry.requestId === client.requestId);
    expect(dispatch).toBeDefined();

    const declined = await request(server)
      .post(`/api/v1/matches/candidates/${dispatch?.candidateId ?? ""}/decline`)
      .set(...bearer(provider.token))
      .send({ reason: "Indisponible cette semaine" });
    expect(declined.status).toBe(201);

    const again = await request(server)
      .post(`/api/v1/matches/candidates/${dispatch?.candidateId ?? ""}/decline`)
      .set(...bearer(provider.token))
      .send({});
    expect(again.status).toBe(400);
    expect(ProblemDetailsSchema.parse(again.body).code).toBe("MATCH_ALREADY_DECLINED");
  }, 60_000);

  it("supports DIRECT mode: the client picks one provider and nobody else is contacted", async () => {
    const chain = await createChain();
    const chosen = await createProvider({ chain, displayName: "Chosen", center: offsetKm(CASABLANCA, 1), areaRadiusKm: 25 });
    const ignored = await createProvider({ chain, displayName: "Ignored", center: offsetKm(CASABLANCA, 1), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain);

    const started = await startMatch(client, { mode: "DIRECT", providerId: chosen.profileId });
    expect(started.status).toBe(201);
    const match = MatchSchema.parse(started.body);
    expect(match.mode).toBe("DIRECT");
    expect(match.candidateCount).toBe(1);

    const ids = await listCandidateIds(client);
    expect(ids).toEqual([chosen.profileId]);
    expect(ids).not.toContain(ignored.profileId);
  }, 60_000);

  it("rejects a manual radius that is not wider than the current one", async () => {
    const chain = await createChain();
    await createProvider({ chain, displayName: "Any", center: offsetKm(CASABLANCA, 1), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain);
    await startMatch(client);

    const tooSmall = await request(server)
      .post(`/api/v1/requests/${client.requestId}/match/expand-radius`)
      .set(...bearer(client.token))
      .send({ radiusKm: 1 });
    expect(tooSmall.status).toBe(400);
    expect(ProblemDetailsSchema.parse(tooSmall.body).code).toBe("MATCH_RADIUS_NOT_WIDER");
  }, 60_000);

  it("refuses to start matching on a request that was never submitted", async () => {
    const session = await login(server, redis, uniquePhone());
    const created = await request(server)
      .post("/api/v1/requests")
      .set(...bearer(session.accessToken));
    const draftId = ServiceRequestSchema.parse(created.body).id;

    const started = await request(server)
      .post(`/api/v1/requests/${draftId}/match`)
      .set(...bearer(session.accessToken))
      .send({});
    expect(started.status).toBe(400);
    expect(ProblemDetailsSchema.parse(started.body).code).toBe("REQUEST_NOT_MATCHABLE");
  }, 60_000);

  it("refuses to expose a match to anyone but its client", async () => {
    const chain = await createChain();
    await createProvider({ chain, displayName: "Any2", center: offsetKm(CASABLANCA, 1), areaRadiusKm: 25 });
    const client = await createSubmittedRequest(chain);
    await startMatch(client);

    const stranger = await login(server, redis, uniquePhone());
    const response = await request(server)
      .get(`/api/v1/requests/${client.requestId}/match`)
      .set(...bearer(stranger.accessToken));
    expect(response.status).toBe(403);
  }, 60_000);
});
