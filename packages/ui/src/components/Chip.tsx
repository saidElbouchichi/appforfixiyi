import type { JSX } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";

export interface ChipProps {
  label: string;
  icon?: IconName | undefined;
  /** Makes the chip a toggle button (a filter): announced pressed / not pressed. */
  onToggle?: (selected: boolean) => void;
  selected?: boolean;
  /** Adds a remove button (a chosen value in a list). */
  onRemove?: () => void;
  /** Accessible name of the remove button, completed with the label: "Retirer Plomberie". */
  removeLabel?: string;
  disabled?: boolean;
  testId?: string;
}

/**
 * Something the user selects or removes (part 2B "Chip / Tag"). A status the
 * user cannot act on is a `Badge`. Selection is shown by a check as well as
 * by colour (WCAG 1.4.1).
 */
export function Chip({ label, icon, onToggle, selected = false, onRemove, removeLabel = "Retirer", disabled = false, testId }: ChipProps): JSX.Element {
  const content = (
    <>
      {selected ? <Icon name="check" size="sm" /> : icon ? <Icon name={icon} size="sm" /> : null}
      <span>{label}</span>
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        className={cx("fx-chip", "fx-chip--toggle", selected && "fx-chip--selected")}
        aria-pressed={selected}
        disabled={disabled}
        data-testid={testId}
        onClick={() => {
          onToggle(!selected);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={cx("fx-chip", selected && "fx-chip--selected")} data-testid={testId}>
      {content}
      {onRemove ? (
        <button type="button" className="fx-chip__remove" aria-label={`${removeLabel} ${label}`} disabled={disabled} onClick={onRemove}>
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </span>
  );
}
