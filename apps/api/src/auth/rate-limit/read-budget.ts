/**
 * The budget every authenticated read shares (Decision 77).
 *
 * Keyed by user, not by IP: behind a NAT — or a carrier-grade NAT — many
 * people share one address, and an IP quota would let one of them exhaust
 * everyone's. That is the same reasoning the write budgets already follow
 * (Decision 63, finding B4), and it is available here because `AuthGuard`
 * has run by the time this guard does.
 *
 * Deliberately wide: a single screen fires several reads, and this exists to
 * stop a runaway client or a stolen token from walking the database, not to
 * ration ordinary use. One request per second, sustained, is far more than a
 * person generates and far less than a script wants.
 */
export const AUTHENTICATED_READ_LIMIT = {
  scope: "authenticated-read",
  limit: 600,
  windowSeconds: 600,
  key: "user",
} as const;
