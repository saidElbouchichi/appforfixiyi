import { z } from "zod";

import { CurrencySchema, IsoDateTimeSchema, NonNegativeMoneyAmountSchema } from "./common.js";

/**
 * 01_SPEC_PRODUCT.md #97 — every important business rule must be
 * administrable, never hardcoded in a component. This is the typed,
 * validated shape of that configuration; `apps/api/src/configuration/`
 * stores a single seeded document and exposes it read-only to the engine
 * and read/write to ADMIN/MANAGER.
 */

/**
 * Relative weights of the ranking signals (01_SPEC_PRODUCT.md #14).
 *
 * The last four are deliberately kept at 0 in the seeded defaults: no real
 * data backs them yet (`Review`/`ReputationSnapshot` arrive in Phase 10,
 * `Intervention` in Phase 8). They exist in the schema so activating them
 * later is a configuration change, not a contract change — inventing a
 * score for them today would be fabricated data (03_AGENT_PROTOCOL.md #2).
 */
export const MatchingWeightsSchema = z.object({
  /** Proximity, normalised against the current search radius. */
  distance: z.number().min(0).max(1),
  /** Declared weekly availability covering the moment of dispatch. */
  availability: z.number().min(0).max(1),
  /** Verified provider vs. unverified (Phase 3 `VerificationCase`). */
  verificationLevel: z.number().min(0).max(1),
  experience: z.number().min(0).max(1),
  /** Positive discrimination for providers who have received few dispatches (01_SPEC_PRODUCT.md #15). */
  exploration: z.number().min(0).max(1),
  /** Phase 10 — no `Review` data yet. */
  reputation: z.number().min(0).max(1),
  /** Phase 10 — no completion/cancellation history yet. */
  reliability: z.number().min(0).max(1),
  /** Phase 10 — no past-intervention history with this client yet. */
  history: z.number().min(0).max(1),
  /** Phase 8 — no `Intervention` to measure current load from yet. */
  currentLoad: z.number().min(0).max(1),
});
export type MatchingWeights = z.infer<typeof MatchingWeightsSchema>;

export const MatchingConfigSchema = z.object({
  weights: MatchingWeightsSchema,
  /** 01_SPEC_PRODUCT.md #18 — radius proposed automatically, then expanded. */
  defaultRadiusKm: z.number().positive().max(500),
  maxRadiusKm: z.number().positive().max(500),
  radiusExpansionStepKm: z.number().positive().max(500),
  /** 01_SPEC_PRODUCT.md #15 — never dispatch to every provider at once. */
  batchSize: z.number().int().positive().max(50),
  batchWaitSeconds: z.number().int().positive(),
  /** `urgentMatchingRules` (01_SPEC_PRODUCT.md #97): a bigger batch, dispatched faster. */
  urgentBatchSize: z.number().int().positive().max(50),
  urgentBatchWaitSeconds: z.number().int().positive(),
  /** Seats per batch reserved for low-exposure providers, so ranking cannot permanently lock them out. */
  explorationSlotsPerBatch: z.number().int().min(0).max(10),
  /**
   * Hard filter rather than a weight when enabled. Note the complexity's
   * `requiredSkillIds` are ALWAYS a hard filter (a missing certification is
   * a safety issue, not a ranking penalty — Decision 41), which is why
   * there is no "skill coverage" weight.
   */
  requireVerifiedProvider: z.boolean(),
  maxBatchesPerMatch: z.number().int().positive().max(50),
  /** How long a dispatched candidate stays actionable before expiring. */
  candidateExpirySeconds: z.number().int().positive(),
});
export type MatchingConfig = z.infer<typeof MatchingConfigSchema>;

/** 01_SPEC_PRODUCT.md #18/#19 — free inside the radius, low configurable fee beyond; the provider never sets it. */
export const TransportConfigSchema = z.object({
  freeRadiusKm: z.number().nonnegative().max(500),
  perKmAmountMinor: NonNegativeMoneyAmountSchema,
  maxFeeAmountMinor: NonNegativeMoneyAmountSchema,
  currency: CurrencySchema,
  /** Feeds the travel-time estimate while no routing provider is configured (`MAP_PROVIDER=dev`). */
  averageSpeedKmh: z.number().positive().max(200),
});
export type TransportConfig = z.infer<typeof TransportConfigSchema>;

export const SystemConfigurationSchema = z.object({
  matching: MatchingConfigSchema,
  transport: TransportConfigSchema,
  /** Who last changed it — the minimum accountability trace until `AuditLog` exists (Phase 10/12). */
  updatedBy: z.string().nullable(),
  updatedAt: IsoDateTimeSchema,
});
export type SystemConfiguration = z.infer<typeof SystemConfigurationSchema>;

export const UpdateSystemConfigurationInputSchema = z
  .object({
    matching: MatchingConfigSchema.partial()
      .extend({ weights: MatchingWeightsSchema.partial().optional() })
      .optional(),
    transport: TransportConfigSchema.partial().optional(),
  })
  .refine((input) => input.matching !== undefined || input.transport !== undefined, {
    message: "At least one of matching/transport must be provided",
  });
export type UpdateSystemConfigurationInput = z.infer<typeof UpdateSystemConfigurationInputSchema>;
