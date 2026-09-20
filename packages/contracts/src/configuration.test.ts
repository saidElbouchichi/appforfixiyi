import { describe, expect, it } from "vitest";

import { MatchingWeightsSchema, UpdateSystemConfigurationInputSchema } from "./configuration.js";
import { PROVIDER_SELF_SETTABLE_STATUSES, ProviderAvailabilityStatusSchema, UpdateProviderAvailabilityInputSchema } from "./provider.js";

describe("MatchingWeightsSchema", () => {
  it("rejects a weight outside [0,1]", () => {
    const base = {
      distance: 0.4,
      availability: 0.2,
      verificationLevel: 0.2,
      experience: 0.1,
      exploration: 0.1,
      reputation: 0,
      reliability: 0,
      history: 0,
      currentLoad: 0,
    };
    expect(MatchingWeightsSchema.safeParse(base).success).toBe(true);
    expect(MatchingWeightsSchema.safeParse({ ...base, distance: 1.2 }).success).toBe(false);
    expect(MatchingWeightsSchema.safeParse({ ...base, distance: -0.1 }).success).toBe(false);
  });

  it("still carries the four signals that have no data yet, so enabling them later is a config change", () => {
    const keys = Object.keys(MatchingWeightsSchema.shape);
    expect(keys).toContain("reputation");
    expect(keys).toContain("reliability");
    expect(keys).toContain("history");
    expect(keys).toContain("currentLoad");
  });
});

describe("UpdateSystemConfigurationInputSchema", () => {
  it("accepts a partial update of a single weight", () => {
    expect(UpdateSystemConfigurationInputSchema.safeParse({ matching: { weights: { distance: 0.5 } } }).success).toBe(true);
  });

  it("accepts a partial transport update", () => {
    expect(UpdateSystemConfigurationInputSchema.safeParse({ transport: { freeRadiusKm: 12 } }).success).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(UpdateSystemConfigurationInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("ProviderAvailabilityStatus", () => {
  it("covers the seven statuses of 01_SPEC_PRODUCT.md #16", () => {
    expect(ProviderAvailabilityStatusSchema.options).toHaveLength(7);
  });

  it("only lets a provider set the four statuses no intervention drives", () => {
    for (const status of PROVIDER_SELF_SETTABLE_STATUSES) {
      expect(UpdateProviderAvailabilityInputSchema.safeParse({ status }).success).toBe(true);
    }
    for (const status of ["ON_THE_WAY", "ARRIVED", "IN_SERVICE"]) {
      expect(UpdateProviderAvailabilityInputSchema.safeParse({ status }).success).toBe(false);
    }
  });
});
