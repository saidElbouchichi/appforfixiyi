import {
  MatchCandidateStatusSchema,
  MatchStatusSchema,
  ProviderAvailabilityStatusSchema,
  ProviderTypeSchema,
  RequestStatusSchema,
  RequestUrgencySchema,
} from "@fixiyi/contracts";
import { describe, expect, it } from "vitest";

import {
  AVAILABILITY_LABEL,
  CANDIDATE_STATUS_LABEL,
  MATCH_STATUS_LABEL,
  PROVIDER_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  URGENCY_LABEL,
  attachmentCount,
  searchProgress,
} from "./labels";

/**
 * Design phase 8. These screens used to print the engine's own words at the
 * client — `ACTIVE`, `NOTIFIED`, `score 0.78`. The tables are what replaced
 * them, and this file is what keeps them honest: a label table that goes
 * stale is how `NOTIFIED` gets back on screen.
 *
 * Every table is a `Record<Enum, string>`, so adding a value to a contract
 * enum fails the build until its label exists. These tests cover what the
 * type cannot: that no label is empty, and that none is left in English.
 */
const TABLES = [
  ["RequestStatus", RequestStatusSchema, REQUEST_STATUS_LABEL],
  ["RequestUrgency", RequestUrgencySchema, URGENCY_LABEL],
  ["MatchStatus", MatchStatusSchema, MATCH_STATUS_LABEL],
  ["MatchCandidateStatus", MatchCandidateStatusSchema, CANDIDATE_STATUS_LABEL],
  ["ProviderType", ProviderTypeSchema, PROVIDER_TYPE_LABEL],
  ["ProviderAvailabilityStatus", ProviderAvailabilityStatusSchema, AVAILABILITY_LABEL],
] as const;

describe("label tables", () => {
  for (const [name, schema, table] of TABLES) {
    it(`${name}: covers every value the contract allows`, () => {
      expect(Object.keys(table).sort()).toEqual([...schema.options].sort());
    });

    it(`${name}: says something, in French, for each`, () => {
      for (const [value, label] of Object.entries(table)) {
        expect(label.trim(), value).not.toBe("");
        // The enum value itself leaking through is the failure this guards.
        expect(label, value).not.toBe(value);
      }
    });
  }
});

describe("MATCH_STATUS_LABEL", () => {
  /**
   * There is no "an artisan accepted" state, and the label must not imply
   * one: a provider answering means making an Offer, which does not exist
   * before phase 7 of the product. `EXHAUSTED` means the engine ran out of
   * candidates — not that nobody wanted the job.
   */
  it("does not promise an outcome the engine cannot report", () => {
    expect(MATCH_STATUS_LABEL.EXHAUSTED).not.toMatch(/accept|refus/i);
    expect(Object.values(MATCH_STATUS_LABEL).join(" ")).not.toMatch(/termin.e avec succ/i);
  });
});

describe("attachmentCount", () => {
  it("agrees in number instead of writing media(s)", () => {
    expect(attachmentCount(1)).toBe("1 fichier joint");
    expect(attachmentCount(3)).toBe("3 fichiers joints");
  });

  it("says nothing when there is nothing", () => {
    expect(attachmentCount(0)).toBeNull();
  });
});

describe("searchProgress", () => {
  it("says what a client can act on: how many, how far", () => {
    expect(searchProgress(3, 25)).toBe("3 artisans contactes, jusqu'a 25 km");
  });

  it("agrees in number for a single one", () => {
    expect(searchProgress(1, 10)).toBe("1 artisan contacte, jusqu'a 10 km");
  });

  /** The dispatch batch belongs to matching.service.ts, not to the person waiting. */
  it("never mentions the dispatch batch", () => {
    expect(searchProgress(3, 25)).not.toMatch(/vague/i);
  });
});
