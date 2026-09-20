import { describe, expect, it } from "vitest";

import { MatchStatusSchema, StartMatchInputSchema } from "./matching.js";

const A_UUID = "018f5b0a-6e2a-7c3d-9b1a-1234567890ab";

describe("StartMatchInputSchema", () => {
  it("accepts an empty body (AUTO is the default mode)", () => {
    expect(StartMatchInputSchema.safeParse({}).success).toBe(true);
  });

  it("requires a providerId in DIRECT mode (01_SPEC_PRODUCT.md #14, mode A)", () => {
    expect(StartMatchInputSchema.safeParse({ mode: "DIRECT" }).success).toBe(false);
    expect(StartMatchInputSchema.safeParse({ mode: "DIRECT", providerId: A_UUID }).success).toBe(true);
  });

  it("does not require a providerId in AUTO mode", () => {
    expect(StartMatchInputSchema.safeParse({ mode: "AUTO" }).success).toBe(true);
  });
});

describe("MatchStatusSchema", () => {
  it("has no success state — a provider answering means an Offer, which is Phase 7", () => {
    expect(MatchStatusSchema.options).toEqual(["ACTIVE", "EXHAUSTED", "CANCELLED"]);
  });
});
