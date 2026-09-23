import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import {
  ProblemDetailsSchema,
  ProviderProfileSchema,
  PublicProviderProfileSchema,
  RequestDocumentUploadOutputSchema,
  VerificationCaseSchema,
  VerificationDocumentSchema,
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

/**
 * Real integration test against MongoDB/Redis/MinIO Docker (04_ENVIRONMENT.md).
 * The upload step does a genuine HTTP PUT to the presigned URL MinIO issued
 * — no simulated storage state (03_AGENT_PROTOCOL.md #2).
 */
describe("Verification (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;
  let userModel: Model<UserEntity>;

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
    userModel = app.get(getModelToken(UserEntity.name));
    await clearRateLimitState(redis);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  function bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
  }

  async function createProviderProfile(): Promise<{ token: string; profileId: string; userId: string }> {
    const session = await login(server, redis, uniquePhone());
    const created = await request(server)
      .post("/api/v1/providers/me")
      .set(...bearer(session.accessToken))
      .send({ type: "BRICOLEUR", displayName: "Yassine T." });

    if (created.status === 403) {
      // No PROVIDER role yet — grant it (age rule already covered by auth.e2e.test.ts) then retry.
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setUTCFullYear(twentyYearsAgo.getUTCFullYear() - 20);
      await request(server).patch("/api/v1/auth/me").set(...bearer(session.accessToken)).send({ dateOfBirth: twentyYearsAgo.toISOString() });
      await request(server).post("/api/v1/auth/roles/provider").set(...bearer(session.accessToken));
      const refreshed = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
      const newToken = (refreshed.body as { accessToken: string }).accessToken;
      const retry = await request(server)
        .post("/api/v1/providers/me")
        .set(...bearer(newToken))
        .send({ type: "BRICOLEUR", displayName: "Yassine T." });
      expect(retry.status).toBe(201);
      return { token: newToken, profileId: ProviderProfileSchema.parse(retry.body).id, userId: session.user.id };
    }

    expect(created.status).toBe(201);
    return { token: session.accessToken, profileId: ProviderProfileSchema.parse(created.body).id, userId: session.user.id };
  }

  async function grantVerificationAgent(): Promise<string> {
    const session = await login(server, redis, uniquePhone());
    await userModel.updateOne({ _id: session.user.id }, { $set: { roles: ["CLIENT", "VERIFICATION_AGENT"] } });
    const refreshed = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    return (refreshed.body as { accessToken: string }).accessToken;
  }

  it("rejects creating a case for someone else's provider profile", async () => {
    const provider = await createProviderProfile();
    const stranger = await login(server, redis, uniquePhone());

    const response = await request(server)
      .post("/api/v1/verification/cases")
      .set(...bearer(stranger.accessToken))
      .send({ targetType: "PROVIDER", targetId: provider.profileId });
    expect(response.status).toBe(403);
  });

  it("runs a full verification cycle: create case, real MinIO upload, confirm, submit, approve", async () => {
    const provider = await createProviderProfile();

    const created = await request(server)
      .post("/api/v1/verification/cases")
      .set(...bearer(provider.token))
      .send({ targetType: "PROVIDER", targetId: provider.profileId });
    expect(created.status).toBe(201);
    const kase = VerificationCaseSchema.parse(created.body);
    expect(kase.status).toBe("DRAFT");

    // Re-creating the case for the same target must return the *same* case, not a duplicate.
    const again = await request(server)
      .post("/api/v1/verification/cases")
      .set(...bearer(provider.token))
      .send({ targetType: "PROVIDER", targetId: provider.profileId });
    expect(VerificationCaseSchema.parse(again.body).id).toBe(kase.id);

    // Submitting with zero documents must fail.
    const tooEarly = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/submit`)
      .set(...bearer(provider.token));
    expect(tooEarly.status).toBe(400);
    expect(ProblemDetailsSchema.parse(tooEarly.body).code).toBe("VERIFICATION_NO_DOCUMENTS");

    const pdfBytes = Buffer.from("%PDF-1.4 fake-but-real-bytes");

    // Audit 2026-09-21 (inspection B2): an identity document is bounded in size and type.
    const oversized = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/documents`)
      .set(...bearer(provider.token))
      .send({ type: "IDENTITY", fileName: "cin.pdf", contentType: "application/pdf", sizeBytes: 50 * 1024 * 1024 });
    expect(oversized.status).toBe(400);
    const wrongType = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/documents`)
      .set(...bearer(provider.token))
      .send({ type: "IDENTITY", fileName: "cin.exe", contentType: "application/x-msdownload", sizeBytes: pdfBytes.length });
    expect(wrongType.status).toBe(400);

    const uploadRequest = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/documents`)
      .set(...bearer(provider.token))
      .send({ type: "IDENTITY", fileName: "cin.pdf", contentType: "application/pdf", sizeBytes: pdfBytes.length });
    expect(uploadRequest.status).toBe(201);
    const upload = RequestDocumentUploadOutputSchema.parse(uploadRequest.body);

    // Confirming before the file actually exists in MinIO must fail — no simulated upload state.
    const tooSoon = await request(server)
      .post(`/api/v1/verification/documents/${upload.documentId}/confirm`)
      .set(...bearer(provider.token));
    expect(tooSoon.status).toBe(400);
    expect(ProblemDetailsSchema.parse(tooSoon.body).code).toBe("VERIFICATION_DOCUMENT_NOT_UPLOADED");

    // The declared size is signed into the URL: storage refuses a bigger body.
    const tooBig = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.concat([pdfBytes, Buffer.alloc(1024)]),
    });
    expect(tooBig.ok).toBe(false);

    // Real HTTP PUT to the presigned URL MinIO issued — genuine upload, not mocked.
    const putResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBytes,
    });
    expect(putResponse.status).toBe(200);

    const confirmed = await request(server)
      .post(`/api/v1/verification/documents/${upload.documentId}/confirm`)
      .set(...bearer(provider.token));
    expect(confirmed.status).toBe(201);
    expect(VerificationDocumentSchema.parse(confirmed.body).status).toBe("UPLOADED");

    const submitted = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/submit`)
      .set(...bearer(provider.token));
    expect(submitted.status).toBe(201);
    expect(VerificationCaseSchema.parse(submitted.body).status).toBe("IN_REVIEW");

    // A plain provider cannot decide their own case.
    const selfDecide = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/decisions`)
      .set(...bearer(provider.token))
      .send({ outcome: "APPROVED" });
    expect(selfDecide.status).toBe(403);

    const agentToken = await grantVerificationAgent();
    const approved = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/decisions`)
      .set(...bearer(agentToken))
      .send({ outcome: "APPROVED", reason: "Identity confirmed" });
    expect(approved.status).toBe(201);
    expect(VerificationCaseSchema.parse(approved.body).status).toBe("VERIFIED");

    // Re-approving an already-VERIFIED case is not a valid transition.
    const reapprove = await request(server)
      .post(`/api/v1/verification/cases/${kase.id}/decisions`)
      .set(...bearer(agentToken))
      .send({ outcome: "APPROVED" });
    expect(reapprove.status).toBe(400);
    expect(ProblemDetailsSchema.parse(reapprove.body).code).toBe("VERIFICATION_INVALID_TRANSITION");

    // Decision 70: the public badge is this case, and nothing else about it.
    const publicProfile = await request(server).get(`/api/v1/providers/${provider.profileId}`);
    const publicBody = PublicProviderProfileSchema.parse(publicProfile.body);
    expect(publicBody.verified).toBe(true);
    expect(publicProfile.body).not.toHaveProperty("verificationCaseId");
    expect(publicProfile.body).not.toHaveProperty("verifiedAt");

    const decisions = await request(server)
      .get(`/api/v1/verification/cases/${kase.id}/decisions`)
      .set(...bearer(provider.token)); // the owner can view decisions too, not just agents
    expect(decisions.status).toBe(200);
    expect(decisions.body).toHaveLength(1);
  });
});
