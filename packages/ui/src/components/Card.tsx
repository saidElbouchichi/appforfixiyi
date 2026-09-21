import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

/** Coloured start edge: draws the eye to one card in a list (part 2B §20 "highlighted"). */
export type CardHighlight = "brand" | "info" | "success" | "warning" | "error";

export interface CardProps {
  title?: ReactNode;
  /**
   * Heading level of `title`. Explicit rather than hardcoded so a page keeps
   * a correct heading outline (WCAG 2.2 AA 1.3.1) — a card under an `<h1>`
   * needs `2`, a card nested in a section needs `3`.
   */
  headingLevel?: 2 | 3 | 4;
  children: ReactNode;
  /** Element to render: `article` for a self-contained item of a list (a request, a provider). */
  as?: "div" | "article" | "section";
  /**
   * The whole card responds to the pointer (lift + shadow) and shows the
   * focus ring. The card's ONE primary link or button must carry
   * `className="fx-card__primary-action"`: it is stretched over the card, so a
   * click anywhere follows it while other buttons inside stay usable — a
   * card wrapped in a <button> could not contain any.
   */
  interactive?: boolean;
  highlight?: CardHighlight;
  /** Brand gradient border (part 2B §20). Decorative: say what it means in the content too. */
  gradientBorder?: boolean;
  /** Pinned to the top inline-end corner, usually a Badge ("Nouveau"). */
  cornerBadge?: ReactNode;
  /** Full-bleed header, e.g. a real photo. Never a stock or invented one (D4). */
  media?: ReactNode;
  /** Separated bottom band, e.g. figures about the item. */
  footer?: ReactNode;
  className?: string;
  testId?: string;
}

export function Card({
  title,
  headingLevel = 3,
  children,
  as: Element = "div",
  interactive = false,
  highlight,
  gradientBorder = false,
  cornerBadge,
  media,
  footer,
  className,
  testId,
}: CardProps): JSX.Element {
  const Heading = `h${headingLevel.toString()}` as "h2" | "h3" | "h4";

  return (
    <Element
      className={cx(
        "fx-card",
        interactive && "fx-card--interactive",
        highlight && `fx-card--highlight fx-card--highlight-${highlight}`,
        gradientBorder && "fx-card--gradient-border",
        className,
      )}
      data-testid={testId}
    >
      {media === undefined ? null : <div className="fx-card__media">{media}</div>}
      <div className="fx-card__body">
        {title === undefined ? null : <Heading className="fx-card__title">{title}</Heading>}
        {children}
      </div>
      {footer === undefined ? null : <div className="fx-card__footer">{footer}</div>}
      {cornerBadge === undefined ? null : <div className="fx-card__corner">{cornerBadge}</div>}
    </Element>
  );
}
