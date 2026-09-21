import "reflect-metadata";
import "./setup-env.js";

import { loadEnv } from "@fixiyi/config";
import {
  AuthSessionResultSchema,
  AuthTokensSchema,
  OtpRequestOutputSchema,
  ProblemDetailsSchema,
  SessionSchema,
  UserSchema,
  type AuthSessionResult,
  type AuthTokens,
  type ProblemDetails,
  type Session,
  type User,
} from "@fixiyi/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { login as sharedLogin, requestOtpCode as sharedRequestOtpCode } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

const SessionListSchema = z.array(SessionSchema);

/**
 * Real integration test: boots the full Nest app and hits it against the
 * actual MongoDB/Redis dev containers (04_ENVIRONMENT.md), not mocks. Each
 * test uses a freshly-generated phone/email so repeated runs never collide
 * with rate-limit state or users left behind by a previous run. Response
 * bodies are parsed through the same Zod schemas the API publishes
 * (`@fixiyi/contracts`), which both type-checks them safely and proves the
 * response actually matches its documented contract.
 */
describe("Auth (e2e)", () => {
  let app: NestFastifyApplication;
  let server: Parameters<typeof request>[0];
  let redis: RedisService;

  const runId = Date.now().toString().slice(-6);
  let counter = 0;
  function uniquePhone(): string {
    counter += 1;
    return `+2126${runId}${counter.toString().padStart(2, "0")}`;
  }
  function uniqueEmail(): string {
    counter += 1;
    return `test-${runId}-${counter.toString().padStart(2, "0")}@example.com`;
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

  // Thin wrappers over the shared helper (binds server/redis) so every existing
  // single-arg call site (`requestOtpCode(phone)`, `login(phone)`, ...) keeps working.
  function requestOtpCode(phone: string): Promise<string> {
    return sharedRequestOtpCode(server, redis, phone);
  }
  function login(phone: string): Promise<AuthSessionResult> {
    return sharedLogin(server, redis, phone);
  }

  function parseProblem(body: unknown): ProblemDetails {
    return ProblemDetailsSchema.parse(body);
  }

  function bearer(accessToken: string): [string, string] {
    return ["Authorization", `Bearer ${accessToken}`];
  }

  function extractCookieHeader(response: request.Response): string {
    const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;
    return (setCookie ?? []).map((cookie) => cookie.split(";")[0]).join("; ");
  }

  function extractCookieValue(response: request.Response, name: string): string {
    const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;
    const match = (setCookie ?? []).find((cookie) => cookie.startsWith(`${name}=`));
    if (!match) throw new Error(`Cookie ${name} not found in response`);
    const [nameValuePair] = match.split(";");
    return decodeURIComponent((nameValuePair ?? "").slice(name.length + 1));
  }

  describe("Rate limiting", () => {
    // Runs first and cleans up after itself: the per-IP OTP-request bucket it
    // deliberately exhausts here is shared with every other test in this file
    // (supertest always hits the server from the same loopback address).
    afterAll(async () => {
      const keys = await redis.client.keys("ratelimit:otp-request:*");
      if (keys.length > 0) {
        await redis.client.del(...keys);
      }
    });

    it("returns 429 with a Retry-After header once the per-IP OTP-request limit is exceeded", async () => {
      let lastStatus = 0;
      let lastResponse: request.Response | undefined;
      for (let i = 0; i < 65; i++) {
        lastResponse = await request(server).post("/api/v1/auth/otp/request").send({ phone: uniquePhone() });
        lastStatus = lastResponse.status;
        if (lastStatus === 429) break;
      }
      expect(lastStatus).toBe(429);
      expect(lastResponse?.headers["retry-after"]).toBeDefined();
    });
  });

  describe("Phone OTP", () => {
    it("rejects a malformed phone number", async () => {
      const response = await request(server).post("/api/v1/auth/otp/request").send({ phone: "0612345678" });
      expect(response.status).toBe(400);
    });

    it("issues a real (fake-provider) code, then rejects a wrong code without consuming it, then accepts the right one", async () => {
      const phone = uniquePhone();
      const code = await requestOtpCode(phone);

      const wrong = await request(server).post("/api/v1/auth/otp/verify").send({ phone, code: "000000" });
      expect(wrong.status).toBe(401);
      expect(parseProblem(wrong.body).code).toBe("OTP_MISMATCH");

      const right = await request(server).post("/api/v1/auth/otp/verify").send({ phone, code });
      expect(right.status).toBe(201);
      const session = AuthSessionResultSchema.parse(right.body);
      expect(session.user).toMatchObject({ phone, roles: ["CLIENT"], status: "ACTIVE" });
      expect(session.user.phoneVerifiedAt).not.toBeNull();
    });

    it("is one-time use — the same code cannot be replayed", async () => {
      const phone = uniquePhone();
      const code = await requestOtpCode(phone);
      await request(server).post("/api/v1/auth/otp/verify").send({ phone, code });

      const replay = await request(server).post("/api/v1/auth/otp/verify").send({ phone, code });
      expect(replay.status).toBe(401);
      expect(parseProblem(replay.body).code).toBe("OTP_NOT_FOUND");
    });

    it("logs an existing user back in without creating a duplicate account", async () => {
      const phone = uniquePhone();
      const first = await login(phone);
      const second = await login(phone);
      expect(second.user.id).toBe(first.user.id);
    });
  });

  describe("Session enforcement (RBAC baseline)", () => {
    it("rejects GET /auth/me with no token at all", async () => {
      const response = await request(server).get("/api/v1/auth/me");
      expect(response.status).toBe(401);
    });

    it("rejects a syntactically invalid bearer token", async () => {
      const response = await request(server).get("/api/v1/auth/me").set("Authorization", "Bearer not-a-real-token");
      expect(response.status).toBe(401);
    });

    it("accepts a freshly-issued access token", async () => {
      const { accessToken } = await login(uniquePhone());
      const response = await request(server).get("/api/v1/auth/me").set(...bearer(accessToken));
      expect(response.status).toBe(200);
      expect(UserSchema.parse(response.body).roles).toEqual(["CLIENT"]);
    });
  });

  describe("Refresh rotation", () => {
    it("rotates to a new token pair and invalidates the previous refresh token", async () => {
      const { refreshToken } = await login(uniquePhone());

      const first = await request(server).post("/api/v1/auth/refresh").send({ refreshToken });
      expect(first.status).toBe(201);
      const firstTokens: AuthTokens = AuthTokensSchema.parse(first.body);
      expect(firstTokens.refreshToken).not.toBe(refreshToken);

      const second = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: firstTokens.refreshToken });
      expect(second.status).toBe(201);
    });

    it("lets only ONE of several concurrent refreshes with the same token succeed", async () => {
      // Audit finding (2026-09-21): rotation was read-modify-write, so parallel
      // refreshes could each read version N and each receive a valid N+1 pair.
      const { refreshToken } = await login(uniquePhone());

      const responses = await Promise.all(Array.from({ length: 8 }, () => request(server).post("/api/v1/auth/refresh").send({ refreshToken })));
      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status !== 201).every((status) => status === 401)).toBe(true);
    });

    it("detects reuse of a stale refresh token and revokes the whole session", async () => {
      const { refreshToken, accessToken } = await login(uniquePhone());

      // Rotate once — `refreshToken` is now stale.
      await request(server).post("/api/v1/auth/refresh").send({ refreshToken });

      // Replaying the stale token must be rejected...
      const reuse = await request(server).post("/api/v1/auth/refresh").send({ refreshToken });
      expect(reuse.status).toBe(401);

      // ...and must have revoked the session outright: even the still-unexpired access token now fails.
      const me = await request(server).get("/api/v1/auth/me").set(...bearer(accessToken));
      expect(me.status).toBe(401);
    });

    it("rejects an already-expired refresh token", async () => {
      const response = await request(server).post("/api/v1/auth/refresh").send({ refreshToken: "not.a.jwt" });
      expect(response.status).toBe(401);
    });
  });

  describe("Logout / device management", () => {
    it("logout revokes the session — the access token stops working immediately", async () => {
      const { accessToken } = await login(uniquePhone());

      const logout = await request(server).post("/api/v1/auth/logout").set(...bearer(accessToken));
      expect(logout.status).toBe(201);

      const me = await request(server).get("/api/v1/auth/me").set(...bearer(accessToken));
      expect(me.status).toBe(401);
    });

    it("logout-all revokes every session for the user, including ones from other devices", async () => {
      const phone = uniquePhone();
      const sessionA = await login(phone);
      const sessionB = await login(phone);

      const logoutAll = await request(server).post("/api/v1/auth/logout-all").set(...bearer(sessionA.accessToken));
      expect(logoutAll.status).toBe(201);

      const meA = await request(server).get("/api/v1/auth/me").set(...bearer(sessionA.accessToken));
      const meB = await request(server).get("/api/v1/auth/me").set(...bearer(sessionB.accessToken));
      expect(meA.status).toBe(401);
      expect(meB.status).toBe(401);
    });

    it("lists active sessions and flags the current one, then revokes a specific session by id", async () => {
      const phone = uniquePhone();
      const sessionA = await login(phone);
      await login(phone);

      const list = await request(server).get("/api/v1/auth/sessions").set(...bearer(sessionA.accessToken));
      expect(list.status).toBe(200);
      const sessions: Session[] = SessionListSchema.parse(list.body);
      expect(sessions).toHaveLength(2);
      expect(sessions.some((s) => s.current)).toBe(true);

      const otherSession = sessions.find((s) => !s.current);
      if (!otherSession) throw new Error("expected a second session");
      const revoke = await request(server)
        .delete(`/api/v1/auth/sessions/${otherSession.id}`)
        .set(...bearer(sessionA.accessToken));
      expect(revoke.status).toBe(200);

      const listAfter = await request(server).get("/api/v1/auth/sessions").set(...bearer(sessionA.accessToken));
      expect(SessionListSchema.parse(listAfter.body)).toHaveLength(1);
    });

    it("returns 404 when trying to revoke another user's session", async () => {
      const sessionA = await login(uniquePhone());
      const sessionB = await login(uniquePhone());

      const listA = await request(server).get("/api/v1/auth/sessions").set(...bearer(sessionA.accessToken));
      const [sessionAInfo] = SessionListSchema.parse(listA.body);
      if (!sessionAInfo) throw new Error("expected a session for user A");

      const response = await request(server)
        .delete(`/api/v1/auth/sessions/${sessionAInfo.id}`)
        .set(...bearer(sessionB.accessToken));
      expect(response.status).toBe(404);
    });
  });

  describe("Self-service PROVIDER role grant (age rule)", () => {
    it("rejects becoming a provider before a date of birth is set", async () => {
      const { accessToken } = await login(uniquePhone());
      const response = await request(server).post("/api/v1/auth/roles/provider").set(...bearer(accessToken));
      expect(response.status).toBe(400);
      expect(parseProblem(response.body).code).toBe("DATE_OF_BIRTH_REQUIRED");
    });

    it("rejects an under-age applicant", async () => {
      const { accessToken } = await login(uniquePhone());
      const sixteenYearsAgo = new Date();
      sixteenYearsAgo.setUTCFullYear(sixteenYearsAgo.getUTCFullYear() - 16);

      const patch = await request(server)
        .patch("/api/v1/auth/me")
        .set(...bearer(accessToken))
        .send({ dateOfBirth: sixteenYearsAgo.toISOString() });
      expect(patch.status).toBe(200);

      const response = await request(server).post("/api/v1/auth/roles/provider").set(...bearer(accessToken));
      expect(response.status).toBe(403);
      expect(parseProblem(response.body).code).toBe("MIN_AGE_NOT_MET");
    });

    it("grants PROVIDER to a verified adult and is idempotent on a second call", async () => {
      const { accessToken } = await login(uniquePhone());
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setUTCFullYear(twentyYearsAgo.getUTCFullYear() - 20);

      const patch = await request(server)
        .patch("/api/v1/auth/me")
        .set(...bearer(accessToken))
        .send({ dateOfBirth: twentyYearsAgo.toISOString() });
      expect(patch.status).toBe(200);

      const first = await request(server).post("/api/v1/auth/roles/provider").set(...bearer(accessToken));
      expect(first.status).toBe(201);
      expect(UserSchema.parse(first.body).roles).toEqual(["CLIENT", "PROVIDER"]);

      const second = await request(server).post("/api/v1/auth/roles/provider").set(...bearer(accessToken));
      expect(second.status).toBe(201);
      expect(UserSchema.parse(second.body).roles).toEqual(["CLIENT", "PROVIDER"]);
    });
  });

  describe("Email attach + verify", () => {
    it("attaches and verifies a new email with a real (fake-provider) code", async () => {
      const { accessToken } = await login(uniquePhone());
      const email = uniqueEmail();

      const attach = await request(server).post("/api/v1/auth/email").set(...bearer(accessToken)).send({ email });
      expect(attach.status).toBe(201);
      const attachOutput = OtpRequestOutputSchema.parse(attach.body);
      expect(attachOutput.devCode).toMatch(/^\d{6}$/);

      const verify = await request(server)
        .post("/api/v1/auth/email/verify")
        .set(...bearer(accessToken))
        .send({ code: attachOutput.devCode });
      expect(verify.status).toBe(201);
      const verifiedUser: User = UserSchema.parse(verify.body);
      expect(verifiedUser.email).toBe(email);
      expect(verifiedUser.emailVerifiedAt).not.toBeNull();
    });

    it("rejects a second account attaching an email already verified on another account", async () => {
      const email = uniqueEmail();
      const first = await login(uniquePhone());
      const firstAttach = await request(server).post("/api/v1/auth/email").set(...bearer(first.accessToken)).send({ email });
      const firstOutput = OtpRequestOutputSchema.parse(firstAttach.body);
      await request(server)
        .post("/api/v1/auth/email/verify")
        .set(...bearer(first.accessToken))
        .send({ code: firstOutput.devCode });

      const second = await login(uniquePhone());
      const secondAttach = await request(server).post("/api/v1/auth/email").set(...bearer(second.accessToken)).send({ email });
      expect(secondAttach.status).toBe(409);
      expect(parseProblem(secondAttach.body).code).toBe("EMAIL_ALREADY_TAKEN");
    });
  });

  describe("Web cookie + CSRF flow", () => {
    it("logs in via cookies and requires a matching x-csrf-token header to log out", async () => {
      const phone = uniquePhone();
      const code = await requestOtpCode(phone);
      const loginResponse = await request(server).post("/api/v1/auth/otp/verify").send({ phone, code });
      expect(loginResponse.status).toBe(201);

      const cookieHeader = extractCookieHeader(loginResponse);
      const csrfToken = extractCookieValue(loginResponse, "fixiyi_csrf");

      const withoutCsrf = await request(server).post("/api/v1/auth/logout").set("Cookie", cookieHeader);
      expect(withoutCsrf.status).toBe(403);

      const withWrongCsrf = await request(server).post("/api/v1/auth/logout").set("Cookie", cookieHeader).set("x-csrf-token", "wrong-token");
      expect(withWrongCsrf.status).toBe(403);

      const withCsrf = await request(server).post("/api/v1/auth/logout").set("Cookie", cookieHeader).set("x-csrf-token", csrfToken);
      expect(withCsrf.status).toBe(201);
    });
  });
});
