import { useEffect, useId, useRef, type JSX } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "Some, not all" — announced as mixed. Set by a parent checkbox over a list. */
  indeterminate?: boolean;
  /** Secondary line under the label, linked with `aria-describedby`. */
  description?: string;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  testId?: string;
}

/**
 * A native checkbox (keyboard, forms, screen readers for free) drawn over:
 * the input keeps focus and state, the box and the check are its styled
 * siblings. The whole row is the label, so the target is the row, not the
 * 20px box (WCAG 2.5.8).
 */
export function Checkbox({
  label,
  checked,
  onChange,
  indeterminate = false,
  description,
  error = null,
  disabled = false,
  required = false,
  name,
  value,
  testId,
}: CheckboxProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasError = error !== null && error.length > 0;
  const describedBy = cx(description ? descriptionId : undefined, hasError ? errorId : undefined);

  // `indeterminate` exists only as a DOM property, never as an attribute.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className="fx-checkbox">
      <label className="fx-checkbox__row">
        <span className="fx-checkbox__box">
          <input
            ref={inputRef}
            type="checkbox"
            className="fx-checkbox__input"
            checked={checked}
            disabled={disabled}
            required={required}
            name={name}
            value={value}
            aria-invalid={hasError}
            aria-describedby={describedBy.length > 0 ? describedBy : undefined}
            data-testid={testId}
            onChange={(event) => {
              onChange(event.target.checked);
            }}
          />
          <Icon name={indeterminate ? "minus" : "check"} size="sm" className="fx-checkbox__mark" />
        </span>
        <span className="fx-checkbox__text">
          <span className="fx-checkbox__label">{label}</span>
          {description ? (
            <span className="fx-checkbox__description" id={descriptionId}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {hasError ? (
        <span className="fx-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
