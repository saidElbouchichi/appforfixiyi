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
