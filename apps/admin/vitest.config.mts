import { defineConfig } from "vitest/config";

export default defineConfig({
  /** Same as apps/web: the Next tsconfig preserves JSX, so tests transform it themselves, or uncovered pages drop out of the coverage denominator. */
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
      // 22.3 % of 188 lines. The 64.6 % of phase 13 counted 65 lines, without the pages.
      thresholds: { lines: 22, statements: 21, functions: 16, branches: 17 },
    },
  },
});
