import type { ButtonHTMLAttributes, JSX } from "react";

import { cx } from "../cx.js";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Full-width button (forms on small screens). */
  block?: boolean;
  /** Shows a spinner and blocks interaction — the button stays in the tab order and announces `aria-busy`. */
  loading?: boolean;
  testId?: string;
}

/**
 * `type` defaults to `"button"`: an unspecified `<button>` inside a form
 * defaults to `submit` in HTML, which silently submits forms on click.
 */
export function Button({
  variant = "primary",
  block = false,
  loading = false,
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
      className={cx("fx-button", `fx-button--${variant}`, block && "fx-button--block", className)}
      disabled={disabled || loading}
      aria-busy={loading}
      data-testid={testId}
      {...rest}
    >
      {loading ? <span className="fx-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
