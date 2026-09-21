import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";
import { IconButton } from "./IconButton.js";

export type AlertVariant = "info" | "success" | "warning" | "error";

const VARIANT_ICON: Record<AlertVariant, IconName> = { info: "info", success: "success", warning: "warning", error: "error" };

export interface AlertProps {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** `banner`: full-width strip at the top of a page or section, no card corners. */
  layout?: "inline" | "banner";
  /** Usually a Button — "Reessayer", "Voir". */
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * Announce the message when it appears: `alert` (interrupting) for errors
   * and warnings, `status` (polite) otherwise. Leave off for a message that is
   * part of the page from the start — a screen reader reads it in order.
   */
  announce?: boolean;
  className?: string;
  testId?: string;
}

/** Part 2B "Alert / Banner": an icon and a title as well as colour (WCAG 1.4.1). */
export function Alert({
  variant = "info",
  title,
  children,
  layout = "inline",
  action,
  onDismiss,
  dismissLabel = "Fermer le message",
  announce = false,
  className,
  testId,
}: AlertProps): JSX.Element {
  const role = announce ? (variant === "error" || variant === "warning" ? "alert" : "status") : undefined;

  return (
    <div className={cx("fx-alert", `fx-alert--${variant}`, layout === "banner" && "fx-alert--banner", className)} role={role} data-testid={testId}>
      <Icon name={VARIANT_ICON[variant]} className="fx-alert__icon" />
      <div className="fx-alert__content">
        {title === undefined ? null : <p className="fx-alert__title">{title}</p>}
        {children === undefined ? null : <div className="fx-alert__body">{children}</div>}
        {action === undefined ? null : <div className="fx-alert__actions">{action}</div>}
      </div>
      {onDismiss ? <IconButton label={dismissLabel} icon="close" onClick={onDismiss} className="fx-alert__dismiss" /> : null}
    </div>
  );
}
