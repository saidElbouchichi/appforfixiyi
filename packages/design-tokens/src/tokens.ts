/**
 * Fixiyi Design System — base tokens (02_SPEC_ENGINEERING.md #160).
 *
 * This is the Phase 1 foundation: a real, usable token set, not a
 * decorative placeholder. The visual identity itself (01_SPEC_PRODUCT.md
 * #83 — "rapidite" + "confiance" + technique/moderne/humain/accessible)
 * will be refined once real screens exist in later phases; until then this
 * is the single source of truth consumed by apps/web, apps/admin and
 * (later) apps/mobile.
 *
 * Kept in sync by hand with ./tokens.css — see the note there.
 */

export const colors = {
  primary: {
    50: "#eef7f7",
    100: "#d3ebea",
    200: "#a7d7d5",
    300: "#79c0bd",
    400: "#4ba7a3",
    500: "#2f8b87", // brand primary — trust + speed
    600: "#256f6c",
    700: "#1d5754",
    800: "#153e3c",
    900: "#0d2726",
  },
  neutral: {
    0: "#ffffff",
    50: "#f7f8f8",
    100: "#eceeee",
    200: "#d7dbdb",
    300: "#b8bfbf",
    400: "#8f9898",
    500: "#6b7373",
    600: "#4f5656",
    700: "#383e3e",
    800: "#232727",
    900: "#141717",
    1000: "#000000",
  },
  success: { 500: "#2e9e5b", 700: "#1f7042" },
  warning: { 500: "#c98a1c", 700: "#8f6212" },
  danger: { 500: "#c94c2f", 700: "#8f351f" },
  info: { 500: "#2f7cc9", 700: "#1f588f" },
} as const;

export const spacing = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

export const radius = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const typography = {
  fontFamily: {
    // Latin-first with an Arabic-capable fallback so fr/en and ar/ary
    // (01_SPEC_PRODUCT.md #5) render legibly from the same stack.
    sans: [
      "Inter",
      "Noto Sans Arabic",
      "-apple-system",
      "Segoe UI",
      "system-ui",
      "sans-serif",
    ].join(", "),
  },
  fontSize: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "30px",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(20, 23, 23, 0.06)",
  md: "0 4px 8px rgba(20, 23, 23, 0.08)",
  lg: "0 12px 24px rgba(20, 23, 23, 0.12)",
} as const;

export const breakpoints = {
  sm: "400px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  toast: 1400,
} as const;

export const motion = {
  duration: {
    fast: "120ms",
    normal: "200ms",
    slow: "320ms",
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    decelerate: "cubic-bezier(0, 0, 0, 1)",
    accelerate: "cubic-bezier(0.3, 0, 1, 1)",
  },
} as const;
