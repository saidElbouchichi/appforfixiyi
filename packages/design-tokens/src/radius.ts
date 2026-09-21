/** Border radius (part 2A). `sm` moved from 4px to 6px with the V2 board. */
export const radius = {
  none: "0px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  "3xl": "32px",
  full: "9999px",
} as const;

/**
 * Shape roles: what components use, each pointing at a step of the scale
 * (declared as `var()` in tokens.css, so re-shaping a role is one line).
 * Read from the V2 board: soft controls, rounder cards and sheets, pills
 * for anything that labels or counts.
 */
export const radiusRoles = {
  /** Buttons, fields, choices, icon buttons. */
  control: "md",
  /** Cards and chat bubbles' main corners. */
  card: "xl",
  /** Chat bubble: the corner that points at its author stays tight. */
  bubbleTail: "sm",
  /** Media and quotes nested inside a card or bubble. */
  inset: "md",
  /** Modals, and the bottom sheet of phase 4. */
  overlay: "2xl",
  /** Checkbox boxes and other small marks. */
  mark: "sm",
  /** Badges, chips, reactions, avatars, dots. */
  pill: "full",
} as const satisfies Record<string, keyof typeof radius>;
