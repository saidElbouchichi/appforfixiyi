import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Page } from "@playwright/test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Design-system harness (design phase 4). The primitives of `@fixiyi/ui` are
 * rendered by React on the server and styled by the REAL stylesheets — the
 * tokens and `@fixiyi/ui/css` with every import inlined — in a real Chromium.
 * jsdom computes no CSS; this is where sizes, contrast and rendering are
 * measured. Behaviour (keyboard, ARIA state changes) is covered by the jsdom
 * component tests in packages/ui, which run the event handlers.
 *
 * No web font is served here: text renders in the stack's system fallback,
 * which is enough for geometry and colour. Font loading is covered by
 * typography.spec.ts against the real apps.
 */
const require = createRequire(import.meta.url);

function inlineImports(file: string): string {
  const source = readFileSync(file, "utf8");
  return source.replace(/@import\s+"(\.[^"]+)";/g, (_statement, relative: string) => inlineImports(join(dirname(file), relative)));
}

const STYLES = [require.resolve("@fixiyi/design-tokens/css"), require.resolve("@fixiyi/ui/css")].map(inlineImports).join("\n");

export interface HarnessOptions {
  dir?: "ltr" | "rtl";
  lang?: string;
  /** Viewport width; the harness defaults to a 390px phone. */
  width?: number;
}

export async function renderUi(page: Page, tree: ReactElement, options: HarnessOptions = {}): Promise<void> {
  const { dir = "ltr", lang = dir === "rtl" ? "ar" : "fr", width = 390 } = options;
  await page.setViewportSize({ width, height: 844 });
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><style>${STYLES}
body { margin: 0; padding: 16px; font-family: var(--fixiyi-font-sans); background: var(--fixiyi-color-surface-muted); color: var(--fixiyi-color-text); }
</style></head><body>${renderToStaticMarkup(tree)}</body></html>`;
  await page.setContent(html);
}

/** WCAG 2.x contrast ratio between two computed CSS colours (`rgb(...)` / `rgba(...)`, alpha ignored). */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (css: string): number => {
    const [r, g, b] = (css.match(/[\d.]+/g) ?? []).slice(0, 3).map((channel) => {
      const value = Number(channel) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
