/** Elevation (part 2A), tinted with the warm ink `#1C1917` = rgb(28, 25, 23). */
export const shadows = {
  none: "none",
  sm: "0 1px 2px rgba(28, 25, 23, 0.06)",
  md: "0 4px 6px rgba(28, 25, 23, 0.07)",
  lg: "0 10px 15px rgba(28, 25, 23, 0.08)",
  xl: "0 20px 25px rgba(28, 25, 23, 0.10)",
  "2xl": "0 25px 50px rgba(28, 25, 23, 0.15)",
} as const;

/**
 * Elevation roles, pointing at the scale like the colour and shape roles.
 * Part 2B: "hover : shadow-lg" for buttons and interactive cards.
 */
export const elevation = {
  /** Resting cards, primary buttons, bubbles. */
  raised: "sm",
  /** An interactive surface under the pointer. */
  hover: "lg",
  /** Modals and sheets, above everything but toasts. */
  overlay: "xl",
} as const satisfies Record<string, keyof typeof shadows>;

/** Backdrop behind a modal: the warm ink at 45 %, not pure black. */
export const scrim = "rgba(28, 25, 23, 0.45)";
