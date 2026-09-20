import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

export interface CardProps {
  title?: ReactNode;
  /**
   * Heading level of `title`. Explicit rather than hardcoded so a page keeps
   * a correct heading outline (WCAG 2.2 AA 1.3.1) — a card under an `<h1>`
   * needs `2`, a card nested in a section needs `3`.
   */
  headingLevel?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
  testId?: string;
}

export function Card({ title, headingLevel = 3, children, className, testId }: CardProps): JSX.Element {
  const Heading = `h${headingLevel.toString()}` as "h2" | "h3" | "h4";

  return (
    <div className={cx("fx-card", className)} data-testid={testId}>
      {title === undefined ? null : <Heading className="fx-card__title">{title}</Heading>}
      {children}
    </div>
  );
}
