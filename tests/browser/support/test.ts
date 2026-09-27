import { test as base, expect } from "@playwright/test";

import { API_URL, takeProvidersCreatedThisTest } from "./journeys";
import { clearRateLimits } from "./rate-limits";

/**
 * The suite's `test`: Playwright's, made independent of the tests before it.
 * - Before each test, the API's per-IP budgets are reset (./rate-limits.ts,
 *   Decision 83): a spec's outcome must not depend on how many sign-ins the
 *   specs before it spent.
 * - After each test, every provider it onboarded goes OFFLINE: one left
 *   AVAILABLE competes for the next test's dispatch batch (Decision 84).
 */
export const test = base.extend<{ isolation: undefined }>({
  isolation: [
    async ({ request }, use) => {
      await clearRateLimits();
      await use(undefined);
      for (const provider of takeProvidersCreatedThisTest()) {
        await request.patch(`${API_URL}/api/v1/providers/me/availability`, {
          headers: { Authorization: `Bearer ${provider.session.accessToken}` },
          data: { status: "OFFLINE" },
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
