import { describe, expect, it } from "vitest";

import { IdSchema, IsoDateTimeSchema, MoneySchema, ProblemDetailsSchema } from "./common.js";

describe("common schemas", () => {
  it("IdSchema accepts a UUID and rejects arbitrary strings", () => {
    expect(IdSchema.safeParse("018f5b0a-6e2a-7c3d-9b1a-1234567890ab").success).toBe(true);
    expect(IdSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("IsoDateTimeSchema accepts ISO-8601 UTC and rejects a plain date", () => {
    expect(IsoDateTimeSchema.safeParse("2026-09-19T10:00:00.000Z").success).toBe(true);
    expect(IsoDateTimeSchema.safeParse("2026-09-19").success).toBe(false);
  });

  it("MoneySchema enforces integer amountMinor and 3-letter currency", () => {
    expect(MoneySchema.safeParse({ amountMinor: 30000, currency: "MAD" }).success).toBe(true);
    expect(MoneySchema.safeParse({ amountMinor: 300.5, currency: "MAD" }).success).toBe(false);
    expect(MoneySchema.safeParse({ amountMinor: 30000, currency: "DH" }).success).toBe(false);
  });

  it("ProblemDetailsSchema matches the 02_SPEC_ENGINEERING.md #62 error format", () => {
    const result = ProblemDetailsSchema.safeParse({
      type: "https://fixiyi.app/errors/offer-already-accepted",
      title: "Offer already accepted",
      status: 409,
      code: "OFFER_ALREADY_ACCEPTED",
      detail: "This offer has already been accepted by another client.",
      traceId: "01HXYZ",
    });
    expect(result.success).toBe(true);
  });
});
