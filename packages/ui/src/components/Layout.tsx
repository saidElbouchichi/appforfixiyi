import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

import { UiLink } from "./Link.js";

export interface LogoProps {
  href?: string;
  /** Qualifier after the name ("Admin"), in a lighter weight. */
  suffix?: string;
  testId?: string;
}

/**
 * The name "Fixiyi" set in Inter 800, brand text colour (D4 placeholder):
 * no drawn logo until the real one is provided. A link home, named by its
 * text — never an image of text.
 */
export function Logo({ href = "/", suffix, testId }: LogoProps): JSX.Element {
  return (
    <UiLink href={href} className="fx-logo">
      <span data-testid={testId}>
        Fixiyi
        {suffix ? (
          <>
            {" "}
            <span className="fx-logo__suffix">{suffix}</span>
          </>
        ) : null}
      </span>
    </UiLink>
  );
}

export interface HeaderProps {
  /** Usually `<Logo />`. */
  brand: ReactNode;
  /** Desktop navigation (`<Navbar />`); hidden on a phone, where the bottom bar takes over. */
  navigation?: ReactNode;
  /** Icon buttons, account menu — always visible. */
  actions?: ReactNode;
  testId?: string;
}

/** The app bar (`banner` landmark), sticky at the top: 56px on a phone, 64px above. */
export function Header({ brand, navigation, actions, testId }: HeaderProps): JSX.Element {
  return (
    <header className="fx-header" data-testid={testId}>
      <div className="fx-header__inner">
        <div className="fx-header__brand">{brand}</div>
        {navigation === undefined ? null : <div className="fx-header__nav">{navigation}</div>}
        {actions === undefined ? null : <div className="fx-header__actions">{actions}</div>}
      </div>
    </header>
  );
}

export interface FooterLinkGroup {
  title: string;
  /** Real destinations only: a footer link to a page that does not exist is a dead link. */
  links: { href: string; label: string }[];
}

export interface FooterProps {
  brand?: ReactNode;
  tagline?: string;
  groups?: FooterLinkGroup[];
  /** The bottom line, e.g. the copyright. */
  legal?: ReactNode;
  testId?: string;
}

/** The page footer (`contentinfo` landmark). Link groups are optional: none is better than dead ones. */
export function Footer({ brand, tagline, groups = [], legal, testId }: FooterProps): JSX.Element {
  return (
    <footer className="fx-footer" data-testid={testId}>
      <div className="fx-footer__inner">
        <div className="fx-footer__brand">
          {brand}
          {tagline ? <p className="fx-footer__tagline">{tagline}</p> : null}
        </div>
        {groups.map((group) => (
          <nav key={group.title} className="fx-footer__group" aria-label={group.title}>
            <p className="fx-footer__group-title">{group.title}</p>
            <ul className="fx-footer__links">
              {group.links.map((link) => (
                <li key={link.href}>
                  <UiLink href={link.href} className="fx-footer__link">
                    {link.label}
                  </UiLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {legal === undefined ? null : <div className="fx-footer__legal">{legal}</div>}
    </footer>
  );
}

export interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** `<BottomNavigation />`: fixed at the bottom on a phone; the content keeps clear of it. */
  bottomNavigation?: ReactNode;
  skipLinkLabel?: string;
}

/**
 * The frame of every screen: a skip link (WCAG 2.4.1) first in the tab
 * order, the header, the page content, the footer, the phone's bottom bar.
 * The content wrapper is the skip target; each page still owns its `<main>`.
 * It exposes `--fx-shell-header-height` for full-height screens (the chat).
 */
export function AppShell({ header, children, footer, bottomNavigation, skipLinkLabel = "Aller au contenu" }: AppShellProps): JSX.Element {
  return (
    <div className={cx("fx-shell", bottomNavigation !== undefined && "fx-shell--with-bottom-nav")}>
      <a href="#fx-content" className="fx-skip-link">
        {skipLinkLabel}
      </a>
      {header}
      <div id="fx-content" className="fx-shell__content" tabIndex={-1}>
        {children}
      </div>
      {footer}
      {bottomNavigation}
    </div>
  );
}

export interface PageProps {
  title: ReactNode;
  /** Buttons at the inline end of the title row. */
  actions?: ReactNode;
  width?: "narrow" | "wide" | "page";
  children: ReactNode;
  testId?: string;
}

/** A screen's `<main>`: its single `<h1>`, optional actions, content at a token width. */
export function Page({ title, actions, width = "narrow", children, testId }: PageProps): JSX.Element {
  return (
    <main className={cx("fx-page", `fx-page--${width}`)} data-testid={testId}>
      <div className="fx-page__header">
        <h1 className="fx-page__title">{title}</h1>
        {actions === undefined ? null : <div className="fx-row">{actions}</div>}
      </div>
      {children}
    </main>
  );
}
