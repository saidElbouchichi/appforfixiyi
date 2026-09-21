/**
 * Motion (part 2A). Durations 150-300ms for interface feedback, 500ms only
 * for larger movements (sheets, drawers).
 */
export const duration = {
  instant: "0ms",
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
} as const;

/**
 * `spring` is not a CSS keyword: it is approximated with `linear()`, which
 * samples a damped spring (slight overshoot, then settle). A browser without
 * `linear()` support invalidates the declaration at computed time and falls
 * back to the property's initial easing — degraded, never broken.
 */
export const easing = {
  linear: "linear",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
  "in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
  spring:
    "linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077 22.3%, 1.121, 1.149 28.4%, 1.155, 1.151 32.9%, 1.087 39.8%, 1.048 44.7%, 1.012 52.7%, 0.993 59.4%, 0.988 66.6%, 0.998 88.9%, 1)",
} as const;

/** Kept as a single object for consumers that read motion as a whole. */
export const motion = { duration, easing } as const;
