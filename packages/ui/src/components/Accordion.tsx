import { useId, useState, type JSX, type ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Level of the heading around each toggle, to fit the page outline (WCAG 1.3.1). */
  headingLevel?: 2 | 3 | 4;
  /** Several sections may be open at once. */
  multiple?: boolean;
  defaultExpanded?: string[];
  testId?: string;
}

/**
 * Part 2B "Accordion", following the ARIA accordion pattern: each header is
 * a real heading wrapping a button with `aria-expanded` / `aria-controls`;
 * each panel is a region named by its header. Collapsed panels are `hidden`,
 * so they are out of the tab order and the accessibility tree.
 */
export function Accordion({ items, headingLevel = 3, multiple = false, defaultExpanded = [], testId }: AccordionProps): JSX.Element {
  const [expanded, setExpanded] = useState<string[]>(defaultExpanded);
  const baseId = useId();
  const Heading = `h${headingLevel.toString()}` as "h2" | "h3" | "h4";

  function toggle(id: string): void {
    setExpanded((current) => {
      if (current.includes(id)) return current.filter((open) => open !== id);
      return multiple ? [...current, id] : [id];
    });
  }

  return (
    <div className="fx-accordion" data-testid={testId}>
      {items.map((item) => {
        const open = expanded.includes(item.id);
        const buttonId = `${baseId}-button-${item.id}`;
        const panelId = `${baseId}-panel-${item.id}`;
        return (
          <div key={item.id} className={cx("fx-accordion__item", open && "fx-accordion__item--open")}>
            <Heading className="fx-accordion__heading">
              <button
                type="button"
                id={buttonId}
                className="fx-accordion__trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                  toggle(item.id);
                }}
              >
                <span>{item.title}</span>
                <Icon name="chevron-down" className="fx-accordion__chevron" />
              </button>
            </Heading>
            <div id={panelId} role="region" aria-labelledby={buttonId} className="fx-accordion__panel" hidden={!open}>
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
