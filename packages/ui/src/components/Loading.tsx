import type { CSSProperties, JSX } from "react";

import { cx } from "../cx.js";

export interface SpinnerProps {
  size?: "md" | "lg";
  className?: string;
}

/**
 * Purely decorative on its own — it carries no accessible name, so it must
 * be paired with text (see `Loading`) or placed inside an element that
 * already announces the busy state (see `Button`'s `loading`).
 */
export function Spinner({ size = "md", className }: SpinnerProps): JSX.Element {
  return <span className={cx("fx-spinner", size === "lg" && "fx-spinner--lg", className)} aria-hidden="true" />;
}

export interface LoadingProps {
  label?: string;
  testId?: string;
}

/** Announced politely to assistive tech (WCAG 2.2 AA 4.1.3) rather than silently spinning. */
export function Loading({ label = "Chargement…", testId }: LoadingProps): JSX.Element {
  return (
    <div className="fx-loading" role="status" aria-live="polite" data-testid={testId}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export interface SkeletonProps {
  /** Number of placeholder lines; the last one is rendered shorter, as real text tends to be. */
  lines?: number;
  label?: string;
  testId?: string;
}

export function Skeleton({ lines = 3, label = "Chargement…", testId }: SkeletonProps): JSX.Element {
  const rows = Array.from({ length: Math.max(1, lines) }, (_, index) => index);

  return (
    <div role="status" aria-live="polite" data-testid={testId}>
      <span className="fx-visually-hidden">{label}</span>
      {rows.map((index) => {
        const style: CSSProperties = {
          blockSize: "14px",
          marginBlockEnd: "8px",
          inlineSize: index === rows.length - 1 ? "60%" : "100%",
        };
        return <span key={`skeleton-line-${index.toString()}`} className="fx-skeleton" style={style} aria-hidden="true" />;
      })}
    </div>
  );
}
