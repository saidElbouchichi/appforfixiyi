import { Inter, Noto_Sans_Arabic } from "next/font/google";

/**
 * Self-hosted at build time by next/font (no request to Google at runtime,
 * no layout shift thanks to the metric-matched fallback). Both are variable
 * fonts, so one file per subset covers every weight of the type scale.
 *
 * The `variable` names must be string literals (next/font is statically
 * analysed). They are the ones `fontVariables` (@fixiyi/design-tokens)
 * declares and the font stacks of tokens.css read; the browser test
 * tests/browser/tests/typography.spec.ts fails if the two drift apart.
 */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fixiyi-font-inter",
});

/** Only Arabic and darija text needs it: loaded on demand, not preloaded on every page. */
export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  variable: "--fixiyi-font-noto-arabic",
  preload: false,
});

/** Class names that declare both variables on `<html>`. */
export const fontVariableClasses = `${inter.variable} ${notoSansArabic.variable}`;

