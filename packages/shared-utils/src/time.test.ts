import { describe, expect, it } from "vitest";

import { calculateAgeYears, diffMillis, isValidIsoDateTime, nowIso, toIsoString } from "./time.js";

describe("time", () => {
  it("nowIso returns a valid ISO-8601 UTC string", () => {
    const value = nowIso();
    expect(isValidIsoDateTime(value)).toBe(true);
    expect(value.endsWith("Z")).toBe(true);
  });

  it("toIsoString round-trips a Date", () => {
    const date = new Date("2026-01-15T10:30:00.000Z");
    expect(toIsoString(date)).toBe("2026-01-15T10:30:00.000Z");
  });

  it("rejects invalid date strings", () => {
    expect(isValidIsoDateTime("not-a-date")).toBe(false);
  });

  it("computes millisecond differences", () => {
    expect(diffMillis("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z")).toBe(1000);
  });

  it("calculateAgeYears counts whole years, respecting the birthday not yet reached this year", () => {
    expect(calculateAgeYears("2008-09-20T00:00:00.000Z", "2026-09-20T00:00:00.000Z")).toBe(18);
    expect(calculateAgeYears("2008-09-21T00:00:00.000Z", "2026-09-20T00:00:00.000Z")).toBe(17);
    expect(calculateAgeYears("2008-09-19T00:00:00.000Z", "2026-09-20T00:00:00.000Z")).toBe(18);
  });

  it("calculateAgeYears defaults `at` to now", () => {
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setUTCFullYear(eighteenYearsAgo.getUTCFullYear() - 18);
    expect(calculateAgeYears(eighteenYearsAgo.toISOString())).toBe(18);
  });
});
