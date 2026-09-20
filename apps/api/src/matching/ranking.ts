import type { AvailabilitySlot, MatchingWeights, ScoreBreakdown } from "@fixiyi/contracts";

/** Years of experience beyond which the signal stops growing — a 20-year veteran is not twice a 10-year one. */
const EXPERIENCE_SATURATION_YEARS = 10;

export interface RankingCandidate {
  providerId: string;
  distanceKm: number;
  experienceYears: number | null;
  availability: AvailabilitySlot[];
  verified: boolean;
  /** How many times this provider has already been dispatched to, all matches included. */
  pastDispatchCount: number;
}

export interface RankingContext {
  radiusKm: number;
  at: Date;
  /** Highest `pastDispatchCount` in the pool — the normalisation reference for the exploration signal. */
  maxPastDispatchCount: number;
}

/**
 * Pure ranking (01_SPEC_PRODUCT.md #14/#15). No Mongo, no clock, no
 * randomness: every input is explicit, so the ordering is reproducible and
 * genuinely unit-testable.
 *
 * There is no skill signal here on purpose: a complexity's
 * `requiredSkillIds` are a hard eligibility filter, not a ranking penalty
 * (Decision 41). Candidates reaching this function already hold them.
 */
export function computeScoreBreakdown(candidate: RankingCandidate, context: RankingContext): ScoreBreakdown {
  return {
    distance: normaliseDistance(candidate.distanceKm, context.radiusKm),
    availability: coversMoment(candidate.availability, context.at) ? 1 : 0,
    verificationLevel: candidate.verified ? 1 : 0,
    experience: Math.min(1, (candidate.experienceYears ?? 0) / EXPERIENCE_SATURATION_YEARS),
    exploration: normaliseExploration(candidate.pastDispatchCount, context.maxPastDispatchCount),
    // 01_SPEC_PRODUCT.md #14 signals with no aggregate to read from yet (Decision 40).
    reputation: 0,
    reliability: 0,
    history: 0,
    currentLoad: 0,
  };
}

export function computeScore(breakdown: ScoreBreakdown, weights: MatchingWeights): number {
  let score = 0;
  for (const key of Object.keys(breakdown) as (keyof ScoreBreakdown)[]) {
    score += breakdown[key] * weights[key];
  }
  return score;
}

/** Closest gets 1, a candidate at the edge of the radius gets 0. */
function normaliseDistance(distanceKm: number, radiusKm: number): number {
  if (radiusKm <= 0) {
    return 0;
  }
  return Math.max(0, 1 - Math.min(1, distanceKm / radiusKm));
}

/**
 * A provider nobody has dispatched to yet scores 1, the most-dispatched
 * provider in the pool scores 0 — 01_SPEC_PRODUCT.md #15 explicitly
 * requires avoiding permanent domination by established providers.
 */
function normaliseExploration(pastDispatchCount: number, maxPastDispatchCount: number): number {
  if (maxPastDispatchCount <= 0) {
    return 1;
  }
  return Math.max(0, 1 - Math.min(1, pastDispatchCount / maxPastDispatchCount));
}

/**
 * Declared weekly availability covering `at` (UTC). An empty schedule means
 * "no declared restriction", not "never available": `availability` is
 * optional in Phase 3's profile and most providers have none, so treating
 * empty as 0 would turn this signal into noise. Whether a provider is
 * taking work *right now* is the separate `availabilityStatus` hard filter.
 */
export function coversMoment(slots: AvailabilitySlot[], at: Date): boolean {
  if (slots.length === 0) {
    return true;
  }
  const dayOfWeek = at.getUTCDay();
  const minuteOfDay = at.getUTCHours() * 60 + at.getUTCMinutes();

  return slots.some((slot) => slot.dayOfWeek === dayOfWeek && minuteOfDay >= slot.startMinute && minuteOfDay < slot.endMinute);
}

/**
 * Highest score first, provider id as a deterministic tie-break so two runs
 * over identical data never disagree on the order.
 */
export function rankCandidates(
  candidates: RankingCandidate[],
  context: RankingContext,
  weights: MatchingWeights,
): { candidate: RankingCandidate; breakdown: ScoreBreakdown; score: number }[] {
  return candidates
    .map((candidate) => {
      const breakdown = computeScoreBreakdown(candidate, context);
      return { candidate, breakdown, score: computeScore(breakdown, weights) };
    })
    .sort((a, b) => b.score - a.score || a.candidate.providerId.localeCompare(b.candidate.providerId));
}

/**
 * Takes the top `batchSize`, but reserves `explorationSlots` of them for the
 * least-dispatched providers (01_SPEC_PRODUCT.md #15 — a new provider must
 * be able to enter a batch even when ranked below established ones).
 */
export function selectBatch<T extends { candidate: RankingCandidate; score: number }>(
  ranked: T[],
  batchSize: number,
  explorationSlots: number,
): T[] {
  if (batchSize <= 0 || ranked.length === 0) {
    return [];
  }
  const reserved = Math.min(explorationSlots, Math.max(0, batchSize - 1));
  const meritCount = batchSize - reserved;

  const selected = ranked.slice(0, meritCount);
  if (reserved === 0) {
    return selected;
  }

  const selectedIds = new Set(selected.map((entry) => entry.candidate.providerId));
  const explorers = ranked
    .filter((entry) => !selectedIds.has(entry.candidate.providerId))
    .sort(
      (a, b) =>
        a.candidate.pastDispatchCount - b.candidate.pastDispatchCount ||
        b.score - a.score ||
        a.candidate.providerId.localeCompare(b.candidate.providerId),
    )
    .slice(0, reserved);

  return [...selected, ...explorers];
}
