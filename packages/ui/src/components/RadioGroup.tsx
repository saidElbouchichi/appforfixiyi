import { useId, type JSX } from "react";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

export interface RadioGroupProps<T extends string> {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  name?: string;
  disabled?: boolean;
  /** `data-testid` per option, suffixed with the option value (e.g. `urgency-NORMAL`). */
  testIdPrefix?: string;
}

/**
 * A real `<fieldset>`/`<legend>` group of radios.
 *
 * The hand-written version this replaces put two bare `<input type="radio">`
 * inside a `<legend className="fx-field__label">` fieldset with a 16px
 * target and no visible selected state beyond the native dot. Here each
 * option is a 44px label-wrapped target (WCAG 2.2 AA 2.5.8), the native
 * radio stays visible so selection is not conveyed by colour alone (1.4.1),
 * and the focus ring is driven by `:has(input:focus-visible)` so keyboard
 * focus lands somewhere visible rather than on an invisible input.
 *
 * Generic over the value type so a caller with a union (`"NORMAL" |
 * "URGENT"`) gets that union back in `onChange`, not a widened `string`.
 */
export function RadioGroup<T extends string>({
  legend,
  value,
  onChange,
  options,
  name,
  disabled = false,
  testIdPrefix,
}: RadioGroupProps<T>): JSX.Element {
  const generatedId = useId();
  const groupName = name ?? generatedId;

  return (
    <fieldset className="fx-field">
      <legend className="fx-field__label">{legend}</legend>
      <div className="fx-choices">
        {options.map((option) => (
          <label className="fx-choice" key={option.value}>
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              data-testid={testIdPrefix === undefined ? undefined : `${testIdPrefix}-${option.value}`}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
