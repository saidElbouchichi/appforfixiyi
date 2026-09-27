import { test as base, expect } from "@playwright/test";

import { clearRateLimits } from "./rate-limits";

/**
 * The suite's `test`: Playwright's, with the API's per-IP budgets reset before
 * each test (see ./rate-limits.ts), so a spec's outcome does not depend on how
 * many sign-ins the specs before it spent.
 */
export const test = base.extend<{ freshRateLimits: undefined }>({
  freshRateLimits: [
    // Playwright reads the fixture's parameters from its source: the empty pattern is required.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await clearRateLimits();
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
