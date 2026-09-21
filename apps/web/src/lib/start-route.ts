import type { User } from "@fixiyi/contracts";

/**
 * The first screen for a user — the one `/` and a fresh login lead to.
 * A provider starts on the requests dispatched to them: before the audit of
 * 2026-09-21 every user landed on the client form, and the provider inbox
 * was reachable only by typing its URL.
 */
export function startRouteFor(user: User | null): string {
  if (!user) return "/login";
  return user.roles.includes("PROVIDER") ? "/provider/requests" : "/requests/new";
}
