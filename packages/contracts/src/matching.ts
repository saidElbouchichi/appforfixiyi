import { z } from "zod";

import { GeoPointSchema, IdSchema, IsoDateTimeSchema } from "./common.js";
import { RequestUrgencySchema } from "./request.js";
import { TransportQuoteSchema } from "./transport.js";

/** 01_SPEC_PRODUCT.md #14 — hybrid matching: the client picks a provider (DIRECT) or Fixiyi searches (AUTO). */
export const MatchModeSchema = z.enum(["AUTO", "DIRECT"]);
export type MatchMode = z.infer<typeof MatchModeSchema>;

/**
 * No "succeeded" state in Phase 5: a provider answering a dispatch means
 * making an `Offer`, which does not exist before Phase 7. A match is either
 * still running, out of candidates, or cancelled with its request.
 */
export const MatchStatusSchema = z.enum(["ACTIVE", "EXHAUSTED", "CANCELLED"]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const MatchCandidateStatusSchema = z.enum(["NOTIFIED", "VIEWED", "DECLINED", "EXPIRED"]);
export type MatchCandidateStatus = z.infer<typeof MatchCandidateStatusSchema>;

/**
 * Raw, normalised [0,1] signals behind a candidate's score — stored and
 * exposed so a ranking can be audited instead of taken on faith. The last
 * four are structurally present but always 0 today (see
 * `MatchingWeightsSchema`).
 */
export const ScoreBreakdownSchema = z.object({
  distance: z.number().min(0).max(1),
  availability: z.number().min(0).max(1),
  verificationLevel: z.number().min(0).max(1),
  experience: z.number().min(0).max(1),
  exploration: z.number().min(0).max(1),
  reputation: z.number().min(0).max(1),
  reliability: z.number().min(0).max(1),
  history: z.number().min(0).max(1),
  currentLoad: z.number().min(0).max(1),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const MatchSchema = z.object({
  id: IdSchema,
  requestId: IdSchema,
  clientUserId: IdSchema,
  mode: MatchModeSchema,
  status: MatchStatusSchema,
  currentRadiusKm: z.number().positive(),
  batchCount: z.number().int().nonnegative(),
  /** Total providers contacted so far, across every batch. */
  candidateCount: z.number().int().nonnegative(),
  /** When the next batch is due — `null` once the match is terminal. */
  nextBatchAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Match = z.infer<typeof MatchSchema>;

/** Client-facing view of who was contacted — scores included, so the client can see the matching is not arbitrary. */
export const MatchCandidateSchema = z.object({
  id: IdSchema,
  matchId: IdSchema,
  providerId: IdSchema,
  providerDisplayName: z.string(),
  batchIndex: z.number().int().nonnegative(),
  status: MatchCandidateStatusSchema,
  score: z.number().min(0),
  scoreBreakdown: ScoreBreakdownSchema,
  distanceKm: z.number().nonnegative(),
  declineReason: z.string().nullable(),
  dispatchedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
});
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;

export const DispatchBatchSchema = z.object({
  id: IdSchema,
  matchId: IdSchema,
  index: z.number().int().nonnegative(),
  radiusKm: z.number().positive(),
  candidateCount: z.number().int().nonnegative(),
  dispatchedAt: IsoDateTimeSchema,
});
export type DispatchBatch = z.infer<typeof DispatchBatchSchema>;

/**
 * Provider-facing view of a dispatch — deliberately NOT `MatchCandidate`:
 * no score, no other candidate, and above all only the APPROXIMATE
 * location (01_SPEC_PRODUCT.md #17 — the exact address is released after
 * acceptance, which does not exist before Phase 7/8).
 */
export const ProviderMatchSchema = z.object({
  candidateId: IdSchema,
  matchId: IdSchema,
  requestId: IdSchema,
  status: MatchCandidateStatusSchema,
  serviceId: IdSchema,
  interventionTypeId: IdSchema,
  complexityId: IdSchema,
  description: z.string(),
  urgency: RequestUrgencySchema,
  approximateLocation: GeoPointSchema,
  distanceKm: z.number().nonnegative(),
  transportQuote: TransportQuoteSchema,
  mediaCount: z.number().int().nonnegative(),
  dispatchedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
});
export type ProviderMatch = z.infer<typeof ProviderMatchSchema>;

export const StartMatchInputSchema = z
  .object({
    mode: MatchModeSchema.optional(),
    /** Required when `mode` is DIRECT — the provider the client picked themselves. */
    providerId: IdSchema.optional(),
  })
  .refine((input) => input.mode !== "DIRECT" || input.providerId !== undefined, {
    message: "providerId is required when mode is DIRECT",
  });
export type StartMatchInput = z.infer<typeof StartMatchInputSchema>;

/** 01_SPEC_PRODUCT.md #18 — the client may widen the search themselves, on top of automatic expansion. */
export const ExpandRadiusInputSchema = z.object({
  radiusKm: z.number().positive().max(500),
});
export type ExpandRadiusInput = z.infer<typeof ExpandRadiusInputSchema>;

export const DeclineMatchInputSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type DeclineMatchInput = z.infer<typeof DeclineMatchInputSchema>;
