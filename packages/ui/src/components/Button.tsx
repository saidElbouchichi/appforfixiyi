import type { ButtonHTMLAttributes, JSX } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

/**
 * Part 2B §19. `gradient` is the brand's orange-to-yellow CTA (dark label:
 * white on the yellow end would fail 1.4.3). `pulse` is the urgent CTA: a
 * primary button whose ring pulses three times and stops (WCAG 2.2.2).
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "gradient" | "pulse";

/** 32 / 40 / 48 / 56px; sm and md grow to the 44px touch target on a coarse pointer. */
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full-width button (forms on small screens). */
  block?: boolean;
  /** Shows a spinner and blocks interaction — the button stays in the tab order and announces `aria-busy`. */
  loading?: boolean;
  /**
   * Confirms a finished action (e.g. "Enregistre"): green, with a check. The
   * caller changes the label too — the colour and icon are never the only
   * signal (WCAG 1.4.1).
   */
  success?: boolean;
  testId?: string;
}

/**
 * `type` defaults to `"button"`: an unspecified `<button>` inside a form
 * defaults to `submit` in HTML, which silently submits forms on click.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  success = false,
  disabled = false,
  type = "button",
  className,
  children,
  testId,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cx(
        "fx-button",
        `fx-button--${variant}`,
        `fx-button--${size}`,
        block && "fx-button--block",
        success && "fx-button--success",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      data-testid={testId}
      {...rest}
    >
      {loading ? <span className="fx-spinner" aria-hidden="true" /> : null}
      {success && !loading ? <Icon name="check" size="sm" /> : null}
      {children}
    </button>
  );
}
