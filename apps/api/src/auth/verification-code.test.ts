import { describe, expect, it } from "vitest";

import { generateVerificationCode, hashVerificationCode, verifyCodeHash } from "./verification-code.js";

describe("verification-code", () => {
  it("generates zero-padded numeric codes of the requested length", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateVerificationCode(6)).toMatch(/^\d{6}$/);
    }
  });

  it("supports a custom length", () => {
    expect(generateVerificationCode(4)).toMatch(/^\d{4}$/);
  });

  it("hashes deterministically for the same secret/subject/code", () => {
    const a = hashVerificationCode("secret", "+212600000000", "123456");
    const b = hashVerificationCode("secret", "+212600000000", "123456");
    expect(a).toBe(b);
  });

  it("produces a different hash for a different subject (no cross-subject replay)", () => {
    const a = hashVerificationCode("secret", "+212600000000", "123456");
    const b = hashVerificationCode("secret", "+212611111111", "123456");
    expect(a).not.toBe(b);
  });

  it("produces a different hash for a different secret", () => {
    const a = hashVerificationCode("secret-a", "+212600000000", "123456");
    const b = hashVerificationCode("secret-b", "+212600000000", "123456");
    expect(a).not.toBe(b);
  });

  it("verifyCodeHash accepts the correct code and rejects a wrong one", () => {
    const hash = hashVerificationCode("secret", "+212600000000", "123456");
    expect(verifyCodeHash("secret", "+212600000000", "123456", hash)).toBe(true);
    expect(verifyCodeHash("secret", "+212600000000", "000000", hash)).toBe(false);
  });

  it("verifyCodeHash rejects a malformed/short stored hash without throwing", () => {
    expect(verifyCodeHash("secret", "+212600000000", "123456", "not-a-hash")).toBe(false);
  });
});
