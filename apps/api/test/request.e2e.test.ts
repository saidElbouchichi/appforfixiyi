import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import {
  CreateUploadSessionOutputSchema,
  MediaSchema,
  ProblemDetailsSchema,
  ServiceRequestSchema,
  type CatalogTreeNode,
} from "@fixiyi/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { login } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

/** A well-known, genuinely valid 1x1 transparent PNG — small enough to embed, real enough for `image-size` to report width=1/height=1. */
const VALID_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAAAAAAABoTPPAAAAABJRU5ErkJggg==";

/**
 * Real integration test against MongoDB/Redis/MinIO Docker (04_ENVIRONMENT.md).
 * The media steps do a genuine HTTP PUT to the presigned URL MinIO issued —
 * no simulated storage state (03_AGENT_PROTOCOL.md #2).
 */
describe("Requests (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;
  let catalogChain: { serviceId: string; interventionTypeId: string; complexityId: string };
  let otherServiceId: string;

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

    const tree = await request(server).get("/api/v1/catalog/tree");
    catalogChain = findElectricitePanneChain(tree.body as CatalogTreeNode[]);
    otherServiceId = findOtherService(tree.body as CatalogTreeNode[], catalogChain.serviceId);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  function bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
  }

  async function createDraft(): Promise<{ token: string; requestId: string }> {
    const session = await login(server, redis, uniquePhone());
    const created = await request(server).post("/api/v1/requests").set(...bearer(session.accessToken));
    expect(created.status).toBe(201);
    return { token: session.accessToken, requestId: ServiceRequestSchema.parse(created.body).id };
  }

  it("creates a DRAFT request with every optional field unset", async () => {
    const { token, requestId } = await createDraft();

    const fetched = await request(server).get(`/api/v1/requests/${requestId}`).set(...bearer(token));
    expect(fetched.status).toBe(200);
    const dto = ServiceRequestSchema.parse(fetched.body);
    expect(dto.status).toBe("DRAFT");
    expect(dto.serviceId).toBeNull();
    expect(dto.location).toBeNull();
    expect(dto.mediaIds).toEqual([]);
  });

  it("rejects a stranger reading or editing someone else's request", async () => {
    const { requestId } = await createDraft();
    const stranger = await login(server, redis, uniquePhone());

    const getAttempt = await request(server).get(`/api/v1/requests/${requestId}`).set(...bearer(stranger.accessToken));
    expect(getAttempt.status).toBe(403);

    const patchAttempt = await request(server)
      .patch(`/api/v1/requests/${requestId}`)
      .set(...bearer(stranger.accessToken))
      .send({ description: "Not mine to edit" });
    expect(patchAttempt.status).toBe(403);
  });

  it("rejects an interventionTypeId that isn't actually a child of serviceId", async () => {
    const { token, requestId } = await createDraft();

    const response = await request(server)
      .patch(`/api/v1/requests/${requestId}`)
      .set(...bearer(token))
      .send({ serviceId: otherServiceId, interventionTypeId: catalogChain.interventionTypeId });
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(response.body).code).toBe("REQUEST_INTERVENTION_TYPE_INVALID");
  });

  it("requires the full catalog chain, description, urgency and location before submit", async () => {
    const { token, requestId } = await createDraft();

    const tooEarly = await request(server).post(`/api/v1/requests/${requestId}/submit`).set(...bearer(token));
    expect(tooEarly.status).toBe(400);
    expect(ProblemDetailsSchema.parse(tooEarly.body).code).toBe("REQUEST_INCOMPLETE");
  });

  it("runs the full happy path: fill the draft, attach a real MinIO-uploaded image, submit", async () => {
    const { token, requestId } = await createDraft();

    const filled = await request(server)
      .patch(`/api/v1/requests/${requestId}`)
      .set(...bearer(token))
      .send({
        serviceId: catalogChain.serviceId,
        interventionTypeId: catalogChain.interventionTypeId,
        complexityId: catalogChain.complexityId,
        description: "Prise de courant ne fonctionne plus depuis hier.",
        urgency: "NORMAL",
        location: { address: "12 rue des Fleurs, Casablanca", point: { type: "Point", coordinates: [-7.589843, 33.573109] } },
      });
    expect(filled.status).toBe(200);
    const filledDto = ServiceRequestSchema.parse(filled.body);
    expect(filledDto.serviceId).toBe(catalogChain.serviceId);
    expect(filledDto.location?.address).toBe("12 rue des Fleurs, Casablanca");

    const session = await request(server)
      .post(`/api/v1/requests/${requestId}/media`)
      .set(...bearer(token))
      .send({ fileName: "photo.png", contentType: "image/png", sizeBytes: 45 });
    expect(session.status).toBe(201);
    const upload = CreateUploadSessionOutputSchema.parse(session.body);

    // Confirming before the file actually exists in MinIO must fail — no simulated upload state.
    const tooSoon = await request(server)
      .post(`/api/v1/requests/${requestId}/media/${upload.mediaId}/finalize`)
      .set(...bearer(token));
    expect(tooSoon.status).toBe(400);
    expect(ProblemDetailsSchema.parse(tooSoon.body).code).toBe("MEDIA_NOT_UPLOADED");

    // Real HTTP PUT to the presigned URL MinIO issued — genuine upload, not mocked.
    const putResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from(VALID_PNG_BASE64, "base64"),
    });
    expect(putResponse.status).toBe(200);

    const finalized = await request(server)
      .post(`/api/v1/requests/${requestId}/media/${upload.mediaId}/finalize`)
      .set(...bearer(token));
    expect(finalized.status).toBe(201);
    const media = MediaSchema.parse(finalized.body);
    expect(media.status).toBe("READY");
    expect(media.kind).toBe("IMAGE");
    expect(media.width).toBe(1);
    expect(media.height).toBe(1);
    expect(media.actualSizeBytes).toBe(45);

    const withMedia = await request(server).get(`/api/v1/requests/${requestId}`).set(...bearer(token));
    expect(ServiceRequestSchema.parse(withMedia.body).mediaIds).toEqual([media.id]);

    const submitted = await request(server).post(`/api/v1/requests/${requestId}/submit`).set(...bearer(token));
    expect(submitted.status).toBe(201);
    expect(ServiceRequestSchema.parse(submitted.body).status).toBe("REQUESTED");

    const editAfterSubmit = await request(server)
      .patch(`/api/v1/requests/${requestId}`)
      .set(...bearer(token))
      .send({ description: "Trying to edit after submit" });
    expect(editAfterSubmit.status).toBe(400);
    expect(ProblemDetailsSchema.parse(editAfterSubmit.body).code).toBe("REQUEST_NOT_EDITABLE");
  });

  it("rejects a file whose real signature does not match its declared content type", async () => {
    const { token, requestId } = await createDraft();

    const session = await request(server)
      .post(`/api/v1/requests/${requestId}/media`)
      .set(...bearer(token))
      .send({ fileName: "fake.jpg", contentType: "image/jpeg", sizeBytes: 20 });
    expect(session.status).toBe(201);
    const upload = CreateUploadSessionOutputSchema.parse(session.body);

    const putResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: Buffer.from("this is plainly not a jpeg"),
    });
    expect(putResponse.status).toBe(200);

    const finalized = await request(server)
      .post(`/api/v1/requests/${requestId}/media/${upload.mediaId}/finalize`)
      .set(...bearer(token));
    expect(finalized.status).toBe(201);
    const media = MediaSchema.parse(finalized.body);
    expect(media.status).toBe("REJECTED");
    expect(media.rejectionReason).toMatch(/does not match/i);

    const withMedia = await request(server).get(`/api/v1/requests/${requestId}`).set(...bearer(token));
    // Rejected media never counts as "attached" — only READY media does.
    expect(ServiceRequestSchema.parse(withMedia.body).mediaIds).toEqual([]);
  });

  it("cancels a DRAFT request, and refuses to cancel it twice", async () => {
    const { token, requestId } = await createDraft();

    const cancelled = await request(server).post(`/api/v1/requests/${requestId}/cancel`).set(...bearer(token));
    expect(cancelled.status).toBe(201);
    expect(ServiceRequestSchema.parse(cancelled.body).status).toBe("CANCELLED");

    const cancelAgain = await request(server).post(`/api/v1/requests/${requestId}/cancel`).set(...bearer(token));
    expect(cancelAgain.status).toBe(400);
    expect(ProblemDetailsSchema.parse(cancelAgain.body).code).toBe("REQUEST_NOT_CANCELLABLE");
  });
});

