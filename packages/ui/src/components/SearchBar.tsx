import { useId, useRef, type JSX } from "react";

import { Icon } from "./Icon.js";

export interface SearchBarProps {
  /** Accessible name of the field; shown only to assistive tech (the icon and placeholder say it visually). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter (or the keyboard's search key) submits. Debouncing live results is the caller's job. */
  onSubmit?: ((value: string) => void) | undefined;
  placeholder?: string;
  clearLabel?: string;
  testId?: string;
}

/**
 * The search field of the board: a `role="search"` landmark, a search icon,
 * and a clear button that puts focus back in the field. The browser's own
 * clear cross is hidden so there is only one.
 */
export function SearchBar({ label, value, onChange, onSubmit, placeholder, clearLabel = "Effacer la recherche", testId }: SearchBarProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const controlId = `${useId()}-search`;

  return (
    <form
      role="search"
      className="fx-search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <label className="fx-visually-hidden" htmlFor={controlId}>
        {label}
      </label>
      <Icon name="search" className="fx-search__icon" />
      <input
        ref={inputRef}
        id={controlId}
        type="search"
        className="fx-search__input"
        value={value}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        data-testid={testId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {value.length > 0 ? (
        <button
          type="button"
          className="fx-search__clear"
          aria-label={clearLabel}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </form>
  );
}
