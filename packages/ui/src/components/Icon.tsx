import type { JSX } from "react";

import { cx } from "../cx.js";

export type IconName =
  // navigation
  | "home"
  | "search"
  | "message"
  | "wallet"
  | "profile"
  // actions
  | "add"
  | "edit"
  | "delete"
  | "close"
  | "check"
  | "arrow"
  // chat
  | "send"
  | "reply"
  | "attach"
  | "check-double"
  // status
  | "success"
  | "warning"
  | "error"
  | "info"
  | "loading"
  // metier
  | "wrench"
  | "tools"
  | "calendar"
  | "map"
  | "star"
  | "shield";

export type IconSize = "sm" | "md" | "lg" | "xl";

export const ICON_SIZES: Record<IconSize, number> = { sm: 16, md: 20, lg: 24, xl: 32 };

/**
 * Icons whose meaning depends on reading direction. `dir="rtl"` mirrors them
 * (see `.fx-icon--directional` in styles.css): an arrow that means "next"
 * points the other way in Arabic, and shipping it unflipped would point at
 * the previous step (01_SPEC_PRODUCT.md #5 — ar/ary are first-class).
 */
// "send" and "reply" point along the reading direction too: a reply arrow that
// points forward in Arabic reads as "forward", not "reply".
const DIRECTIONAL_ICONS = new Set<IconName>(["arrow", "send", "reply"]);

/**
 * Single 24x24 stroke grid for every glyph, so icons keep one optical weight
 * whatever the size. Paths only — no `fill`, no hard-coded colour — so
 * `currentColor` on the stroke makes each icon inherit its parent's colour.
 */
const PATHS: Record<IconName, string[]> = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M9 21v-6h6v6"],
  search: ["M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z", "m16.2 16.2 4.3 4.3"],
  message: ["M20 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v4l5-4h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"],
  wallet: ["M19 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7", "M17 14h.01"],
  profile: ["M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z", "M4 21a8 8 0 0 1 16 0"],

  add: ["M12 5v14", "M5 12h14"],
  edit: ["M4 20h4L19.5 8.5a2.8 2.8 0 0 0-4-4L4 16z"],
  delete: ["M4 7h16", "M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2", "M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"],
  close: ["m6 6 12 12", "M18 6 6 18"],
  check: ["m4 12.5 5 5.5L20 6"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],

  send: ["M4 12 20 4l-4 16-4-7z", "m12 13 8-9"],
  reply: ["M9 7 4 12l5 5", "M4 12h10a6 6 0 0 1 6 6v1"],
  attach: ["m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14 7.6"],
  "check-double": ["m2 12.5 5 5.5L16 7", "m10 16 2 2 10-11"],

  success: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "m8 12.5 2.5 2.5L16 9.5"],
  warning: ["M12 4 2.5 20.5h19z", "M12 10v4", "M12 17h.01"],
  error: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "m15 9-6 6", "m9 9 6 6"],
  info: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "M12 11v5", "M12 8h.01"],
  loading: ["M21 12a9 9 0 1 1-9-9"],

  wrench: [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8z",
  ],
  tools: ["M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3", "M3 13h18"],
  calendar: ["M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M8 2v4", "M16 2v4", "M4 10h16"],
  map: ["m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z", "M9 4v14", "M15 6v14"],
  star: ["m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
  shield: ["M12 3l8 3v6c0 4.5-3.2 8.4-8 9.5C7.2 20.4 4 16.5 4 12V6z"],
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  /**
   * Accessible name. Provide it when the icon carries meaning on its own
   * (an icon-only button). Omit it when adjacent text already says the same
   * thing — the icon is then `aria-hidden`, so a screen reader is not made
   * to read the label twice (WCAG 2.2 AA 1.1.1).
   */
  label?: string;
  className?: string;
  testId?: string;
}

export function Icon({ name, size = "md", label, className, testId }: IconProps): JSX.Element {
  const pixels = ICON_SIZES[size];
  const decorative = label === undefined;

  return (
    <svg
      className={cx("fx-icon", DIRECTIONAL_ICONS.has(name) && "fx-icon--directional", className)}
      width={pixels}
      height={pixels}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={label}
      focusable="false"
      data-testid={testId}
      data-icon={name}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
