import { useEffect, useId, useState, type JSX, type ReactNode } from "react";

import { cx } from "../cx.js";

export interface TooltipProps {
  /** A short supplement. Never essential: a touch screen has no hover. */
  content: string;
  /**
   * Renders the trigger — one focusable element (a button, a link) — and
   * receives the id to put in its `aria-describedby`:
   * `{(describedBy) => <IconButton label="Aide" icon="info" describedBy={describedBy} />}`.
   */
  children: (describedBy: string) => ReactNode;
  placement?: "top" | "bottom";
}

/**
 * Part 2B "Tooltip", held to WCAG 1.4.13: it shows on hover AND on keyboard
 * focus, `Escape` hides it without moving focus (dismissible), the pointer
 * can move onto it without it vanishing (hoverable — it lives inside the
 * wrapper, with a bridge over the gap), and it stays until the pointer or
 * focus leaves (persistent). The text stays in the DOM when hidden, so
 * `aria-describedby` always reads.
 */
export function Tooltip({ content, children, placement = "top" }: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const tooltipId = `${useId()}-tooltip`;

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      className="fx-tooltip"
      onPointerEnter={() => {
        setOpen(true);
      }}
      onPointerLeave={() => {
        setOpen(false);
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onBlur={() => {
        setOpen(false);
      }}
    >
      {children(tooltipId)}
      <span role="tooltip" id={tooltipId} className={cx("fx-tooltip__bubble", `fx-tooltip__bubble--${placement}`)} data-open={open}>
        {content}
      </span>
    </span>
  );
}
