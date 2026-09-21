import type { JSX } from "react";

import { cx } from "../cx.js";

import { Icon, type IconName } from "./Icon.js";
import { UiLink } from "./Link.js";

export interface NavItem {
  /** A route that exists. The navigation never offers a screen that is not built. */
  href: string;
  label: string;
  icon: IconName;
  /** A real count (unread messages); hidden at 0. */
  badge?: number | undefined;
  /** Spoken with the count: "3 non lus". */
  badgeLabel?: ((count: number) => string) | undefined;
}

export interface NavigationProps {
  /** Names the landmark ("Navigation principale"). */
  label: string;
  items: NavItem[];
  /** `href` of the current destination: marked `aria-current="page"`, not only coloured. */
  activeHref?: string | undefined;
  testId?: string;
}

const defaultBadgeLabel = (count: number): string => `${count.toString()} non lu${count > 1 ? "s" : ""}`;

/** The count as drawn: "3", "99+". Hidden from assistive tech — `SpokenBadge` says it. */
function ItemBadge({ item }: { item: NavItem }): JSX.Element | null {
  if (!item.badge) return null;
  return (
    <span className="fx-nav-badge" aria-hidden="true">
      {item.badge > 99 ? "99+" : item.badge.toString()}
    </span>
  );
}

/** The count in words, placed after the label so the name reads "Messages, 3 non lus". */
function SpokenBadge({ item }: { item: NavItem }): JSX.Element | null {
  if (!item.badge) return null;
  return <span className="fx-visually-hidden">, {(item.badgeLabel ?? defaultBadgeLabel)(item.badge)}</span>;
}

/** Part 2B "Navbar": the desktop destinations, in the header (hidden on a phone). */
export function Navbar({ label, items, activeHref, testId }: NavigationProps): JSX.Element {
  return (
    <nav className="fx-navbar" aria-label={label} data-testid={testId}>
      <ul className="fx-navbar__list">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <UiLink href={item.href} className={cx("fx-navbar__link", active && "fx-navbar__link--active")} aria-current={active ? "page" : undefined}>
                <Icon name={item.icon} size="sm" />
                {item.label}
                <SpokenBadge item={item} />
                <ItemBadge item={item} />
              </UiLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Part 2B "BottomNavigation": the phone's destinations within thumb reach,
 * fixed at the bottom above the safe area, icon AND label (an icon alone is
 * a guess). 2 to 5 items; hidden from the tablet width up.
 */
export function BottomNavigation({ label, items, activeHref, testId }: NavigationProps): JSX.Element {
  return (
    <nav className="fx-bottom-nav" aria-label={label} data-testid={testId}>
      <ul className="fx-bottom-nav__list">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href} className="fx-bottom-nav__item">
              <UiLink href={item.href} className={cx("fx-bottom-nav__link", active && "fx-bottom-nav__link--active")} aria-current={active ? "page" : undefined}>
                <span className="fx-bottom-nav__icon">
                  <Icon name={item.icon} size="lg" />
                  <ItemBadge item={item} />
                </span>
                <span className="fx-bottom-nav__label">{item.label}</span>
                <SpokenBadge item={item} />
              </UiLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
