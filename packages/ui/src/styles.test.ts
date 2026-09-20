import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * jsdom does not compute CSS, so asserting "it looks right" in a component
 * test would be theatre. These assert the real, checkable invariants of the
 * stylesheet instead — the ones that silently rot first.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("styles.css — RTL safety", () => {
  it("uses no physical direction properties (logical properties only)", () => {
    const physical = /(?:margin|padding|border|inset)-(?:left|right)\s*:/g;
    expect(declarations.match(physical)).toBeNull();
  });

  it("never aligns text to a physical side", () => {
    expect(declarations.match(/text-align\s*:\s*(?:left|right)/g)).toBeNull();
  });

  it("never positions with bare left/right offsets", () => {
    expect(declarations.match(/(?:^|[\s;{])(?:left|right)\s*:/gm)).toBeNull();
  });
});

describe("styles.css — design tokens", () => {
  it("uses no hard-coded hex colour", () => {
    expect(declarations.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it("pulls colours, radii, fonts and motion from @fixiyi/design-tokens variables", () => {
    for (const token of ["--fixiyi-color-", "--fixiyi-radius-", "--fixiyi-font-sans", "--fixiyi-motion-"]) {
      expect(declarations).toContain(token);
    }
  });
});

describe("styles.css — WCAG 2.2 AA", () => {
  it("defines a visible focus indicator (2.4.11 / 2.4.13)", () => {
    expect(declarations).toContain(":focus-visible");
    expect(declarations).toMatch(/outline\s*:\s*2px solid/);
  });

  it("gives interactive targets at least the 24px minimum (2.5.8)", () => {
    const minSizes = [...declarations.matchAll(/min-(?:block|inline)-size\s*:\s*(\d+)px/g)].map((match) => Number(match[1]));
    expect(minSizes.length).toBeGreaterThan(0);
    for (const size of minSizes) {
      expect(size).toBeGreaterThanOrEqual(24);
    }
  });

  it("neutralises animation under prefers-reduced-motion (2.3.3)", () => {
    expect(declarations).toContain("prefers-reduced-motion: reduce");
  });

  it("ships a visually-hidden helper that stays readable by screen readers", () => {
    expect(declarations).toContain(".fx-visually-hidden");
    expect(declarations).not.toMatch(/\.fx-visually-hidden\s*\{[^}]*display\s*:\s*none/);
  });
});
