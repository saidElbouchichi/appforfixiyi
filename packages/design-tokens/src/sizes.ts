/**
 * Component sizes (master prompt part 2B, buttons): the four control heights
 * and the touch target. WCAG 2.2 AA 2.5.8 asks 24px; 44px is the mobile
 * target the audit fixed (AUDIT.md), applied under `pointer: coarse` to the
 * heights below it, and everywhere to icon-only controls.
 */
export const controlHeight = {
  sm: "32px",
  md: "40px",
  lg: "48px",
  xl: "56px",
} as const;

export const touchTarget = "44px";

/** Content widths (design phase 5): a form column, a wide page, the whole shell. */
export const containerWidth = {
  narrow: "672px",
  wide: "896px",
  page: "1200px",
} as const;

/** The app bar: shorter on a phone, where every pixel of height counts. */
export const headerHeight = {
  mobile: "56px",
  desktop: "64px",
} as const;

/**
 * The bottom navigation bar of a phone, before the safe-area inset.
 *
 * 72px, not 64: with five entries on a 360px screen a label takes two lines
 * ("Demandes recues"), and 8px padding + a 24px icon + 4px gap + two 16px
 * lines is 68 — at 64 the second line spilled out of the bar (design phase 6,
 * seen in a real capture).
 */
export const bottomNavHeight = "72px";
