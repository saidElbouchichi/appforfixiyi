import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** Destructive action ("Supprimer"): error colour and its own icon, never colour alone. */
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Accessible name of the trigger ("Actions sur le message"). */
  label: string;
  items: MenuItem[];
  /** Trigger glyph; the trigger is icon-only, named by `label`. */
  icon?: IconName;
  /** Which inline edge of the trigger the menu aligns to. */
  align?: "start" | "end";
  testId?: string;
}

const enabledIndexes = (items: MenuItem[]): number[] => items.flatMap((item, index) => (item.disabled ? [] : [index]));

/**
 * Part 2B "Dropdown / Menu", following the ARIA menu button pattern: the
 * trigger opens it with Enter, Space or the arrow keys; arrows move (and
 * wrap), Home/End jump, a letter jumps to the next item starting with it,
 * Escape closes and returns focus to the trigger, Tab closes and lets focus
 * move on, a click outside closes.
 */
export function Menu({ label, items, icon = "more", align = "end", testId }: MenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const menuId = `${baseId}-menu`;
  const triggerId = `${baseId}-trigger`;
  const enabled = enabledIndexes(items);

  useEffect(() => {
    if (open && active >= 0) itemsRef.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function openAt(position: "first" | "last"): void {
    setActive((position === "first" ? enabled[0] : enabled[enabled.length - 1]) ?? -1);
    setOpen(true);
  }

  function close(returnFocus: boolean): void {
    setOpen(false);
    setActive(-1);
    if (returnFocus) triggerRef.current?.focus();
  }

  function move(step: 1 | -1): void {
    const position = enabled.indexOf(active);
    const next = enabled[(position + step + enabled.length) % enabled.length];
    if (next !== undefined) setActive(next);
  }

  function onMenuKeyDown(event: ReactKeyboardEvent): void {
    const actions: Record<string, () => void> = {
      ArrowDown: () => {
        move(1);
      },
      ArrowUp: () => {
        move(-1);
      },
      Home: () => {
        setActive(enabled[0] ?? -1);
      },
      End: () => {
        setActive(enabled[enabled.length - 1] ?? -1);
      },
      Escape: () => {
        close(true);
      },
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key.length === 1) {
      jumpToLetter(event.key.toLocaleLowerCase());
    }
  }

  function jumpToLetter(letter: string): void {
    const ordered = [...enabled.filter((index) => index > active), ...enabled.filter((index) => index <= active)];
    const match = ordered.find((index) => items[index]?.label.toLocaleLowerCase().startsWith(letter));
    if (match !== undefined) setActive(match);
  }

  return (
    <div className="fx-menu" ref={rootRef} data-testid={testId}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="fx-icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) close(false);
          else openAt("first");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAt(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
      >
        <Icon name={icon} size="sm" />
      </button>
      {open ? (
        <div className={cx("fx-menu__list", `fx-menu__list--${align}`)} role="menu" id={menuId} aria-labelledby={triggerId} onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemsRef.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx("fx-menu__item", item.danger && "fx-menu__item--danger")}
              aria-disabled={item.disabled}
              onPointerEnter={() => {
                if (!item.disabled) setActive(index);
              }}
              onClick={() => {
                if (item.disabled) return;
                close(true);
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} size="sm" /> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
