import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";

/** A status label. For something the user selects or removes, use `Chip`. */
export type BadgeVariant = "neutral" | "brand" | "info" | "success" | "warning" | "error";

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Always carries the meaning as text — colour is never the only signal (WCAG 2.2 AA 1.4.1). */
  children: ReactNode;
  icon?: IconName;
  /** A status dot before the text (e.g. "Disponible"). */
  dot?: boolean;
  /** The dot pulses three times, then stays still (part 2B "badge pulse" for urgent; WCAG 2.2.2). */
  pulse?: boolean;
  className?: string;
  testId?: string;
}

export function Badge({ variant = "info", children, icon, dot = false, pulse = false, className, testId }: BadgeProps): JSX.Element {
  return (
    <span className={cx("fx-badge", `fx-badge--${variant}`, className)} data-testid={testId}>
      {dot || pulse ? <span className={cx("fx-badge__dot", pulse && "fx-badge__dot--pulse")} aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}
