import { ApiError } from "./api-client";

/**
 * What to show someone when a request failed (design phase 9).
 *
 * The API's own message is preferred because it knows more than any generic
 * sentence: "Cette demande n'existe plus" beats "Impossible de charger".
 * Everything else — a dropped connection, a parse error — carries developer
 * English (`Failed to fetch`) that has no business on a screen, so the
 * caller's fallback wins.
 *
 * This replaced the same ternary written out in eleven screens, which is
 * eleven chances to drop the `instanceof` and print `[object Object]`.
 *
 * A copy, not an import: the two apps share no code outside `packages`
 * (Decision 51), and each has its own `ApiError`.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}
