import { useId, type JSX } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown as the first, empty-valued entry — the "nothing chosen yet" row. */
  placeholder?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  testId?: string;
}

/**
 * Controlled `<select>` with the same label/error/hint wiring as `Input`.
 *
 * It exists because `apps/web` and `apps/admin` were both hand-rolling a
 * `<select className="fx-field__control">` with a hand-written `<label
 * htmlFor>` — five copies in the request form alone, each one a chance to
 * forget the association. Disabling is derived from the options rather than
 * asked for: a cascading level with nothing to choose from is not a
 * judgement the caller should have to remember to pass.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "--",
  error = null,
  hint,
  required = false,
  disabled = false,
  name,
  testId,
}: SelectProps): JSX.Element {
  const generatedId = useId();
  const controlId = `${generatedId}-control`;
  const errorId = `${generatedId}-error`;
  const hintId = `${generatedId}-hint`;

  const describedBy = cx(error ? errorId : undefined, hint ? hintId : undefined);

  return (
    <div className="fx-field">
      <label className="fx-field__label" htmlFor={controlId}>
        {label}
        {required ? (
          <span className="fx-field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="fx-field__control-wrap fx-field__control-wrap--select">
        <select
          id={controlId}
          name={name}
          className="fx-field__control"
          value={value}
          required={required}
          disabled={disabled || options.length === 0}
          aria-invalid={error !== null}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
          data-testid={testId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" className="fx-field__chevron" />
      </div>

      {hint ? (
        <span className="fx-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error !== null && error.length > 0 ? (
        <span className="fx-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
