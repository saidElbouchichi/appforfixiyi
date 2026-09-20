import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Shared by phone OTP and email verification (01_SPEC_PRODUCT.md #68) — both
 * are "send a short numeric code, store only its hash, check it once" flows.
 * Never store or log the raw code (02_SPEC_ENGINEERING.md #178).
 *
 * Lives here (not in @fixiyi/shared-utils) because it's Node-only
 * (`node:crypto`) and has a single consumer (this module) — @fixiyi/shared-utils
 * is also imported by the browser-bundled apps/web and apps/admin.
 */

/** Cryptographically-random numeric code, zero-padded to `length` digits. */
export function generateVerificationCode(length = 6): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, "0");
}

/**
 * HMAC-SHA256 of `code`, keyed by `secret` and bound to `subject` (the phone
 * number or email the code was issued for) so a leaked hash can't be replayed
 * against a different subject.
 */
export function hashVerificationCode(secret: string, subject: string, code: string): string {
  return createHmac("sha256", secret).update(`${subject}:${code}`).digest("hex");
}

/** Constant-time comparison of a candidate code against the stored hash. */
export function verifyCodeHash(secret: string, subject: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashVerificationCode(secret, subject, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
