import { useId, useState, type CSSProperties, type JSX } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

const frenchNumber = (value: number): string => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export interface RatingProps {
  /** A real average from real reviews (Phase 10) — never a placeholder. */
  value: number;
  max?: number;
  /** Number of reviews behind the average, shown as "(124 avis)". */
  count?: number | undefined;
  size?: "sm" | "md";
  formatLabel?: (value: number, max: number, count: number | undefined) => string;
  testId?: string;
}

const defaultLabel = (value: number, max: number, count: number | undefined): string =>
  `Note ${frenchNumber(value)} sur ${max.toString()}${count === undefined ? "" : `, ${count.toString()} avis`}`;

/**
 * Part 2B "Rating — affichage". One labelled image; the stars are drawn twice
 * (outline row, filled row clipped to the share) so 4.3 shows 4.3 stars.
 * The value is also printed: stars alone would be colour-and-shape only.
 */
export function Rating({ value, max = 5, count, size = "md", formatLabel = defaultLabel, testId }: RatingProps): JSX.Element {
  const share = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const stars = Array.from({ length: max }, (_, index) => index);
  const iconSize = size === "sm" ? "sm" : "md";

  return (
    <span className={cx("fx-rating", `fx-rating--${size}`)} role="img" aria-label={formatLabel(value, max, count)} data-testid={testId}>
      <span className="fx-rating__stars" aria-hidden="true" style={{ "--fx-rating-share": `${share.toString()}%` } as CSSProperties}>
        <span className="fx-rating__row">
          {stars.map((index) => (
            <Icon key={index} name="star" size={iconSize} />
          ))}
        </span>
        <span className="fx-rating__row fx-rating__row--filled">
          {stars.map((index) => (
            <Icon key={index} name="star" size={iconSize} />
          ))}
        </span>
      </span>
      <span className="fx-rating__value" aria-hidden="true">
        {frenchNumber(value)}
        {count === undefined ? null : <span className="fx-rating__count"> ({count.toString()} avis)</span>}
      </span>
    </span>
  );
}

export interface RatingInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  starLabel?: (stars: number) => string;
  error?: string | null;
  name?: string;
  testId?: string;
}

/**
 * Part 2B "Rating — etoiles cliquables": a radio group (arrow keys, one tab
 * stop, form semantics for free), each radio drawn as a star. Hovering
 * previews; the chosen value stays until another is picked.
 */
export function RatingInput({
  label,
  value,
  onChange,
  max = 5,
  starLabel = (stars) => `${stars.toString()} etoile${stars > 1 ? "s" : ""}`,
  error = null,
  name,
  testId,
}: RatingInputProps): JSX.Element {
  const baseId = useId();
  const groupName = name ?? `${baseId}-rating`;
  const errorId = `${baseId}-error`;
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;
  const hasError = error !== null && error.length > 0;

  return (
    <fieldset className="fx-rating-input" aria-describedby={hasError ? errorId : undefined} data-testid={testId}>
      <legend className="fx-field__label">{label}</legend>
      <span
        className="fx-rating-input__stars"
        onPointerLeave={() => {
          setPreview(null);
        }}
      >
        {Array.from({ length: max }, (_, index) => index + 1).map((stars) => (
          <label
            key={stars}
            className={cx("fx-rating-input__star", stars <= shown && "fx-rating-input__star--on")}
            onPointerEnter={() => {
              setPreview(stars);
            }}
          >
            <input
              type="radio"
              className="fx-visually-hidden"
              name={groupName}
              value={stars}
              checked={value === stars}
              onChange={() => {
                onChange(stars);
              }}
            />
            <Icon name="star" size="lg" />
            <span className="fx-visually-hidden">{starLabel(stars)}</span>
          </label>
        ))}
      </span>
      {hasError ? (
        <span className="fx-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
