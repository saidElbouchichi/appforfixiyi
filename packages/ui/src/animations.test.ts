import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * jsdom does not run CSS animations, so asserting "it animates nicely" in a
 * component test would be theatre (same reasoning as styles.test.ts). These
 * assert the invariants of the motion layer that actually rot: a utility
 * pointing at a keyframe that no longer exists, a new animation that forgets
 * to opt out of reduced motion, and a hard-coded duration that drifts away
 * from the tokens.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "styles", "animations.css"), "utf8");
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

const keyframeNames = new Set([...declarations.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1] ?? ""));
const utilityClasses = [...new Set([...declarations.matchAll(/\.(fx-animate-[\w-]+)/g)].map((match) => match[1] ?? ""))];

/** The `@media (prefers-reduced-motion: reduce)` block, body only. */
const reducedMotionBlock = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}/.exec(declarations)?.[1] ?? "";

describe("animations.css — keyframes", () => {
  it("defines the fade, slide, pulse and spin keyframes the design system promises", () => {
    for (const name of ["fx-fade-in", "fx-fade-out", "fx-slide-in-from-bottom", "fx-slide-in-inline", "fx-pulse", "fx-spin"]) {
      expect(keyframeNames, `missing @keyframes ${name}`).toContain(name);
    }
  });

  it("never references a keyframe it does not define", () => {
    const referenced = [...declarations.matchAll(/animation:\s*([\w-]+)/g)].map((match) => match[1] ?? "").filter((name) => name !== "none");

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(keyframeNames, `animation references unknown keyframe "${name}"`).toContain(name);
    }
  });
});

describe("animations.css — tokens", () => {
  it("takes every duration from a design token, never a literal", () => {
    // A literal duration anywhere outside the skeleton's documented 1.4s
    // pulse would mean motion drifting per-component.
    const literals = [...declarations.matchAll(/animation:[^;]*?(\d+(?:\.\d+)?m?s)/g)].map((match) => match[1] ?? "");
    expect(literals).toEqual([]);
  });

  it("takes every easing from a design token, never an inline cubic-bezier", () => {
    expect(declarations.match(/cubic-bezier/g)).toBeNull();
  });

  it("uses the motion and easing custom properties", () => {
    expect(declarations).toContain("--fixiyi-motion-");
    expect(declarations).toContain("--fixiyi-ease-");
  });

  it("hard-codes no colour", () => {
    expect(declarations.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });
});

describe("animations.css — reduced motion (WCAG 2.2 AA 2.3.3)", () => {
  it("declares a prefers-reduced-motion block", () => {
    expect(reducedMotionBlock.length).toBeGreaterThan(0);
  });

  it("neutralises every animation utility it ships — none can be forgotten", () => {
    expect(utilityClasses.length).toBeGreaterThan(0);
    for (const className of utilityClasses) {
      expect(reducedMotionBlock, `${className} is not covered by prefers-reduced-motion`).toContain(`.${className}`);
    }
  });

  it("switches animation off rather than shortening it, so `both`-filled keyframes cannot strand an element mid-fade", () => {
    // `animation-duration: 0.01ms` on a fade-in filled with `both` leaves the
    // element at opacity 0 — invisible. `animation: none` restores the
    // element's own painted state.
    expect(reducedMotionBlock).toMatch(/animation:\s*none/);
  });
});

describe("animations.css — RTL", () => {
  it("expresses directional motion on the inline axis, not a physical side", () => {
    // A keyframe named ...-from-right would bake LTR into the motion itself.
    expect(keyframeNames).toContain("fx-slide-in-inline");
    for (const name of keyframeNames) {
      expect(name, `keyframe "${name}" names a physical side`).not.toMatch(/-(left|right)$/);
    }
  });

  it("flips the inline slide offset under dir=rtl", () => {
    expect(declarations).toMatch(/\[dir="rtl"\]\s*\.fx-animate-slide-in-inline\s*\{[^}]*--fx-slide-offset:\s*-/);
  });

  it("uses no physical direction property", () => {
    expect(declarations.match(/(?:margin|padding|border|inset)-(?:left|right)\s*:/g)).toBeNull();
  });
});

describe("styles.css — single entry point", () => {
  it("imports the motion layer so consumers only ever import @fixiyi/ui/css", () => {
    const styles = readFileSync(join(here, "styles.css"), "utf8");
    expect(styles).toMatch(/@import\s+"\.\/styles\/animations\.css"/);
  });

  it("does not redefine a keyframe that the motion layer already owns", () => {
    const styles = readFileSync(join(here, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(styles.match(/@keyframes/g)).toBeNull();
  });
});
