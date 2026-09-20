import type { AvailabilitySlot, MatchingWeights } from "@fixiyi/contracts";
import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHING_CONFIG } from "../configuration/configuration.defaults.js";

import { computeScore, computeScoreBreakdown, coversMoment, rankCandidates, selectBatch, type RankingCandidate } from "./ranking.js";

const WEIGHTS: MatchingWeights = DEFAULT_MATCHING_CONFIG.weights;

// A Wednesday, 10:00 UTC.
const AT = new Date("2026-09-23T10:00:00.000Z");

function candidate(overrides: Partial<RankingCandidate> = {}): RankingCandidate {
  return {
    providerId: "p1",
    distanceKm: 5,
    experienceYears: 5,
    availability: [],
    verified: false,
    pastDispatchCount: 0,
    ...overrides,
  };
}

describe("computeScoreBreakdown", () => {
  it("scores a candidate at the centre 1 on distance and one at the radius edge 0", () => {
    const context = { radiusKm: 10, at: AT, maxPastDispatchCount: 0 };
    expect(computeScoreBreakdown(candidate({ distanceKm: 0 }), context).distance).toBe(1);
    expect(computeScoreBreakdown(candidate({ distanceKm: 10 }), context).distance).toBe(0);
    expect(computeScoreBreakdown(candidate({ distanceKm: 5 }), context).distance).toBeCloseTo(0.5, 6);
  });

  it("never returns a negative distance signal beyond the radius", () => {
    const breakdown = computeScoreBreakdown(candidate({ distanceKm: 40 }), { radiusKm: 10, at: AT, maxPastDispatchCount: 0 });
    expect(breakdown.distance).toBe(0);
  });

  it("saturates experience at 10 years", () => {
    const context = { radiusKm: 10, at: AT, maxPastDispatchCount: 0 };
    expect(computeScoreBreakdown(candidate({ experienceYears: 10 }), context).experience).toBe(1);
    expect(computeScoreBreakdown(candidate({ experienceYears: 25 }), context).experience).toBe(1);
    expect(computeScoreBreakdown(candidate({ experienceYears: null }), context).experience).toBe(0);
  });

  it("gives a never-dispatched provider the full exploration signal and the most-dispatched one zero", () => {
    const context = { radiusKm: 10, at: AT, maxPastDispatchCount: 8 };
    expect(computeScoreBreakdown(candidate({ pastDispatchCount: 0 }), context).exploration).toBe(1);
    expect(computeScoreBreakdown(candidate({ pastDispatchCount: 8 }), context).exploration).toBe(0);
    expect(computeScoreBreakdown(candidate({ pastDispatchCount: 4 }), context).exploration).toBeCloseTo(0.5, 6);
  });

  it("keeps the four data-less signals at zero (Decision 40 — no fabricated reputation or load)", () => {
    const breakdown = computeScoreBreakdown(candidate(), { radiusKm: 10, at: AT, maxPastDispatchCount: 0 });
    expect(breakdown.reputation).toBe(0);
    expect(breakdown.reliability).toBe(0);
    expect(breakdown.history).toBe(0);
    expect(breakdown.currentLoad).toBe(0);
  });
});

describe("coversMoment", () => {
  const wednesdayMorning: AvailabilitySlot = { dayOfWeek: 3, startMinute: 8 * 60, endMinute: 12 * 60 };

  it("treats an empty schedule as no declared restriction", () => {
    expect(coversMoment([], AT)).toBe(true);
  });

  it("matches a slot covering the moment", () => {
    expect(coversMoment([wednesdayMorning], AT)).toBe(true);
  });

  it("rejects the right hours on the wrong day", () => {
    expect(coversMoment([{ ...wednesdayMorning, dayOfWeek: 1 }], AT)).toBe(false);
  });

  it("rejects the right day outside the hours", () => {
    expect(coversMoment([{ dayOfWeek: 3, startMinute: 14 * 60, endMinute: 18 * 60 }], AT)).toBe(false);
  });

  it("treats the end minute as exclusive", () => {
    expect(coversMoment([{ dayOfWeek: 3, startMinute: 8 * 60, endMinute: 10 * 60 }], AT)).toBe(false);
    expect(coversMoment([{ dayOfWeek: 3, startMinute: 10 * 60, endMinute: 11 * 60 }], AT)).toBe(true);
  });
});

