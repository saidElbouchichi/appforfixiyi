import { useId, useRef, type JSX, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  content: ReactNode;
}

export interface TabsProps {
  /** Names the tab list ("Sections du profil"). */
  label: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  testId?: string;
}

/**
 * Part 2B "Tabs", following the ARIA tabs pattern with automatic
 * activation: one tab stop for the whole list, arrow keys move and select
 * (swapped in RTL, where "next" is on the left), Home/End jump. Every panel
 * stays in the DOM (`hidden` when inactive), so each `aria-controls` resolves.
 */
export function Tabs({ label, tabs, value, onChange, testId }: TabsProps): JSX.Element {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );

  function select(index: number): void {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (!tab) return;
    onChange(tab.id);
    tabsRef.current[tabs.indexOf(tab)]?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent): void {
    const rtl = listRef.current ? getComputedStyle(listRef.current).direction === "rtl" : false;
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    const targets: Record<string, number> = { [forward]: selected + 1, [backward]: selected - 1, Home: 0, End: tabs.length - 1 };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div className="fx-tabs" data-testid={testId}>
      <div className="fx-tabs__list" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabsRef.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            className={cx("fx-tabs__tab", index === selected && "fx-tabs__tab--selected")}
            aria-selected={index === selected}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => {
              onChange(tab.id);
            }}
          >
            {tab.icon ? <Icon name={tab.icon} size="sm" /> : null}
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          className="fx-tabs__panel"
          tabIndex={0}
          hidden={index !== selected}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
