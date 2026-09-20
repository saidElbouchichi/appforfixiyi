import type { JSX, ReactNode } from "react";

import { Button } from "./Button.js";

export interface ErrorStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  /** When provided, renders a retry button — an error the user cannot act on is a dead end. */
  onRetry?: () => void;
  retryLabel?: string;
  headingLevel?: 2 | 3 | 4;
  testId?: string;
}

/** `role="alert"` so the failure is announced as soon as it replaces the content (WCAG 2.2 AA 4.1.3). */
export function ErrorState({
  icon = "⚠",
  title = "Une erreur est survenue",
  message,
  onRetry,
  retryLabel = "Reessayer",
  headingLevel = 3,
  testId,
}: ErrorStateProps): JSX.Element {
  const Heading = `h${headingLevel.toString()}` as "h2" | "h3" | "h4";

  return (
    <div className="fx-state fx-state--error" role="alert" data-testid={testId}>
      <span className="fx-state__icon" aria-hidden="true">
        {icon}
      </span>
      <Heading className="fx-state__title">{title}</Heading>
      {message === undefined ? null : <p className="fx-state__message">{message}</p>}
      {onRetry === undefined ? null : (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
