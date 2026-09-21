import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";

export interface IconButtonProps {
  /**
   * REQUIRED accessible name. An icon-only button is the single most common
   * way to ship a control a screen reader announces as just "button" (WCAG
   * 2.2 AA 4.1.2) — making the label mandatory makes that impossible here.
   */
  label: string;
  icon?: IconName;
  /** For a glyph that is not an Icon (e.g. an emoji); rendered `aria-hidden`, the label speaks. */
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Toggle state, announced as pressed / not pressed. */
  pressed?: boolean;
  /** For a button that opens something (a menu, a picker). */
  expanded?: boolean;
  /** Id of an element that describes the button further (a Tooltip). */
  describedBy?: string | undefined;
  className?: string;
  testId?: string;
}

/** 44px target whatever the glyph size (WCAG 2.2 AA 2.5.8), always `type="button"`. */
export function IconButton({ label, icon, children, onClick, disabled = false, pressed, expanded, describedBy, className, testId }: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={cx("fx-icon-button", className)}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {icon ? <Icon name={icon} size="sm" /> : <span aria-hidden="true">{children}</span>}
    </button>
  );
}
