import { useId, type JSX } from "react";

import { cx } from "../cx.js";

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Secondary line under the label, linked with `aria-describedby`. */
  description?: string;
  disabled?: boolean;
  testId?: string;
}

/**
 * An on/off setting that applies immediately (a checkbox is for choices
 * submitted with a form). `role="switch"` announces "on/off"; the visible
 * label is a real <label>, so clicking the text toggles too. The thumb
 * slides along the inline axis, so it starts on the right in Arabic.
 */
export function Switch({ label, checked, onChange, description, disabled = false, testId }: SwitchProps): JSX.Element {
  const id = useId();
  const controlId = `${id}-control`;
  const descriptionId = `${id}-description`;

  return (
    <div className="fx-switch">
      <span className="fx-switch__text">
        <label className="fx-switch__label" htmlFor={controlId}>
          {label}
        </label>
        {description ? (
          <span className="fx-switch__description" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        id={controlId}
        className={cx("fx-switch__track", checked && "fx-switch__track--on")}
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        data-testid={testId}
        onClick={() => {
          onChange(!checked);
        }}
      >
        <span className="fx-switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );
}
