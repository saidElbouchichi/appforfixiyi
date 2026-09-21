import { createContext, createElement, use, type ComponentType, type JSX, type ReactNode } from "react";

/** What the design system needs from a link: the anchor props it sets. */
export interface UiLinkProps {
  href: string;
  className?: string | undefined;
  children?: ReactNode;
  "aria-current"?: "page" | undefined;
  "aria-label"?: string | undefined;
}

export type UiLinkComponent = ComponentType<UiLinkProps>;

function AnchorLink({ children, ...props }: UiLinkProps): JSX.Element {
  return <a {...props}>{children}</a>;
}

const LinkContext = createContext<UiLinkComponent>(AnchorLink);

export interface LinkProviderProps {
  /** The app's router link, e.g. `next/link` — navigation then stays client-side. */
  component: UiLinkComponent;
  children: ReactNode;
}

/**
 * `@fixiyi/ui` does not depend on a router. The layout components render
 * links through this context: a plain `<a>` by default, the app's router
 * link once the app provides it (once, in its root providers).
 */
export function LinkProvider({ component, children }: LinkProviderProps): JSX.Element {
  return <LinkContext value={component}>{children}</LinkContext>;
}

export function useLinkComponent(): UiLinkComponent {
  return use(LinkContext);
}

/** Renders a link with the app's router link component (see LinkProvider). */
export function UiLink(props: UiLinkProps): JSX.Element {
  return createElement(use(LinkContext), props);
}
