import type { JSX } from "react";

import { cx } from "../cx.js";

/**
 * Every glyph, by category (master prompt part 2C, plus the trade icons of
 * the catalogue and two that the primitives of design phase 4 need).
 * Directional glyphs are named by reading direction (`back`/`forward`,
 * `start`/`end`), not by side: they mirror under `dir="rtl"`.
 *
 * Single 24x24 stroke grid for every glyph, so icons keep one optical weight
 * whatever the size. Paths only — no `fill`, no hard-coded colour — so
 * `currentColor` on the stroke makes each icon inherit its parent's colour.
 */
const PATHS = {
  // navigation
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M9 21v-6h6v6"],
  search: ["M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z", "m16.2 16.2 4.3 4.3"],
  message: ["M20 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v4l5-4h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"],
  wallet: ["M19 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7", "M17 14h.01"],
  profile: ["M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z", "M4 21a8 8 0 0 1 16 0"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["m6 6 12 12", "M18 6 6 18"],
  "arrow-back": ["M19 12H5", "m11 6-6 6 6 6"],
  "arrow-forward": ["M5 12h14", "m13 6 6 6-6 6"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-up": ["m6 15 6-6 6 6"],
  "chevron-start": ["m15 6-6 6 6 6"],
  "chevron-end": ["m9 6 6 6-6 6"],

  // actions
  add: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  edit: ["M4 20h4L19.5 8.5a2.8 2.8 0 0 0-4-4L4 16z"],
  delete: ["M4 7h16", "M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2", "M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"],
  check: ["m4 12.5 5 5.5L20 6"],
  save: ["M5 4a1 1 0 0 1 1-1h10l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z", "M8 3v4h7", "M8 21v-7h8v7"],
  share: [
    "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "m8.6 13.5 6.8 4",
    "m15.4 6.5-6.8 4",
  ],
  copy: ["M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z", "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M4 21h16"],
  upload: ["M12 15V3", "m7 8 5-5 5 5", "M4 21h16"],
  filter: ["M3 5h18l-7 8v6l-4 2v-8z"],
  sort: ["M7 4v16", "m3 8 4-4 4 4", "M17 20V4", "m13 16 4 4 4-4"],
  more: ["M12 6h.01", "M12 12h.01", "M12 18h.01"],

  // status
  success: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "m8 12.5 2.5 2.5L16 9.5"],
  warning: ["M12 4 2.5 20.5h19z", "M12 10v4", "M12 17h.01"],
  error: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "m15 9-6 6", "m9 9 6 6"],
  info: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "M12 11v5", "M12 8h.01"],
  loading: ["M21 12a9 9 0 1 1-9-9"],
  clock: ["M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z", "M12 7v5l3 2"],

  // metier
  wrench: [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8z",
  ],
  tools: ["M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3", "M3 13h18"],
  calendar: ["M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M8 2v4", "M16 2v4", "M4 10h16"],
  map: ["m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z", "M9 4v14", "M15 6v14"],
  "map-pin": ["M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  star: ["m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
  shield: ["M12 3l8 3v6c0 4.5-3.2 8.4-8 9.5C7.2 20.4 4 16.5 4 12V6z"],
  "credit-card": ["M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18", "M7 15h4"],
  phone: ["M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"],
  mail: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "m3 7 9 6 9-6"],
  bell: ["M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z", "M10 21h4"],
  users: ["M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z", "M2 21a7 7 0 0 1 14 0", "M16 3.1a4 4 0 0 1 0 7.8", "M18 14.3a7 7 0 0 1 4 6.7"],
  briefcase: ["M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z", "M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2", "M12 12h.01"],
  building: ["M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17", "M15 9h3a1 1 0 0 1 1 1v11", "M3 21h18", "M9 7h2", "M9 11h2", "M9 15h2"],

  // trades (catalogue domains; paired with colors.trade by design phase 7)
  bolt: ["M13 2 4 14h7l-1 8 9-12h-7z"],
  droplet: ["M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"],
  snowflake: ["M12 2v20", "m4.9 7 14.2 10", "m19.1 7-14.2 10", "m9 4 3 2 3-2", "m9 20 3-2 3 2"],
  key: ["M7.5 20a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z", "m10.7 12.3 9.3-9.3", "m16 7 3 3", "m18 5 2 2"],
  "paint-roller": [
    "M5 3h13a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M19 5.5h1a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1h-8v3",
    "M11 14h2v7h-2z",
  ],
  hammer: ["M10.5 7.5 14 4l6 6-3.5 3.5z", "M13.5 10.5 3 21"],
  "washing-machine": [
    "M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M8 6h.01",
    "M11 6h.01",
  ],
  "smart-home": ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M9 14a4.2 4.2 0 0 1 6 0", "M12 17h.01"],
  monitor: ["M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M8 20h8", "M12 16v4"],
  sparkles: ["M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z", "M18 14l.9 2.1 2.1.9-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"],
  leaf: ["M5 19c0-8 5-14 15-15-1 10-7 15-15 15z", "M5 19l8-8"],

  // chat
  send: ["M4 12 20 4l-4 16-4-7z", "m12 13 8-9"],
  reply: ["M9 7 4 12l5 5", "M4 12h10a6 6 0 0 1 6 6v1"],
  attach: ["m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14 7.6"],
  "check-double": ["m2 12.5 5 5.5L16 7", "m10 16 2 2 10-11"],
  image: ["M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "m21 15-5-5L5 20"],
  file: ["M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z", "M14 3v5h5"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Names the master prompt (part 2C) and the v1 code use, kept working.
 * The physical ones (`left`/`right`) resolve to the reading-direction glyph:
 * "arrow-left" means "back", and back points right in Arabic.
 */
const ALIASES = {
  arrow: "arrow-forward",
  "arrow-left": "arrow-back",
  "arrow-right": "arrow-forward",
  "chevron-left": "chevron-start",
  "chevron-right": "chevron-end",
  x: "close",
  user: "profile",
} as const satisfies Record<string, keyof typeof PATHS>;

export type CanonicalIconName = keyof typeof PATHS;
export type IconName = CanonicalIconName | keyof typeof ALIASES;

export type IconSize = "sm" | "md" | "lg" | "xl" | "2xl";

export const ICON_SIZES: Record<IconSize, number> = { sm: 16, md: 20, lg: 24, xl: 32, "2xl": 48 };

/**
 * Icons whose meaning depends on reading direction. `dir="rtl"` mirrors them
 * (see `.fx-icon--directional` in styles/icon.css): an arrow that means "next"
 * points the other way in Arabic, and shipping it unflipped would point at
 * the previous step (01_SPEC_PRODUCT.md #5 — ar/ary are first-class).
 * "send" and "reply" point along the reading direction too: a reply arrow
 * that points forward in Arabic reads as "forward", not "reply".
 */
const DIRECTIONAL_ICONS = new Set<CanonicalIconName>(["arrow-back", "arrow-forward", "chevron-start", "chevron-end", "send", "reply"]);

/** The glyph an alias stands for (a canonical name is returned unchanged). */
export function resolveIconName(name: IconName): CanonicalIconName {
  return name in ALIASES ? ALIASES[name as keyof typeof ALIASES] : (name as CanonicalIconName);
}

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
  const glyph = resolveIconName(name);

  return (
    <svg
      className={cx("fx-icon", DIRECTIONAL_ICONS.has(glyph) && "fx-icon--directional", className)}
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
      data-icon={glyph}
    >
      {PATHS[glyph].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Every distinct glyph (aliases excluded). */
export const ICON_NAMES = Object.keys(PATHS) as CanonicalIconName[];

/** Alias -> glyph, for documentation and tests. */
export const ICON_ALIASES: Readonly<Record<string, CanonicalIconName>> = ALIASES;
