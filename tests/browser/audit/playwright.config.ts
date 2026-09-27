import { defineConfig, devices } from "@playwright/test";

// Phase 11 audit harness (not part of the regression suite): run with --config audit/playwright.config.ts
export default defineConfig({
  testDir: ".",
  // Same OTP-counter reset as the suite: audit runs pile up logins within the hour.
  globalSetup: "../support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [["list"]],
  use: { baseURL: process.env.WEB_URL ?? "http://localhost:3000", trace: "off" },
  outputDir: "./out",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
