import { useId, type CSSProperties, type JSX } from "react";

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /**
   * How the value reads, visibly and to a screen reader (`aria-valuetext`):
   * "10 km" says more than "10".
   */
  formatValue?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
  name?: string;
  testId?: string;
}

/**
 * A native range input (arrow keys, Page Up/Down, Home/End, touch drag and
 * RTL all come from the browser) with the field's label and a live value.
 * The filled part of the track is a gradient stop fed by `--fx-slider-fill`.
 */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue = (current) => current.toString(),
  hint,
  disabled = false,
  name,
  testId,
}: SliderProps): JSX.Element {
  const id = useId();
  const controlId = `${id}-control`;
  const hintId = `${id}-hint`;
  const span = max - min;
  const fill = span > 0 ? ((Math.min(Math.max(value, min), max) - min) / span) * 100 : 0;
  const text = formatValue(value);

  return (
    <div className="fx-field">
      <div className="fx-slider__header">
        <label className="fx-field__label" htmlFor={controlId}>
          {label}
        </label>
        <output className="fx-slider__value" htmlFor={controlId} dir="auto">
          {text}
        </output>
      </div>
      <input
        type="range"
        id={controlId}
        className="fx-slider"
        style={{ "--fx-slider-fill": `${fill.toString()}%` } as CSSProperties}
        value={value}
        min={min}
        max={max}
        step={step}
        name={name}
        disabled={disabled}
        aria-valuetext={text}
        aria-describedby={hint ? hintId : undefined}
        data-testid={testId}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      {hint ? (
        <span className="fx-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
