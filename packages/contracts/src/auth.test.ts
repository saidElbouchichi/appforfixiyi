import { describe, expect, it } from "vitest";

import { OtpRequestInputSchema, OtpVerifyInputSchema, RefreshInputSchema } from "./auth.js";

describe("OtpRequestInputSchema", () => {
  it("accepts a valid E.164 phone", () => {
    expect(OtpRequestInputSchema.safeParse({ phone: "+212612345678" }).success).toBe(true);
  });

  it("rejects a non-E.164 phone", () => {
    expect(OtpRequestInputSchema.safeParse({ phone: "0612345678" }).success).toBe(false);
  });
});

describe("OtpVerifyInputSchema", () => {
  it("accepts a valid phone + numeric code, device optional", () => {
    expect(OtpVerifyInputSchema.safeParse({ phone: "+212612345678", code: "123456" }).success).toBe(true);
    expect(
      OtpVerifyInputSchema.safeParse({
        phone: "+212612345678",
        code: "123456",
        device: { id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab", name: "Pixel 8" },
      }).success,
    ).toBe(true);
  });

  it("rejects a non-numeric or wrong-length code", () => {
    expect(OtpVerifyInputSchema.safeParse({ phone: "+212612345678", code: "abcdef" }).success).toBe(false);
    expect(OtpVerifyInputSchema.safeParse({ phone: "+212612345678", code: "12" }).success).toBe(false);
  });
});

describe("RefreshInputSchema", () => {
  it("allows an empty body (web relies on the cookie)", () => {
    expect(RefreshInputSchema.safeParse({}).success).toBe(true);
  });

  it("accepts an explicit refreshToken for a future mobile client", () => {
    expect(RefreshInputSchema.safeParse({ refreshToken: "abc.def.ghi" }).success).toBe(true);
  });
});
