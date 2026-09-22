import { defineConfig } from "vitest/config";

/**
 * `.mts` for the same reason as `apps/api` (Decision 10): this package has no
 * `"type": "module"`, so the explicit extension is what makes the config ESM.
 * Environment `node`: the unit tests here cover pure navigation logic, not
 * components — rendering is covered by `@fixiyi/ui` and by Playwright.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
