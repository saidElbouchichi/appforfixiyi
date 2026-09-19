import { describe, expect, it } from "vitest";

import { OfferSchema } from "./offer.js";

const validOffer = {
  id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
  requestId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ac",
  providerId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ad",
  serviceAmount: 25000,
  transportAmount: 3000,
  materialsAmount: 0,
  totalAmount: 28000,
  currency: "MAD",
  estimatedDurationMinutes: 90,
  validityUntil: "2026-09-20T10:00:00.000Z",
  status: "SUBMITTED",
  version: 1,
  createdAt: "2026-09-19T10:00:00.000Z",
  updatedAt: "2026-09-19T10:00:00.000Z",
};

describe("OfferSchema", () => {
  it("parses a valid offer and defaults optional arrays", () => {
    const result = OfferSchema.parse(validOffer);
    expect(result.inclusions).toEqual([]);
    expect(result.exclusions).toEqual([]);
  });

  it("rejects a negative amount", () => {
    expect(() => OfferSchema.parse({ ...validOffer, serviceAmount: -1 })).toThrow();
  });

  it("rejects a non-integer amount (no floating money — 02_SPEC_ENGINEERING.md #173)", () => {
    expect(() => OfferSchema.parse({ ...validOffer, serviceAmount: 250.5 })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => OfferSchema.parse({ ...validOffer, status: "MADE_UP" })).toThrow();
  });
});