/** Walks the seeded tree (`CatalogSeedService`) to the real Electricite > Panne electrique > Diagnostic/reparation > Simple chain. */
function findElectricitePanneChain(tree: CatalogTreeNode[]): { serviceId: string; interventionTypeId: string; complexityId: string } {
  const electricite = tree.find((node) => node.name === "Electricite");
  const panneCategory = electricite?.children.find((node) => node.name === "Panne electrique");
  const panneService = panneCategory?.children.find((node) => node.name === "Panne electrique");
  const diagnostic = panneService?.children.find((node) => node.name === "Diagnostic / reparation");
  const simple = diagnostic?.children.find((node) => node.name === "Simple");
  if (!panneService || !diagnostic || !simple) {
    throw new Error("Seed inconsistency: Electricite > Panne electrique > Diagnostic/reparation > Simple not found");
  }
  return { serviceId: panneService.id, interventionTypeId: diagnostic.id, complexityId: simple.id };
}

/** Any real SERVICE node that isn't `excludeId` — used to prove a cross-service interventionType is rejected. */
function findOtherService(tree: CatalogTreeNode[], excludeId: string): string {
  for (const domain of tree) {
    for (const category of domain.children) {
      const service = category.children.find((node) => node.id !== excludeId);
      if (service) {
        return service.id;
      }
    }
  }
  throw new Error("Seed inconsistency: expected at least two SERVICE nodes");
}
