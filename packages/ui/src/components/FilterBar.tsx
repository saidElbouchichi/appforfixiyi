import { useId, type JSX } from "react";

import { Button } from "./Button.js";
import { Chip } from "./Chip.js";
import type { IconName } from "./Icon.js";

export interface FilterOption {
  value: string;
  label: string;
  icon?: IconName;
}

export interface FilterBarProps {
  /** Names the group for assistive tech ("Filtrer par metier"). */
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** `false`: picking one filter replaces the other (a single category). */
  multiple?: boolean;
  resetLabel?: string;
  testId?: string;
}

/**
 * A row of toggle chips that scrolls sideways on a phone instead of wrapping
 * into a wall (part 2B "FilterBar"). The options are whatever the caller
 * passes — the real catalogue, never an invented list.
 */
export function FilterBar({ label, options, selected, onChange, multiple = true, resetLabel = "Tout effacer", testId }: FilterBarProps): JSX.Element {
  const labelId = `${useId()}-label`;

  function toggle(value: string, on: boolean): void {
    if (!multiple) {
      onChange(on ? [value] : []);
      return;
    }
    onChange(on ? [...selected, value] : selected.filter((current) => current !== value));
  }

  return (
    <div className="fx-filter-bar" role="group" aria-labelledby={labelId} data-testid={testId}>
      <span className="fx-visually-hidden" id={labelId}>
        {label}
      </span>
      <div className="fx-filter-bar__scroller">
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            icon={option.icon}
            selected={selected.includes(option.value)}
            onToggle={(on) => {
              toggle(option.value, on);
            }}
          />
        ))}
      </div>
      {selected.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange([]);
          }}
        >
          {resetLabel}
        </Button>
      ) : null}
    </div>
  );
}
