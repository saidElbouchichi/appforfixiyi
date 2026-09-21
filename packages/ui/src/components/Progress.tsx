import { useId, type CSSProperties, type JSX } from "react";

import { cx } from "../cx.js";

const percentOf = (value: number, max: number): number => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);

const defaultFormat = (value: number, max: number): string => `${Math.round(percentOf(value, max)).toString()} %`;

export interface ProgressBarProps {
  /** Visible label, also the accessible name ("Envoi des photos"). */
  label: string;
  /** Leave undefined while the amount is unknown: the bar becomes indeterminate. */
  value?: number | undefined;
  max?: number;
  showValue?: boolean;
  formatValue?: (value: number, max: number) => string;
  testId?: string;
}

/** Part 2B "Progress (bar)". `role="progressbar"` with min/max/now and a readable value text. */
export function ProgressBar({ label, value, max = 100, showValue = false, formatValue = defaultFormat, testId }: ProgressBarProps): JSX.Element {
  const labelId = `${useId()}-label`;
  const determinate = value !== undefined;
  const text = determinate ? formatValue(value, max) : undefined;

  return (
    <div className="fx-progress">
      <div className="fx-progress__header">
        <span id={labelId}>{label}</span>
        {showValue && text !== undefined ? <span className="fx-progress__value">{text}</span> : null}
      </div>
      <div
        className={cx("fx-progress__track", !determinate && "fx-progress__track--indeterminate")}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={determinate ? value : undefined}
        aria-valuetext={text}
        data-testid={testId}
      >
        <span className="fx-progress__bar" style={determinate ? { inlineSize: `${percentOf(value, max).toString()}%` } : undefined} />
      </div>
    </div>
  );
}

export type ProgressCircleSize = "sm" | "md" | "lg";

const CIRCLE_PIXELS: Record<ProgressCircleSize, number> = { sm: 32, md: 48, lg: 64 };

export interface ProgressCircleProps {
  label: string;
  value: number;
  max?: number;
  size?: ProgressCircleSize;
  /** The percentage in the middle (not on `sm`, too small to read). */
  showValue?: boolean;
  formatValue?: (value: number, max: number) => string;
  testId?: string;
}

/** Part 2B "Progress (circle)": a ring drawn with stroke-dashoffset on a 36-unit grid. */
export function ProgressCircle({ label, value, max = 100, size = "md", showValue = true, formatValue = defaultFormat, testId }: ProgressCircleProps): JSX.Element {
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentOf(value, max) / 100);
  const text = formatValue(value, max);
  const pixels = CIRCLE_PIXELS[size];

  return (
    <div
      className={cx("fx-progress-circle", `fx-progress-circle--${size}`)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={text}
      style={{ "--fx-progress-size": `${pixels.toString()}px` } as CSSProperties}
      data-testid={testId}
    >
      <svg viewBox="0 0 36 36" width={pixels} height={pixels} aria-hidden="true" focusable="false">
        <circle className="fx-progress-circle__track" cx="18" cy="18" r={radius} />
        <circle className="fx-progress-circle__bar" cx="18" cy="18" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      {showValue && size !== "sm" ? (
        <span className="fx-progress-circle__value" aria-hidden="true">
          {text}
        </span>
      ) : null}
    </div>
  );
}
