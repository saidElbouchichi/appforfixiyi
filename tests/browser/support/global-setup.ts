import { clearRateLimits } from "./rate-limits";

/**
 * Starts a run from clean rate-limit counters (see ./rate-limits.ts). The
 * suite's `test` (./test.ts) also clears them before each test; this covers
 * the audit harness, which uses Playwright's plain `test`.
 */
export default clearRateLimits;
