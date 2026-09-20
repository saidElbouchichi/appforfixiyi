import type { Env } from "@fixiyi/config";
import { Inject, Injectable } from "@nestjs/common";

import { ENV } from "../../infrastructure/env.token.js";
import { RedisService } from "../../infrastructure/redis/redis.service.js";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";
import { generateVerificationCode, hashVerificationCode, verifyCodeHash } from "../verification-code.js";

export interface IssueCodeOptions {
  codeLength: number;
  ttlSeconds: number;
  cooldownSeconds: number;
  /** Hourly cap per `subject` (02_SPEC_ENGINEERING.md #152) — independent of, and on top of, the per-request cooldown. */
  maxPerHour: number;
}

export type IssueCodeResult =
  | { status: "issued"; code: string; retryAfterSeconds: number }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "rate_limited"; retryAfterSeconds: number };

export type VerifyCodeResult = { status: "valid" } | { status: "invalid"; reason: "NOT_FOUND" | "MISMATCH" | "MAX_ATTEMPTS" };

interface StoredCode {
  hash: string;
  attempts: number;
}

/**
 * Generic "issue a short-lived code, verify it once" primitive shared by
 * phone OTP and email verification (01_SPEC_PRODUCT.md #68) — `namespace`
 * ("phone"/"email") keeps their Redis keys and cooldowns independent even
 * for the same user. Never persists the raw code, only its HMAC hash.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly rateLimit: RateLimitService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async issueCode(namespace: string, subject: string, options: IssueCodeOptions): Promise<IssueCodeResult> {
    const cooldownKey = this.cooldownKey(namespace, subject);
    const cooldownTtl = await this.redis.client.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      return { status: "cooldown", retryAfterSeconds: cooldownTtl };
    }

    const hourlyLimit = await this.rateLimit.consume(`otp-issue:${namespace}:${subject}`, options.maxPerHour, 3600);
    if (!hourlyLimit.allowed) {
      return { status: "rate_limited", retryAfterSeconds: hourlyLimit.retryAfterSeconds };
    }

    const code = generateVerificationCode(options.codeLength);
    const hash = hashVerificationCode(this.env.OTP_SECRET, subject, code);
    const record: StoredCode = { hash, attempts: 0 };

    await this.redis.client.set(this.codeKey(namespace, subject), JSON.stringify(record), "EX", options.ttlSeconds);
    await this.redis.client.set(cooldownKey, "1", "EX", options.cooldownSeconds);

    return { status: "issued", code, retryAfterSeconds: options.cooldownSeconds };
  }

  async verifyCode(namespace: string, subject: string, candidateCode: string, maxAttempts: number): Promise<VerifyCodeResult> {
    const codeKey = this.codeKey(namespace, subject);
    const raw = await this.redis.client.get(codeKey);
    if (!raw) {
      return { status: "invalid", reason: "NOT_FOUND" };
    }

    const record = JSON.parse(raw) as StoredCode;
    if (record.attempts >= maxAttempts) {
      await this.redis.client.del(codeKey);
      return { status: "invalid", reason: "MAX_ATTEMPTS" };
    }

    if (verifyCodeHash(this.env.OTP_SECRET, subject, candidateCode, record.hash)) {
      await this.redis.client.del(codeKey);
      return { status: "valid" };
    }

    const attempts = record.attempts + 1;
    if (attempts >= maxAttempts) {
      await this.redis.client.del(codeKey);
      return { status: "invalid", reason: "MAX_ATTEMPTS" };
    }

    const remainingTtl = await this.redis.client.ttl(codeKey);
    if (remainingTtl > 0) {
      await this.redis.client.set(codeKey, JSON.stringify({ ...record, attempts }), "EX", remainingTtl);
    }
    return { status: "invalid", reason: "MISMATCH" };
  }

  private codeKey(namespace: string, subject: string): string {
    return `otp:code:${namespace}:${subject}`;
  }

  private cooldownKey(namespace: string, subject: string): string {
    return `otp:cooldown:${namespace}:${subject}`;
  }
}
