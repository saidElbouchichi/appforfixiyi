import { defineConfig } from "vitest/config";

/**
 * `.mts` for the same reason as `apps/api` (Decision 10): this package has no
 * `"type": "module"`, so the explicit extension is what makes the config ESM.
 * Environment `node`: the unit tests here cover pure navigation logic, not
 * components — rendering is covered by `@fixiyi/ui` and by Playwright.
 */
export default defineConfig({
  /**
   * Next compiles JSX itself, so the shared tsconfig says `"jsx": "preserve"`,
   * and Vitest (oxc) follows it. The coverage of a file no test imports is then
   * remapped from untransformed JSX, which fails to parse: every page silently
   * dropped out of the denominator (design phase 14, 19 files). Tests transform
   * JSX themselves; what Next builds is unchanged.
   */
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    /**
     * Decision 74. `include` is the part that matters: it defines the universe
     * of files the percentage is computed over, so a file no test imports
     * still counts as uncovered instead of vanishing. (Vitest 5 dropped the
     * old `all` flag — `include` subsumes it.) Thresholds are locked at the
     * level measured on 2026-09-25 and only ever move up.
     */
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        // Nest and Next wiring: declarations with no branch of their own.
        "**/*.module.ts",
        "src/app/layout.tsx",
        "src/app/fonts.ts",
        // Process entry point: started by Docker, never imported by a unit test.
        "src/main.ts",
      ],
      // Re-based in design phase 14 on the honest denominator (pages included, Decision 86):
      // 16.4 % of 878 lines. The 38 % of phase 13 counted 379 lines, without the pages.
      thresholds: { lines: 16, statements: 16, functions: 11, branches: 14 },
    },
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
