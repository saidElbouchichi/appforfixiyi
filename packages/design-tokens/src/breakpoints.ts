/**
 * Viewport breakpoints (part 2B names, mobile-first per part 3A: 375px first).
 * `mobile` documents the design base, not a media query.
 *
 * TypeScript only — no CSS variable: a custom property cannot be used inside
 * an `@media` query, so exposing one would advertise something that does not
 * work (see tokens.test.ts).
 */
export const breakpoints = {
  mobile: "375px",
  tablet: "768px",
  desktop: "1024px",
  large: "1280px",
} as const;
