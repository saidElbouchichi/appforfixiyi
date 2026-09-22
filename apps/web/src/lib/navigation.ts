import type { ServiceRequest, User } from "@fixiyi/contracts";
import type { NavItem } from "@fixiyi/ui";

/**
 * Every destination the navigation may offer. A route listed here exists and
 * is built: the navigation never advertises a screen that does not answer
 * (03_AGENT_PROTOCOL.md §2). "Favoris" of the design board is deliberately
 * absent — no data backs it.
 */
export const NAV_HREFS = {
  newRequest: "/requests/new",
  requests: "/requests",
  providerRequests: "/provider/requests",
  conversations: "/conversations",
  profile: "/profile",
} as const;

const unreadLabel = (count: number): string => `${count.toString()} non lu${count > 1 ? "s" : ""}`;

const CLIENT_ITEMS: NavItem[] = [
  { href: NAV_HREFS.newRequest, label: "Demander", icon: "add" },
  { href: NAV_HREFS.requests, label: "Mes demandes", icon: "file" },
];

const MESSAGES_ITEM: NavItem = { href: NAV_HREFS.conversations, label: "Messages", icon: "message" };
const PROFILE_ITEM: NavItem = { href: NAV_HREFS.profile, label: "Profil", icon: "user" };
const PROVIDER_ITEM: NavItem = { href: NAV_HREFS.providerRequests, label: "Demandes recues", icon: "briefcase" };

/**
 * The destinations of one user, in reading order. A provider starts on the
 * inbox (Decision 65) and keeps the client entries: nothing stops a provider
 * from ordering a job. At most five items — the bottom bar is built for 2 to 5.
 */
export function navigationFor(user: User | null, unreadCount: number): NavItem[] {
  if (!user) return [];

  const messages: NavItem = unreadCount > 0 ? { ...MESSAGES_ITEM, badge: unreadCount, badgeLabel: unreadLabel } : MESSAGES_ITEM;

  return user.roles.includes("PROVIDER")
    ? [PROVIDER_ITEM, messages, ...CLIENT_ITEMS, PROFILE_ITEM]
    : [...CLIENT_ITEMS, messages, PROFILE_ITEM];
}

/**
 * The entry to mark `aria-current="page"`. A detail screen stays under its
 * list (`/conversations/<id>` -> Messages), so the longest matching prefix
 * wins — otherwise `/requests/new` would light up "Mes demandes" too.
 */
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | undefined {
  let best: string | undefined;
  for (const { href } of items) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === undefined || href.length > best.length)) best = href;
  }
  return best;
}

/** Where a request in the list leads, or `null` when nothing can be done with it. */
export function requestHref(request: Pick<ServiceRequest, "id" | "status">): string | null {
  switch (request.status) {
    case "DRAFT":
      return NAV_HREFS.newRequest;
    case "REQUESTED":
    case "MATCHING":
      return `/requests/${request.id}/match`;
    default:
      return null;
  }
}

/** The badge on Messages: the counts the API reports, nothing invented. */
export function totalUnread(conversations: readonly { unreadCount: number }[]): number {
  return conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
}
