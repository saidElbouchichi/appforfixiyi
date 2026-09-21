import { useCallback, useEffect, useId, useMemo, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";
import { useDialog } from "./useDialog.js";

export interface Command {
  id: string;
  label: string;
  /** Heading the command is listed under ("Navigation", "Demandes"). */
  group?: string;
  /** Other words that should find it ("devis" for "Offres"). */
  keywords?: string[];
  icon?: IconName;
  onRun: () => void;
}

/** Lower case, accents removed: "electricite" finds "Électricité". */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}

/** Commands whose label or keywords contain every word of the query, in their original order. */
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  return commands.filter((command) => {
    const haystack = normalizeSearch([command.label, ...(command.keywords ?? [])].join(" "));
    return words.every((word) => haystack.includes(word));
  });
}

/** Opens the palette on Ctrl+K / Cmd+K anywhere on the page. */
export function useCommandPaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpen]);
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Real destinations and actions only — each `onRun` must do something that exists. */
  commands: Command[];
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  resultsLabel?: (count: number) => string;
  testId?: string;
}

/**
 * Part 2B "Command Palette (Cmd+K)": a dialog (`useDialog`) holding a
 * combobox over a listbox. Focus stays in the field; ArrowUp/Down move the
 * active option (`aria-activedescendant`), Enter runs it, Escape closes. The
 * number of results is announced politely as the query changes.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  label = "Palette de commandes",
  placeholder = "Rechercher une action ou une page…",
  emptyLabel = "Aucun resultat",
  resultsLabel = (count) => `${count.toString()} resultat${count > 1 ? "s" : ""}`,
  testId,
}: CommandPaletteProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const baseId = useId();
  const listId = `${baseId}-list`;
  // Grouped before indexing, so arrow-key order is the order on screen.
  const results = useMemo(() => {
    const matches = filterCommands(commands, query);
    const groupOrder = [...new Set(matches.map((command) => command.group ?? ""))];
    return groupOrder.flatMap((group) => matches.filter((command) => (command.group ?? "") === group));
  }, [commands, query]);

  // The palette stays mounted while closed: closing clears the query for next time.
  const close = useCallback(() => {
    setQuery("");
    setActive(0);
    onClose();
  }, [onClose]);
  useDialog(open, close, dialogRef, inputRef);

  if (!open) return null;

  function run(command: Command | undefined): void {
    if (!command) return;
    close();
    command.onRun();
  }

  function onKeyDown(event: ReactKeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (results.length === 0 ? 0 : (current + step + results.length) % results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]);
    }
  }

  const groups = [...new Set(results.map((command) => command.group ?? ""))];

  return (
    <div
      className="fx-modal__overlay fx-palette__overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="fx-palette" role="dialog" aria-modal="true" aria-label={label} ref={dialogRef} tabIndex={-1} data-testid={testId}>
        <div className="fx-palette__field">
          <Icon name="search" className="fx-palette__icon" />
          <input
            ref={inputRef}
            className="fx-palette__input"
            role="combobox"
            aria-label={label}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${baseId}-option-${results[active].id}` : undefined}
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="fx-palette__list" role="listbox" id={listId} aria-label={label}>
          {groups.map((group) => (
            <div key={group} role="group" aria-label={group || undefined} className="fx-palette__group">
              {group ? (
                <div className="fx-palette__group-label" aria-hidden="true">
                  {group}
                </div>
              ) : null}
              {results
                .filter((command) => (command.group ?? "") === group)
                .map((command) => {
                  const index = results.indexOf(command);
                  return (
                    <div
                      key={command.id}
                      id={`${baseId}-option-${command.id}`}
                      role="option"
                      aria-selected={index === active}
                      className={cx("fx-palette__option", index === active && "fx-palette__option--active")}
                      onPointerEnter={() => {
                        setActive(index);
                      }}
                      onClick={() => {
                        run(command);
                      }}
                    >
                      {command.icon ? <Icon name={command.icon} size="sm" /> : null}
                      {command.label}
                    </div>
                  );
                })}
            </div>
          ))}
          {results.length === 0 ? <p className="fx-palette__empty">{emptyLabel}</p> : null}
        </div>
        <p className="fx-visually-hidden" role="status">
          {query ? resultsLabel(results.length) : ""}
        </p>
      </div>
    </div>
  );
}
