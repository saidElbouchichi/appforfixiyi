import { describe, expect, it } from "vitest";

import { logLevelsFor } from "./log-levels.js";

/** Decision 75 — `LOG_LEVEL` was validated and then ignored; these are what make it bite. */
describe("logLevelsFor", () => {
  it("opens everything at debug", () => {
    expect(logLevelsFor("debug")).toContain("verbose");
    expect(logLevelsFor("debug")).toContain("debug");
  });

  it("drops debug and verbose at info", () => {
    const levels = logLevelsFor("info");
    expect(levels).toContain("log");
    expect(levels).not.toContain("debug");
    expect(levels).not.toContain("verbose");
  });

  it("keeps only warnings and worse at warn", () => {
    expect(logLevelsFor("warn")).toEqual(["fatal", "error", "warn"]);
  });

  it("narrows to failures at error", () => {
    expect(logLevelsFor("error")).toEqual(["fatal", "error"]);
  });

  it("never hides fatal, whatever the setting — a quiet log is not a silent death", () => {
    for (const setting of ["debug", "info", "warn", "error"] as const) {
      expect(logLevelsFor(setting), setting).toContain("fatal");
    }
  });

  it("only ever narrows as the setting rises", () => {
    const sizes = (["debug", "info", "warn", "error"] as const).map((setting) => logLevelsFor(setting).length);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });
});
