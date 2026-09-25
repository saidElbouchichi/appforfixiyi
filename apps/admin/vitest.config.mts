import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * `apps/admin` has no unit tests at all: the back-office is exercised by
     * Playwright, against the real image. Without this, vitest exits 1 on
     * "no test files found" and the coverage gate fails for the wrong reason
     * — the honest figure is the 0 % reported below, not an error.
     */
    passWithNoTests: true,
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
      thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 },
    },
  },
});
