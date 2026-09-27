import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE_NAME = "Fixiyi";

/**
 * A page's title: its own name, then the site's (WCAG 2.4.2). Absolute on
 * purpose — with `title.template`, a parent segment's plain-string title drops
 * the template for its children, and three nested routes lost the site name.
 */
export function pageTitle(name: string): Metadata["title"] {
  return { absolute: `${name} — ${SITE_NAME}` };
}

/**
 * The layout of a route segment that exists only to name its page: the pages
 * are client components, and only a server file can export `metadata`. The
 * title is also what Next's route announcer reads out after a client-side
 * navigation — with one title for every route, it said nothing.
 */
export function SegmentLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
