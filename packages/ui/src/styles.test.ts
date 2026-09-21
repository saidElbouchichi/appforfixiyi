import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { elevation, radiusRoles, textStyles } from "@fixiyi/design-tokens";
import { describe, expect, it } from "vitest";

/**
 * jsdom does not compute CSS, so asserting "it looks right" in a component
 * test would be theatre. These assert the real, checkable invariants of the
 * stylesheet instead — the ones that silently rot first.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Body of the rule whose selector is exactly `selector` ("" when absent). */
function blockOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`(?:^|\})\s*${escaped}\s*\{([^}]*)\}`).exec(declarations)?.[1] ?? "";
}

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

describe("styles.css — typography (design phase 2)", () => {
  it("sets no literal font size: every text sits on the token scale", () => {
    expect(declarations.match(/font-size\s*:\s*\d/g)).toBeNull();
  });

  it("uses no literal line height either (a unitless 1 that boxes an icon glyph excepted)", () => {
    expect(declarations.match(/line-height\s*:\s*(?!1\s*;)[\d.]+(?:px)?\s*;/g)).toBeNull();
  });

  it("offers one utility class per text style, built from that style's variables", () => {
    for (const style of Object.keys(textStyles)) {
      const block = blockOf(`.fx-text-${style}`);
      expect(block, style).toContain(`var(--fixiyi-text-${style}-size)`);
      expect(block, style).toContain(`var(--fixiyi-text-${style}-line-height)`);
      expect(block, style).toContain(`var(--fixiyi-text-${style}-weight)`);
    }
  });

  it("keeps form controls at 16px or more, so iOS Safari does not zoom on focus", () => {
    for (const selector of [".fx-field__control", ".fx-composer__input"]) {
      expect(blockOf(selector), selector).toContain("var(--fixiyi-text-body-size)");
    }
  });

  it("switches Arabic and darija content to the Arabic-first stack", () => {
    expect(declarations).toMatch(/:lang\(ar\),\s*:lang\(ary\)\s*\{\s*--fixiyi-font-sans:\s*var\(--fixiyi-font-arabic\)/);
  });
});

describe("styles.css — spacing, shape and elevation (design phase 3)", () => {
  /** Every `property: value` pair whose property matches, comments stripped. */
  const valuesOf = (property: RegExp): string[] =>
    [...declarations.matchAll(new RegExp(String.raw`(?:^|[;{\s])(${property.source})\s*:\s*([^;{}]+);`, "g"))].map((match) => (match[2] ?? "").trim());

  const kebab = (name: string): string => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  it("puts every margin, padding and gap on the 4px grid (--fixiyi-space-*, 0 or auto)", () => {
    const values = valuesOf(/(?:margin|padding)(?:-[a-z-]+)?|(?:row-|column-)?gap/);
    expect(values.length).toBeGreaterThan(30);
    const offGrid = values.filter((value) => !value.split(/\s+/).every((part) => /^(?:0|auto|var\(--fixiyi-space-\d+\))$/.test(part)));
    expect(offGrid).toEqual([]);
  });

  it("rounds corners only through a shape role, never a raw step or a literal", () => {
    const allowed = new Set(Object.keys(radiusRoles).map((role) => `var(--fixiyi-radius-${kebab(role)})`));
    const values = valuesOf(/border(?:-[a-z-]+)?-radius/);
    expect(values.length).toBeGreaterThan(15);
    expect(values.filter((value) => !allowed.has(value))).toEqual([]);
  });

  it("casts shadows only through an elevation role (or none)", () => {
    const allowed = new Set([...Object.keys(elevation).map((role) => `var(--fixiyi-elevation-${role})`), "none"]);
    const values = valuesOf(/box-shadow/);
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((value) => !allowed.has(value))).toEqual([]);
  });

  it("lifts primary and danger buttons to the hover elevation (part 2B)", () => {
    for (const variant of ["primary", "danger"]) {
      expect(blockOf(`.fx-button--${variant}:hover:not(:disabled)`), variant).toContain("var(--fixiyi-elevation-hover)");
    }
  });

  it("dims the page behind a modal with the scrim token, not an ad-hoc black", () => {
    expect(blockOf(".fx-modal__overlay")).toContain("var(--fixiyi-scrim)");
  });
});
