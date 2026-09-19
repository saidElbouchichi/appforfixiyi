import { describe, expect, it } from "vitest";

import { breakpoints, colors, radius, spacing } from "./tokens.js";

const hexColor = /^#[0-9a-f]{6}$/i;

describe("design tokens", () => {
  it("every color is a valid 6-digit hex value", () => {
    for (const scale of Object.values(colors)) {
      for (const value of Object.values(scale)) {
        expect(value).toMatch(hexColor);
      }
    }
  });

  it("spacing scale is monotonically increasing", () => {
    const values = Object.values(spacing).map((v) => Number.parseInt(v, 10));
    for (let i = 1; i < values.length; i += 1) {
      const previous = values[i - 1] ?? Number.NaN;
      const current = values[i] ?? Number.NaN;
      expect(current).toBeGreaterThan(previous);
    }
  });

  it("radius and breakpoint tokens are defined", () => {
    expect(radius.md).toBe("8px");
    expect(breakpoints.md).toBe("768px");
  });
});