describe("computeScore", () => {
  it("is the weighted sum of the signals", () => {
    const breakdown = computeScoreBreakdown(candidate({ distanceKm: 0, verified: true, experienceYears: 10 }), {
      radiusKm: 10,
      at: AT,
      maxPastDispatchCount: 0,
    });
    // distance 1*0.4 + availability 1*0.2 + verification 1*0.2 + experience 1*0.1 + exploration 1*0.1
    expect(computeScore(breakdown, WEIGHTS)).toBeCloseTo(1, 6);
  });

  it("returns 0 when every signal is 0", () => {
    const breakdown = computeScoreBreakdown(
      candidate({ distanceKm: 10, experienceYears: null, availability: [{ dayOfWeek: 0, startMinute: 0, endMinute: 1 }] }),
      { radiusKm: 10, at: AT, maxPastDispatchCount: 5 },
    );
    const zeroExploration = { ...breakdown, exploration: 0 };
    expect(computeScore(zeroExploration, WEIGHTS)).toBe(0);
  });
});

describe("rankCandidates", () => {
  const context = { radiusKm: 20, at: AT, maxPastDispatchCount: 0 };

  it("puts the closest provider first, all else equal", () => {
    const ranked = rankCandidates(
      [candidate({ providerId: "far", distanceKm: 18 }), candidate({ providerId: "near", distanceKm: 2 })],
      context,
      WEIGHTS,
    );
    expect(ranked.map((entry) => entry.candidate.providerId)).toEqual(["near", "far"]);
  });

  it("ranks a verified provider above an unverified one at the same distance", () => {
    const ranked = rankCandidates(
      [candidate({ providerId: "plain", verified: false }), candidate({ providerId: "verified", verified: true })],
      context,
      WEIGHTS,
    );
    expect(ranked[0]?.candidate.providerId).toBe("verified");
  });

  it("is deterministic on a perfect tie", () => {
    const first = rankCandidates([candidate({ providerId: "b" }), candidate({ providerId: "a" })], context, WEIGHTS);
    const second = rankCandidates([candidate({ providerId: "a" }), candidate({ providerId: "b" })], context, WEIGHTS);
    expect(first.map((entry) => entry.candidate.providerId)).toEqual(second.map((entry) => entry.candidate.providerId));
  });
});

describe("selectBatch", () => {
  const context = { radiusKm: 20, at: AT, maxPastDispatchCount: 10 };

  it("never returns more than the batch size — dispatch is progressive, not a broadcast", () => {
    const ranked = rankCandidates(
      Array.from({ length: 12 }, (_, index) => candidate({ providerId: `p${index.toString()}`, distanceKm: index })),
      context,
      WEIGHTS,
    );
    expect(selectBatch(ranked, 3, 0)).toHaveLength(3);
  });

  it("reserves a seat for the least-dispatched provider even when it ranks below the cut", () => {
    const ranked = rankCandidates(
      [
        candidate({ providerId: "veteran-1", distanceKm: 1, pastDispatchCount: 10 }),
        candidate({ providerId: "veteran-2", distanceKm: 2, pastDispatchCount: 9 }),
        candidate({ providerId: "veteran-3", distanceKm: 3, pastDispatchCount: 8 }),
        candidate({ providerId: "newcomer", distanceKm: 19, pastDispatchCount: 0 }),
      ],
      context,
      WEIGHTS,
    );

    const withoutExploration = selectBatch(ranked, 3, 0).map((entry) => entry.candidate.providerId);
    expect(withoutExploration).not.toContain("newcomer");

    const withExploration = selectBatch(ranked, 3, 1).map((entry) => entry.candidate.providerId);
    expect(withExploration).toContain("newcomer");
    expect(withExploration).toHaveLength(3);
  });

  it("never gives every seat to exploration", () => {
    const ranked = rankCandidates(
      [candidate({ providerId: "a", pastDispatchCount: 5 }), candidate({ providerId: "b", pastDispatchCount: 0 })],
      context,
      WEIGHTS,
    );
    expect(selectBatch(ranked, 1, 5)).toHaveLength(1);
    expect(selectBatch(ranked, 1, 5)[0]?.candidate.providerId).toBe(ranked[0]?.candidate.providerId);
  });

  it("returns nothing when there is nobody to dispatch to", () => {
    expect(selectBatch([], 3, 1)).toHaveLength(0);
  });
});
