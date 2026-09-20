import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

export type BadgeVariant = "info" | "success" | "warning" | "error";

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Always carries the meaning as text — colour is never the only signal (WCAG 2.2 AA 1.4.1). */
  children: ReactNode;
  className?: string;
  testId?: string;
}

export function Badge({ variant = "info", children, className, testId }: BadgeProps): JSX.Element {
  return (
    <span className={cx("fx-badge", `fx-badge--${variant}`, className)} data-testid={testId}>
      {children}
    </span>
  );
}
