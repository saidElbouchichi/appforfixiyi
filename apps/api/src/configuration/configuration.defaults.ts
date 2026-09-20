import type { MatchingConfig, TransportConfig } from "@fixiyi/contracts";

/**
 * Seeded once (`SeedLockService`) then owned by ADMIN/MANAGER through
 * `PATCH /configuration` — 01_SPEC_PRODUCT.md #97 forbids hardcoding these
 * rules in the components that apply them.
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  /**
   * The five signals with real data sum to 1. The other four stay at 0
   * until the aggregates that feed them exist (Decision 40): reputation /
   * reliability / history need `Review` (Phase 10), currentLoad needs
   * `Intervention` (Phase 8).
   */
  weights: {
    distance: 0.4,
    availability: 0.2,
    verificationLevel: 0.2,
    experience: 0.1,
    exploration: 0.1,
    reputation: 0,
    reliability: 0,
    history: 0,
    currentLoad: 0,
  },
  defaultRadiusKm: 10,
  maxRadiusKm: 50,
  radiusExpansionStepKm: 10,
  batchSize: 3,
  batchWaitSeconds: 120,
  urgentBatchSize: 5,
  urgentBatchWaitSeconds: 45,
  explorationSlotsPerBatch: 1,
  requireVerifiedProvider: false,
  maxBatchesPerMatch: 5,
  candidateExpirySeconds: 900,
};

/** Free inside the default radius, then 2.50 MAD/km capped at 50 MAD (integer minor units — Decision 2). */
export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  freeRadiusKm: 10,
  perKmAmountMinor: 250,
  maxFeeAmountMinor: 5000,
  currency: "MAD",
  averageSpeedKmh: 30,
};
