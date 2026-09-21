import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { breakpoints, colors, motion, radius, shadows, spacing, typography, zIndex } from "./tokens.js";

const hexColor = /^#[0-9a-f]{6}$/i;

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");

/** Every `--fixiyi-*: value;` declaration in tokens.css, as a name -> value map. */
const cssTokens = new Map(
  [...css.matchAll(/(--fixiyi-[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [match[1] ?? "", (match[2] ?? "").trim().replace(/\s+/g, " ")]),
);

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

/**
 * tokens.ts and tokens.css are two hand-written copies of one truth. Phase 1
 * flagged the drift risk and deferred it; the drift then happened (spacing,
 * shadows, typography, z-index and easing were in tokens.ts and absent from
 * tokens.css, so styles.css hard-coded shadows and font sizes instead).
 *
 * These tests are the cheap version of a generator: they parse the real CSS
 * file and assert both directions, so adding a token to one side without the
 * other fails the build rather than rotting silently.
 *
 * `breakpoints` is deliberately excluded: CSS custom properties cannot be
 * used inside `@media` queries, so exposing them as variables would advertise
 * something that does not work. They stay TypeScript-only.
 */
describe("tokens.css mirrors tokens.ts", () => {
  const expected = new Map<string, string>();

  for (const [scaleName, scale] of Object.entries(colors)) {
    for (const [step, value] of Object.entries(scale)) {
      expected.set(`--fixiyi-color-${scaleName}-${step}`, value);
    }
  }
  for (const [step, value] of Object.entries(spacing)) {
    expected.set(`--fixiyi-space-${step}`, value);
  }
  for (const [name, value] of Object.entries(radius)) {
    expected.set(`--fixiyi-radius-${name}`, value);
  }
  for (const [name, value] of Object.entries(typography.fontSize)) {
    expected.set(`--fixiyi-font-size-${name}`, value);
  }
  for (const [name, value] of Object.entries(typography.fontWeight)) {
    expected.set(`--fixiyi-font-weight-${name}`, String(value));
  }
  for (const [name, value] of Object.entries(shadows)) {
    expected.set(`--fixiyi-shadow-${name}`, value);
  }
  for (const [name, value] of Object.entries(zIndex)) {
    expected.set(`--fixiyi-z-${name}`, String(value));
  }
  for (const [name, value] of Object.entries(motion.duration)) {
    expected.set(`--fixiyi-motion-${name}`, value);
  }
  for (const [name, value] of Object.entries(motion.easing)) {
    expected.set(`--fixiyi-ease-${name}`, value);
  }

  it("declares a CSS variable for every TypeScript token, with the same value", () => {
    const missing: string[] = [];
    const mismatched: string[] = [];

    for (const [name, value] of expected) {
      const actual = cssTokens.get(name);
      if (actual === undefined) {
        missing.push(name);
      } else if (actual !== value.replace(/\s+/g, " ")) {
        mismatched.push(`${name}: css="${actual}" ts="${value}"`);
      }
    }

    expect({ missing, mismatched }).toEqual({ missing: [], mismatched: [] });
  });

  it("declares no CSS variable that has no TypeScript counterpart", () => {
    // --fixiyi-font-sans is the one legitimate exception: tokens.ts stores the
    // family as an array, joined into a single string for CSS.
    const orphans = [...cssTokens.keys()].filter((name) => name !== "--fixiyi-font-sans" && !expected.has(name));
    expect(orphans).toEqual([]);
  });

  it("lists the same font families, in the same order, as tokens.ts", () => {
    // Quoting is the one legitimate difference between the two sides: CSS
    // quotes multi-word family names ("Noto Sans Arabic"), the TS array holds
    // them bare. Compare the family list itself, not the quoting convention.
    const families = (value: string): string[] => value.split(",").map((part) => part.trim().replace(/^["']|["']$/g, ""));

    expect(families(cssTokens.get("--fixiyi-font-sans") ?? "")).toEqual(families(typography.fontFamily.sans));
  });
});
