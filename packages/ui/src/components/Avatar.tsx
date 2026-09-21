import type { avatarColors } from "@fixiyi/design-tokens";
import type { JSX } from "react";

import { cx } from "../cx.js";

/** The trades that have an avatar colour pair in the tokens (measured 4.5:1, D4). */
export type AvatarTrade = keyof typeof avatarColors;
export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "busy";

const STATUS_LABELS: Record<AvatarStatus, string> = { online: "en ligne", offline: "hors ligne", busy: "occupe" };

/** First letter of the first two words, uppercased; code-point safe (Arabic, emoji). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

export interface AvatarProps {
  /** The person's real display name: the initials and the accessible name come from it. */
  name: string;
  /** Colours the avatar with the trade's pair; without it, the brand's soft pair. */
  trade?: AvatarTrade | undefined;
  size?: AvatarSize;
  /** Only a status the app really knows (chat presence) — never a decorative "online". */
  status?: AvatarStatus | undefined;
  statusLabels?: Record<AvatarStatus, string>;
  testId?: string;
}

/**
 * Initials on a colour — no photo, since no profile photo exists and D4
 * forbids invented ones. One image to assistive tech: "Ahmed El Idrissi,
 * en ligne"; the letters and the dot are hidden.
 */
export function Avatar({ name, trade, size = "md", status, statusLabels = STATUS_LABELS, testId }: AvatarProps): JSX.Element {
  const label = status ? `${name}, ${statusLabels[status]}` : name;

  return (
    <span className={cx("fx-avatar", `fx-avatar--${size}`, trade && `fx-avatar--trade-${trade}`)} role="img" aria-label={label} data-testid={testId}>
      <span className="fx-avatar__initials" aria-hidden="true">
        {initialsOf(name)}
      </span>
      {status ? <span className={cx("fx-avatar__status", `fx-avatar__status--${status}`)} aria-hidden="true" /> : null}
    </span>
  );
}
