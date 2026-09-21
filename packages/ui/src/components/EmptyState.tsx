import type { JSX, ReactNode } from "react";

import { Icon } from "./Icon.js";

export interface EmptyStateProps {
  /** Defaults to the design system's own inline SVG — no icon library is a dependency of this package. */
  icon?: ReactNode;
  title: string;
  message?: string;
  /** Usually a `<Button>` — the way out of the empty state. */
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  testId?: string;
}

export function EmptyState({
  icon = <Icon name="info" size="xl" />,
  title,
  message,
  action,
  headingLevel = 3,
  testId,
}: EmptyStateProps): JSX.Element {
  const Heading = `h${headingLevel.toString()}` as "h2" | "h3" | "h4";

  return (
    <div className="fx-state" data-testid={testId}>
      <span className="fx-state__icon" aria-hidden="true">
        {icon}
      </span>
      <Heading className="fx-state__title">{title}</Heading>
      {message === undefined ? null : <p className="fx-state__message">{message}</p>}
      {action}
    </div>
  );
}
