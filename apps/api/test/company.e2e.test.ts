import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import {
  CompanyMemberSchema,
  CompanySchema,
  ProblemDetailsSchema,
  type Company,
  type CompanyMember,
} from "@fixiyi/contracts";
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

/** Real integration test against MongoDB/Redis Docker (04_ENVIRONMENT.md). */
describe("Companies (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;

  const runId = Date.now().toString().slice(-6);
  let counter = 0;
  function uniquePhone(): string {
    counter += 1;
    // Must start with a real Moroccan mobile prefix (6/7) for libphonenumber-js to accept it —
    // "+2129..." (used briefly here) isn't one and was rejected with a real 400 INVALID_PHONE.
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

  function bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
  }

  async function loginAsUser(): Promise<{ accessToken: string; phone: string }> {
    const phone = uniquePhone();
    const session = await login(server, redis, phone);
    return { accessToken: session.accessToken, phone };
  }

  async function createCompany(token: string, name: string): Promise<Company> {
    const response = await request(server)
      .post("/api/v1/companies")
      .set(...bearer(token))
      .send({ name });
    expect(response.status).toBe(201);
    return CompanySchema.parse(response.body);
  }

  it("creates a company and makes the creator its ACTIVE OWNER", async () => {
    const owner = await loginAsUser();
    const company = await createCompany(owner.accessToken, "Fixiyi Elec SARL");
    expect(company.status).toBe("ACTIVE");

    const mine = await request(server).get("/api/v1/companies/mine").set(...bearer(owner.accessToken));
    expect(mine.status).toBe(200);
    expect(z.array(CompanySchema).parse(mine.body).some((c) => c.id === company.id)).toBe(true);

    const members = await request(server).get(`/api/v1/companies/${company.id}/members`).set(...bearer(owner.accessToken));
    const memberList = z.array(CompanyMemberSchema).parse(members.body);
    expect(memberList).toHaveLength(1);
    expect(memberList[0]).toMatchObject({ role: "OWNER", status: "ACTIVE" });
  });

  it("GET /companies/:id is public", async () => {
    const owner = await loginAsUser();
    const company = await createCompany(owner.accessToken, "Public Read Co");
    const response = await request(server).get(`/api/v1/companies/${company.id}`);
    expect(response.status).toBe(200);
    expect(CompanySchema.parse(response.body).name).toBe("Public Read Co");
  });

  it("rejects an invite from a non-owner", async () => {
    const owner = await loginAsUser();
    const company = await createCompany(owner.accessToken, "NoAuth Co");
    const stranger = await loginAsUser();

    const response = await request(server)
      .post(`/api/v1/companies/${company.id}/members`)
      .set(...bearer(stranger.accessToken))
      .send({ phone: owner.phone, role: "MEMBER" });
    expect(response.status).toBe(403);
  });

  it("rejects inviting a phone that never signed up", async () => {
    const owner = await loginAsUser();
    const company = await createCompany(owner.accessToken, "Invite Co");

    const response = await request(server)
      .post(`/api/v1/companies/${company.id}/members`)
      .set(...bearer(owner.accessToken))
      .send({ phone: "+212600000099", role: "MEMBER" });
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(response.body).code).toBe("USER_NOT_FOUND");
  });

  it("invites a registered user, who then accepts and becomes ACTIVE", async () => {
    const owner = await loginAsUser();
    const company = await createCompany(owner.accessToken, "Accept Co");
    const invitee = await loginAsUser();

    const invited = await request(server)
      .post(`/api/v1/companies/${company.id}/members`)
      .set(...bearer(owner.accessToken))
      .send({ phone: invitee.phone, role: "TECHNICIAN" });
    expect(invited.status).toBe(201);
    const invitedMember: CompanyMember = CompanyMemberSchema.parse(invited.body);
    expect(invitedMember.status).toBe("INVITED");

    // Inviting the same user again must fail — already a member.
    const duplicate = await request(server)
      .post(`/api/v1/companies/${company.id}/members`)
      .set(...bearer(owner.accessToken))
      .send({ phone: invitee.phone, role: "MEMBER" });
    expect(duplicate.status).toBe(409);
    expect(ProblemDetailsSchema.parse(duplicate.body).code).toBe("COMPANY_MEMBER_ALREADY_EXISTS");

    const accepted = await request(server)
      .post(`/api/v1/companies/${company.id}/members/me/accept`)
      .set(...bearer(invitee.accessToken));
    expect(accepted.status).toBe(201);
    expect(CompanyMemberSchema.parse(accepted.body).status).toBe("ACTIVE");
  });

  it("lets an owner remove a member, but not the last owner", async () => {
    const owner = await loginAsUser();
    const company = await createCompany(owner.accessToken, "Remove Co");
    const invitee = await loginAsUser();

    const invited = await request(server)
      .post(`/api/v1/companies/${company.id}/members`)
      .set(...bearer(owner.accessToken))
      .send({ phone: invitee.phone, role: "MEMBER" });
    const memberId = CompanyMemberSchema.parse(invited.body).id;

    const removed = await request(server)
      .delete(`/api/v1/companies/${company.id}/members/${memberId}`)
      .set(...bearer(owner.accessToken));
    expect(removed.status).toBe(200);

    const members = await request(server).get(`/api/v1/companies/${company.id}/members`).set(...bearer(owner.accessToken));
    const removedMember = z.array(CompanyMemberSchema).parse(members.body).find((m) => m.id === memberId);
    expect(removedMember?.status).toBe("REMOVED");

    // The creator is the only ACTIVE OWNER — removing them must be rejected.
    const ownerMembership = z.array(CompanyMemberSchema).parse(members.body).find((m) => m.role === "OWNER");
    if (!ownerMembership) throw new Error("expected an OWNER membership");
    const lastOwnerRemoval = await request(server)
      .delete(`/api/v1/companies/${company.id}/members/${ownerMembership.id}`)
      .set(...bearer(owner.accessToken));
    expect(lastOwnerRemoval.status).toBe(400);
    expect(ProblemDetailsSchema.parse(lastOwnerRemoval.body).code).toBe("COMPANY_LAST_OWNER");
  });
});
