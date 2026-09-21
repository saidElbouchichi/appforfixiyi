/**
 * Typography — Inter for Latin script, Noto Sans Arabic for ar/ary (D6, D7).
 * The families are LOADED by `next/font` in each app (design phase 2); here
 * they are only named, with a system fallback so text renders before and
 * without them.
 */

const systemFallback = ["-apple-system", "Segoe UI", "system-ui", "sans-serif"];

/**
 * The CSS variables `next/font` sets on `<html>` (`src/app/fonts.ts` of web and admin).
 * They hold the self-hosted family plus its metric-matched fallback, so the
 * stacks in tokens.css read `var(--fixiyi-font-inter, Inter)`: the loaded
 * font when an app provides it, the plain family name otherwise.
 */
export const fontVariables = {
  latin: "--fixiyi-font-inter",
  arabic: "--fixiyi-font-noto-arabic",
} as const;

export const fontFamily = {
  sans: ["Inter", "Noto Sans Arabic", ...systemFallback].join(", "),
  arabic: ["Noto Sans Arabic", "Inter", ...systemFallback].join(", "),
} as const;

export const fontSize = {
  "2xs": "11px",
  xs: "12px",
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "30px",
  "4xl": "36px",
  "5xl": "48px",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export interface TextStyle {
  size: keyof typeof fontSize;
  lineHeight: string;
  weight: keyof typeof fontWeight;
  /** Titles are set tight (board: "tracking serre"), the overline wide. */
  letterSpacing: string;
  uppercase?: true;
}

/** The scale of part 2A, as named styles: size, line height, weight, tracking. */
export const textStyles = {
  display: { size: "5xl", lineHeight: "56px", weight: "extrabold", letterSpacing: "-0.02em" },
  h1: { size: "4xl", lineHeight: "44px", weight: "extrabold", letterSpacing: "-0.02em" },
  h2: { size: "3xl", lineHeight: "38px", weight: "bold", letterSpacing: "-0.015em" },
  h3: { size: "2xl", lineHeight: "32px", weight: "bold", letterSpacing: "-0.01em" },
  h4: { size: "xl", lineHeight: "28px", weight: "semibold", letterSpacing: "-0.01em" },
  h5: { size: "lg", lineHeight: "26px", weight: "semibold", letterSpacing: "0em" },
  "body-lg": { size: "lg", lineHeight: "28px", weight: "regular", letterSpacing: "0em" },
  body: { size: "md", lineHeight: "24px", weight: "regular", letterSpacing: "0em" },
  "body-sm": { size: "sm", lineHeight: "20px", weight: "regular", letterSpacing: "0em" },
  caption: { size: "xs", lineHeight: "16px", weight: "medium", letterSpacing: "0em" },
  overline: { size: "2xs", lineHeight: "16px", weight: "semibold", letterSpacing: "0.08em", uppercase: true },
} as const satisfies Record<string, TextStyle>;

/** Kept as a single object for consumers that read typography as a whole. */
export const typography = { fontFamily, fontVariables, fontSize, fontWeight, textStyles } as const;
