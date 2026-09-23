import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import {
  CatalogNodeSchema,
  CatalogTreeNodeSchema,
  ProblemDetailsSchema,
  type CatalogNode,
  type CatalogTreeNode,
  type CreateCatalogNodeInput,
} from "@fixiyi/contracts";
import { getModelToken } from "@nestjs/mongoose";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Model } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { UserEntity } from "../src/auth/schemas/user.schema.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { login } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

const CatalogNodeListSchema = z.array(CatalogNodeSchema);
const CatalogTreeSchema = z.array(CatalogTreeNodeSchema);

/**
 * Real integration test against MongoDB/Redis Docker (04_ENVIRONMENT.md).
 * Grants ADMIN directly via the Mongoose model (bypassing the API) to reach
 * a role no self-service endpoint can grant — matches how a real deployment
 * would bootstrap its first admin before Phase 12's admin tooling exists.
 */
describe("Catalog (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;
  let userModel: Model<UserEntity>;

  const runId = Date.now().toString().slice(-6);
  let counter = 0;
  function uniqueName(prefix: string): string {
    counter += 1;
    return `${prefix}-${runId}-${counter.toString()}`;
  }
  function uniquePhone(): string {
    counter += 1;
    return `+2127${runId}${counter.toString().padStart(2, "0")}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(loadEnv())] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    server = app.getHttpAdapter().getInstance().server;
    userModel = app.get(getModelToken(UserEntity.name));
    redis = app.get(RedisService);
    await clearRateLimitState(redis);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  function bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
  }

  async function loginAsClient(): Promise<string> {
    const session = await login(server, redis, uniquePhone());
    return session.accessToken;
  }

  async function loginAsAdmin(): Promise<string> {
    const session = await login(server, redis, uniquePhone());
    await userModel.updateOne({ _id: session.user.id }, { $set: { roles: ["CLIENT", "ADMIN"] } });
    const refreshed = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    return z.object({ accessToken: z.string() }).parse(refreshed.body).accessToken;
  }

  /** Creates a catalog node as the given admin token and returns the parsed, typed node. */
  async function createNode(token: string, input: Partial<CreateCatalogNodeInput> & { level: CreateCatalogNodeInput["level"] }): Promise<CatalogNode> {
    const response = await request(server)
      .post("/api/v1/catalog/nodes")
      .set(...bearer(token))
      .send(input);
    expect(response.status).toBe(201);
    return CatalogNodeSchema.parse(response.body);
  }

  describe("Public reads", () => {
    it("GET /catalog/tree returns the seeded hierarchy, skills excluded", async () => {
      const response = await request(server).get("/api/v1/catalog/tree");
      expect(response.status).toBe(200);
      const tree: CatalogTreeNode[] = z.array(CatalogTreeNodeSchema).parse(response.body);

      const electricite = tree.find((node) => node.name === "Electricite");
      expect(electricite).toBeDefined();
      expect(electricite?.level).toBe("DOMAIN");
      expect(tree.some((node) => node.level === "SKILL")).toBe(false);

      const panneCategory = electricite?.children.find((node) => node.name === "Panne electrique");
      const panneService = panneCategory?.children[0];
      const diagnostic = panneService?.children[0];
      expect(diagnostic?.level).toBe("INTERVENTION_TYPE");
      expect(diagnostic?.children.some((node) => node.name === "Intervention complexe / expert")).toBe(true);
    });

    it("GET /catalog/skills returns the seeded flat skill list", async () => {
      const response = await request(server).get("/api/v1/catalog/skills");
      expect(response.status).toBe(200);
      const skills = CatalogNodeListSchema.parse(response.body);
      expect(skills.length).toBeGreaterThanOrEqual(5);
      expect(skills.every((skill) => skill.level === "SKILL" && skill.parentId === null)).toBe(true);
    });
  });

  describe("RBAC on writes", () => {
    it("rejects an unauthenticated create", async () => {
      const response = await request(server).post("/api/v1/catalog/nodes").send({ level: "DOMAIN", name: "Test" });
      expect(response.status).toBe(401);
    });

    it("rejects a CLIENT (non-admin) create", async () => {
      const token = await loginAsClient();
      const response = await request(server)
        .post("/api/v1/catalog/nodes")
        .set(...bearer(token))
        .send({ level: "DOMAIN", name: "Test" });
      expect(response.status).toBe(403);
    });

    it("allows an ADMIN to create a node — first real consumer of RolesGuard since Phase 2", async () => {
      const token = await loginAsAdmin();
      const node = await createNode(token, { level: "DOMAIN", name: uniqueName("Test-Domain") });
      expect(node.level).toBe("DOMAIN");
      expect(node.active).toBe(true);
    });
  });

  describe("Parent-level validation", () => {
    it("rejects a CATEGORY with no parentId", async () => {
      const token = await loginAsAdmin();
      const response = await request(server)
        .post("/api/v1/catalog/nodes")
        .set(...bearer(token))
        .send({ level: "CATEGORY", name: "Orpheline" });
      expect(response.status).toBe(400);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("CATALOG_PARENT_REQUIRED");
    });

    it("rejects a node whose parentId points at the wrong level", async () => {
      const token = await loginAsAdmin();
      const domain = await createNode(token, { level: "DOMAIN", name: uniqueName("Domain") });
      const category = await createNode(token, { level: "CATEGORY", parentId: domain.id, name: uniqueName("Category") });
      expect(category.level).toBe("CATEGORY");

      // A SERVICE whose parentId points at the DOMAIN directly (skipping CATEGORY) must be rejected.
      const invalidService = await request(server)
        .post("/api/v1/catalog/nodes")
        .set(...bearer(token))
        .send({ level: "SERVICE", parentId: domain.id, name: "Invalide" });
      expect(invalidService.status).toBe(400);
      expect(ProblemDetailsSchema.parse(invalidService.body).code).toBe("CATALOG_PARENT_INVALID");
    });

    it("rejects requiredSkillIds referencing a non-existent skill", async () => {
      const token = await loginAsAdmin();
      const domain = await createNode(token, { level: "DOMAIN", name: uniqueName("D") });
      const category = await createNode(token, { level: "CATEGORY", parentId: domain.id, name: uniqueName("C") });
      const service = await createNode(token, { level: "SERVICE", parentId: category.id, name: uniqueName("S") });
      const interventionType = await createNode(token, { level: "INTERVENTION_TYPE", parentId: service.id, name: uniqueName("IT") });

      const response = await request(server)
        .post("/api/v1/catalog/nodes")
        .set(...bearer(token))
        .send({
          level: "COMPLEXITY",
          parentId: interventionType.id,
          name: "Simple",
          requiredSkillIds: ["018f5b0a-6e2a-7c3d-9b1a-1234567890ff"], // well-formed UUID, but not a real skill
        });
      expect(response.status).toBe(400);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("CATALOG_SKILL_INVALID");
    });
  });

  describe("Update / soft delete", () => {
    it("updates a node and soft-deletes it (active:false, still visible with includeInactive)", async () => {
      const token = await loginAsAdmin();
      const created = await createNode(token, { level: "DOMAIN", name: uniqueName("ToDeactivate") });

      const updated = await request(server)
        .patch(`/api/v1/catalog/nodes/${created.id}`)
        .set(...bearer(token))
        .send({ description: "Updated description" });
      expect(updated.status).toBe(200);
      expect(CatalogNodeSchema.parse(updated.body).description).toBe("Updated description");

      const deleted = await request(server)
        .delete(`/api/v1/catalog/nodes/${created.id}`)
        .set(...bearer(token));
      expect(deleted.status).toBe(200);

      const activeOnly = await request(server).get(`/api/v1/catalog/nodes?level=DOMAIN`);
      expect(CatalogNodeListSchema.parse(activeOnly.body).some((node) => node.id === created.id)).toBe(false);

      const withInactive = await request(server).get(`/api/v1/catalog/nodes?level=DOMAIN&includeInactive=true`);
      const found = CatalogNodeListSchema.parse(withInactive.body).find((node) => node.id === created.id);
      expect(found?.active).toBe(false);
    });

    /**
     * Decision 62 / D3. Inheritance is resolved when the tree is read, never
     * copied onto children: setting a domain's colour once has to reach a
     * category created afterwards, and renaming or re-parenting must not
     * leave a stale copy behind.
     */
    it("inherits icon and accent colour from the nearest ancestor that has one", async () => {
      const token = await loginAsAdmin();
      const domain = await createNode(token, { level: "DOMAIN", name: uniqueName("Inherit") });
      await request(server)
        .patch(`/api/v1/catalog/nodes/${domain.id}`)
        .set(...bearer(token))
        .send({ icon: "bolt", accentColor: "electrician" });

      const category = await createNode(token, { level: "CATEGORY", parentId: domain.id, name: uniqueName("Child") });
      const service = await createNode(token, { level: "SERVICE", parentId: category.id, name: uniqueName("Grandchild") });
      await request(server)
        .patch(`/api/v1/catalog/nodes/${service.id}`)
        .set(...bearer(token))
        .send({ icon: "droplet" });

      const tree = await request(server).get("/api/v1/catalog/tree");
      const domainNode = CatalogTreeSchema.parse(tree.body).find((node) => node.id === domain.id);
      expect(domainNode?.icon).toBe("bolt");

      const categoryNode = domainNode?.children.find((node) => node.id === category.id);
      expect(categoryNode?.icon).toBe("bolt");
      expect(categoryNode?.accentColor).toBe("electrician");

      // Its own icon wins; the colour it never set still comes from the domain.
      const serviceNode = categoryNode?.children.find((node) => node.id === service.id);
      expect(serviceNode?.icon).toBe("droplet");
      expect(serviceNode?.accentColor).toBe("electrician");
    });

    it("serves the raw values to the back-office, which must know what is inherited", async () => {
      const token = await loginAsAdmin();
      const domain = await createNode(token, { level: "DOMAIN", name: uniqueName("RawTree") });
      await request(server)
        .patch(`/api/v1/catalog/nodes/${domain.id}`)
        .set(...bearer(token))
        .send({ icon: "wrench", accentColor: "carpenter" });
      const category = await createNode(token, { level: "CATEGORY", parentId: domain.id, name: uniqueName("RawTreeChild") });

      const raw = await request(server).get("/api/v1/catalog/tree?includeInactive=true&rawDisplay=true");
      const rawChild = CatalogTreeSchema.parse(raw.body)
        .find((node) => node.id === domain.id)
        ?.children.find((node) => node.id === category.id);
      expect(rawChild?.icon).toBeNull();
      expect(rawChild?.accentColor).toBeNull();

      const resolved = await request(server).get("/api/v1/catalog/tree?includeInactive=true");
      const resolvedChild = CatalogTreeSchema.parse(resolved.body)
        .find((node) => node.id === domain.id)
        ?.children.find((node) => node.id === category.id);
      expect(resolvedChild?.icon).toBe("wrench");
    });

    it("keeps the raw value on the admin views, so an administrator sees what is actually set", async () => {
      const token = await loginAsAdmin();
      const domain = await createNode(token, { level: "DOMAIN", name: uniqueName("Raw") });
      await request(server)
        .patch(`/api/v1/catalog/nodes/${domain.id}`)
        .set(...bearer(token))
        .send({ accentColor: "plumber" });
      const category = await createNode(token, { level: "CATEGORY", parentId: domain.id, name: uniqueName("RawChild") });

      const listed = await request(server).get(`/api/v1/catalog/nodes?level=CATEGORY&parentId=${domain.id}`);
      const found = CatalogNodeListSchema.parse(listed.body).find((node) => node.id === category.id);
      expect(found?.accentColor).toBeNull();
    });

    it("refuses an icon or a colour outside the closed lists", async () => {
      const token = await loginAsAdmin();
      const domain = await createNode(token, { level: "DOMAIN", name: uniqueName("Closed") });

      const badIcon = await request(server)
        .patch(`/api/v1/catalog/nodes/${domain.id}`)
        .set(...bearer(token))
        .send({ icon: "rocket" });
      expect(badIcon.status).toBe(400);

      const badColour = await request(server)
        .patch(`/api/v1/catalog/nodes/${domain.id}`)
        .set(...bearer(token))
        .send({ accentColor: "#FF0000" });
      expect(badColour.status).toBe(400);
    });
  });
});
