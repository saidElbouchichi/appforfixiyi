import { useId, type JSX } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";

export type InputType = "text" | "tel" | "email" | "number" | "password" | "search";

export interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: InputType;
  /** Renders a `<textarea>` instead of an `<input>` — same label/error wiring. */
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  /** Non-null puts the control in the invalid state and links the message via `aria-describedby`. */
  error?: string | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  autoComplete?: string;
  /** Decorative glyph at the inline start of a single-line field (e.g. `search`, `phone`). */
  iconStart?: IconName;
  maxLength?: number;
  testId?: string;
}

/**
 * Controlled field with the label/error/hint wiring done once, correctly:
 * `htmlFor`/`id` association (so a click on the label focuses the control,
 * and `getByLabelText` finds it), `aria-invalid` and `aria-describedby`
 * pointing at the real error/hint nodes — WCAG 2.2 AA 1.3.1/3.3.1/3.3.2.
 */
export function Input({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  rows = 4,
  placeholder,
  error = null,
  hint,
  required = false,
  disabled = false,
  name,
  autoComplete,
  iconStart,
  maxLength,
  testId,
}: InputProps): JSX.Element {
  const generatedId = useId();
  const controlId = `${generatedId}-control`;
  const errorId = `${generatedId}-error`;
  const hintId = `${generatedId}-hint`;

  const describedBy = cx(error ? errorId : undefined, hint ? hintId : undefined);

  const shared = {
    id: controlId,
    name,
    value,
    placeholder,
    required,
    disabled,
    autoComplete,
    maxLength,
    "aria-invalid": error !== null,
    "aria-describedby": describedBy.length > 0 ? describedBy : undefined,
    "data-testid": testId,
  };

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

      {multiline ? (
        <textarea
          {...shared}
          rows={rows}
          className="fx-field__control fx-field__control--textarea"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <div className={cx("fx-field__control-wrap", iconStart && "fx-field__control-wrap--icon")}>
          {iconStart ? <Icon name={iconStart} className="fx-field__icon" /> : null}
          <input
            {...shared}
            type={type}
            className="fx-field__control"
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        </div>
      )}

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

export type TextareaProps = Omit<InputProps, "multiline" | "type" | "iconStart">;

/**
 * Multi-line field (part 2B "Textarea"). An alias of `<Input multiline>`, not
 * a second implementation: one label/error/hint wiring for every field.
 */
export function Textarea(props: TextareaProps): JSX.Element {
  return <Input {...props} multiline />;
}
