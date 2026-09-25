import { describe, expect, it } from "vitest";

import { ApiError } from "./api-client";
import { errorMessage } from "./errors";

/**
 * Design phase 9. Eleven screens carried the same ternary:
 *
 *   error instanceof ApiError ? error.message : "Impossible de charger X."
 *
 * Eleven copies are eleven chances to drop the `instanceof` and print
 * `[object Object]` at someone, or to lose the fallback entirely.
 */
describe("errorMessage", () => {
  it("prefers what the API said — it knows more than the fallback", () => {
    expect(errorMessage(new ApiError("Demande introuvable.", "NOT_FOUND", 404), "Impossible de charger.")).toBe("Demande introuvable.");
  });

  it("falls back for anything the API did not send", () => {
    expect(errorMessage(new TypeError("Failed to fetch"), "Impossible de charger les demandes.")).toBe("Impossible de charger les demandes.");
    expect(errorMessage("boom", "Impossible de charger les demandes.")).toBe("Impossible de charger les demandes.");
    expect(errorMessage(null, "Impossible de charger les demandes.")).toBe("Impossible de charger les demandes.");
  });

  /** A network failure's own text is developer English; the fallback is the one written for a reader. */
  it("never shows a raw fetch failure to the reader", () => {
    expect(errorMessage(new TypeError("Failed to fetch"), "Impossible de charger.")).not.toContain("fetch");
  });

  it("falls back when the API answered with an empty message", () => {
    expect(errorMessage(new ApiError("   ", "SERVER_ERROR", 500), "Impossible de charger.")).toBe("Impossible de charger.");
  });
});
