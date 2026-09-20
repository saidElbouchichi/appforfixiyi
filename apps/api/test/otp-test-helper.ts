import { AuthSessionResultSchema, OtpRequestOutputSchema, type AuthSessionResult, type OtpRequestOutput } from "@fixiyi/contracts";
import request from "supertest";
import { expect } from "vitest";

import type { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { clearRateLimitState } from "./rate-limit-test-helper.js";

/**
 * Shared by every e2e test file that just needs "a logged-in user" as setup
 * (not testing OTP/rate-limiting itself). Clears every rate-limit counter
 * (otp-request AND otp-verify are both IP-scoped — a phone-scoped cooldown
 * alone isn't enough) before each call: every e2e file hits the server from
 * the same loopback address, so one file's cumulative traffic must never
 * spuriously 429 another file's unrelated login. The *dedicated* rate-limit
 * test in auth.e2e.test.ts deliberately bypasses this helper and calls the
 * raw endpoint, since it wants to observe real accumulation up to 429.
 */
export async function requestOtp(server: Parameters<typeof request>[0], redis: RedisService, phone: string): Promise<OtpRequestOutput> {
  await redis.client.del(`otp:cooldown:phone:${phone}`);
  await clearRateLimitState(redis);
  const response = await request(server).post("/api/v1/auth/otp/request").send({ phone });
  expect(response.status).toBe(201);
  return OtpRequestOutputSchema.parse(response.body);
}

export async function requestOtpCode(server: Parameters<typeof request>[0], redis: RedisService, phone: string): Promise<string> {
  const { devCode } = await requestOtp(server, redis, phone);
  expect(devCode).toMatch(/^\d{6}$/);
  if (!devCode) {
    throw new Error("expected a devCode in non-production/fake-provider mode");
  }
  return devCode;
}

export async function login(server: Parameters<typeof request>[0], redis: RedisService, phone: string): Promise<AuthSessionResult> {
  const code = await requestOtpCode(server, redis, phone);
  await clearRateLimitState(redis);
  const response = await request(server).post("/api/v1/auth/otp/verify").send({ phone, code });
  expect(response.status).toBe(201);
  return AuthSessionResultSchema.parse(response.body);
}
