import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  avatarColors,
  breakpoints,
  colors,
  contrastPairs,
  duration,
  easing,
  fontFamily,
  fontSize,
  fontVariables,
  fontWeight,
  radius,
  roles,
  shadows,
  spacing,
  textStyles,
  zIndex,
} from "./index.js";

// ------------------------------------------------------------------ helpers

/** WCAG 2.x relative luminance / contrast ratio — the formula, not an approximation. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");
const declared = new Map([...css.matchAll(/(--fixiyi-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1] ?? "", normalize(match[2] ?? "")]));

/** Follows `var(--x)` references inside tokens.css down to a literal value. */
function resolve(name: string, seen = new Set<string>()): string | undefined {
  const value = declared.get(name);
  const reference = value === undefined ? null : /^var\((--fixiyi-[a-z0-9-]+)\)$/.exec(value);
  if (!reference?.[1] || seen.has(name)) return value;
  return resolve(reference[1], new Set([...seen, name]));
}

// ------------------------------------------------------ expected CSS mirror

const expected = new Map<string, string>();
const put = (name: string, value: string | number): void => {
  expected.set(name, normalize(String(value)));
};

for (const scale of ["primary", "accent", "neutral", "success", "warning", "error", "info"] as const) {
  for (const [step, value] of Object.entries(colors[scale])) put(`--fixiyi-color-${scale}-${step}`, value);
}
for (const [trade, value] of Object.entries(colors.trade)) put(`--fixiyi-color-trade-${trade}`, value);
for (const [trade, pair] of Object.entries(avatarColors)) {
  put(`--fixiyi-color-avatar-${trade}-bg`, pair.bg);
  put(`--fixiyi-color-avatar-${trade}-fg`, pair.fg);
}
for (const [role, value] of Object.entries(roles)) put(`--fixiyi-color-${kebab(role)}`, value);
for (const [step, value] of Object.entries(spacing)) put(`--fixiyi-space-${step}`, value);
for (const [name, value] of Object.entries(radius)) put(`--fixiyi-radius-${name}`, value);
for (const [name, value] of Object.entries(fontSize)) put(`--fixiyi-font-size-${name}`, value);
for (const [name, value] of Object.entries(fontWeight)) put(`--fixiyi-font-weight-${name}`, value);
for (const [style, spec] of Object.entries(textStyles)) {
  put(`--fixiyi-text-${style}-size`, fontSize[spec.size]);
  put(`--fixiyi-text-${style}-line-height`, spec.lineHeight);
  put(`--fixiyi-text-${style}-weight`, fontWeight[spec.weight]);
  put(`--fixiyi-text-${style}-tracking`, spec.letterSpacing);
}
for (const [name, value] of Object.entries(shadows)) put(`--fixiyi-shadow-${name}`, value);
for (const [name, value] of Object.entries(zIndex)) put(`--fixiyi-z-${name}`, value);
for (const [name, value] of Object.entries(duration)) put(`--fixiyi-motion-${name}`, value);
for (const [name, value] of Object.entries(easing)) put(`--fixiyi-ease-${name}`, value);

/** Font stacks are compared as family lists: CSS quotes multi-word names, TS does not. */
const FONT_VARIABLES = { "--fixiyi-font-sans": fontFamily.sans, "--fixiyi-font-arabic": fontFamily.arabic } as const;
/** `var(--fixiyi-font-inter, Inter)` counts as its fallback family; the variable names are checked apart. */
const LOADED_FONT = /var\((--[a-z0-9-]+),\s*([^)]+)\)/g;
const families = (value: string): string[] =>
  value
    .replace(LOADED_FONT, "$2")
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, "").toLowerCase());
const loadedFontVariables = (value: string): string[] => [...value.matchAll(LOADED_FONT)].map((match) => match[1] ?? "");

// -------------------------------------------------------------------- tests

describe("design tokens — values", () => {
  it("every colour is a valid 6-digit hex value", () => {
    const all = [
      ...Object.values(colors).flatMap((scale) => Object.values(scale)),
      ...Object.values(avatarColors).flatMap((pair) => [pair.bg, pair.fg]),
    ];
    for (const value of all) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("spacing scale is monotonically increasing and base 4", () => {
    const values = Object.values(spacing).map((value) => Number.parseInt(value, 10));
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i] ?? Number.NaN).toBeGreaterThan(values[i - 1] ?? Number.NaN);
    }
    for (const value of values) expect(value % 4).toBe(0);
  });

  it("radius, durations and breakpoints carry the V2 values", () => {
    expect(radius.sm).toBe("6px");
    expect(radius["3xl"]).toBe("32px");
    expect(duration.fast).toBe("150ms");
    expect(breakpoints.tablet).toBe("768px");
  });

  it("gives every trade a distinct colour — two trades must never look alike", () => {
    // Part 2A gave Domotique the same value as Locksmith; that is why it is absent until chosen.
    const values = Object.values(colors.trade).map((value) => value.toLowerCase());
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("D1 — contrast is measured, not assumed (WCAG 2.2 AA)", () => {
  for (const pair of contrastPairs) {
    it(`${pair.use}: ${pair.fg} on ${pair.bg} >= ${pair.min.toString()}:1`, () => {
      expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
    });
  }

  it("never pairs the brand orange with text (2.80:1 with white)", () => {
    expect(contrast(colors.neutral[0], colors.primary[500])).toBeLessThan(3);
    expect(Object.values(roles)).not.toContain(undefined);
    expect(roles.action).not.toBe(colors.primary[500]);
    for (const pair of contrastPairs) {
      if (pair.bg === colors.primary[500]) expect(pair.fg, pair.use).not.toBe(colors.neutral[0]);
    }
  });
});

describe("tokens.css mirrors the TypeScript tokens", () => {
  it("declares every TypeScript token with the same value (roles resolved through var())", () => {
    const missing: string[] = [];
    const mismatched: string[] = [];
    for (const [name, value] of expected) {
      const actual = resolve(name);
      if (actual === undefined) missing.push(name);
      else if (normalize(actual) !== value) mismatched.push(`${name}: css="${actual}" ts="${value}"`);
    }
    expect({ missing, mismatched }).toEqual({ missing: [], mismatched: [] });
  });

  it("declares no CSS variable without a TypeScript counterpart", () => {
    const orphans = [...declared.keys()].filter((name) => !(name in FONT_VARIABLES) && !expected.has(name));
    expect(orphans).toEqual([]);
  });

  it("lists the same font families, in the same order", () => {
    for (const [name, value] of Object.entries(FONT_VARIABLES)) {
      expect(families(declared.get(name) ?? ""), name).toEqual(families(value));
    }
  });

  it("lets next/font supply each family through the variables the apps set", () => {
    expect(loadedFontVariables(declared.get("--fixiyi-font-sans") ?? "")).toEqual([fontVariables.latin, fontVariables.arabic]);
    expect(loadedFontVariables(declared.get("--fixiyi-font-arabic") ?? "")).toEqual([fontVariables.arabic, fontVariables.latin]);
  });

  it("exposes roles as references to the scale, so a role is re-pointed in one place", () => {
    for (const role of Object.keys(roles)) {
      expect(declared.get(`--fixiyi-color-${kebab(role)}`), role).toMatch(/^var\(--fixiyi-color-/);
    }
  });
});
