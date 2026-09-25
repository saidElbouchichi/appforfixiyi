import { defineConfig } from "vitest/config";

export default defineConfig({
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
      thresholds: { lines: 88, statements: 88, functions: 66, branches: 100 },
    },
  },
});
