import { defineConfig, devices } from "@playwright/test";

/**
 * `tests/` was reserved since Phase 1 ("Tests E2E globaux — prevu, pas
 * encore implemente" in README.md) — this is that workspace, filled in
 * Phase 4. Drives the real `apps/web` (Docker, port 3000) against the real
 * `apps/api` (port 4000) — no mocked network layer.
 */
export default defineConfig({
  testDir: "./tests",
  // Hourly OTP counters survive a run; without this a second run within the hour 429s (see support/global-setup.ts).
  globalSetup: "./support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
    screenshot: "on",
    trace: "retain-on-failure",
  },
  // NOT ./screenshots: Playwright empties its outputDir before each run, which deleted the committed
  // step captures whenever a single spec was run (design phase 14). Per-run artifacts live apart.
  outputDir: "./test-results",
  // Visual references (design phase 15, Decision 87): Linux renders, compared only inside the Linux image (support/visual.ts).
  snapshotPathTemplate: "{testDir}/../visual/{arg}{ext}",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
