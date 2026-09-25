import swc from "unplugin-swc";
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
      // 87, not the 88.02 measured: this suite's figure moves by a few
      // hundredths between runs (which branches a real Mongo/Redis takes), and
      // a floor set on the knife-edge fails for weather, not for a regression.
      thresholds: { lines: 87, statements: 86, functions: 92, branches: 75 },
    },
    root: "./",
    globals: false,
    setupFiles: ["./test/setup-env.ts"],
    // e2e files hit the *same* real MongoDB/Redis/rate-limit counters — running
    // them in parallel worker threads caused real cross-file races (a catalog
    // seed racing another file's app boot; one file's login traffic tripping
    // another file's rate-limit assertions). Sequential is slightly slower but
    // deterministic, which matters more for integration tests against shared
    // real infra than for the pure-unit tests in this same suite.
    fileParallelism: false,
  },
  plugins: [
    // NestJS relies on TS experimentalDecorators/emitDecoratorMetadata;
    // esbuild (vitest's default transform) doesn't emit decorator metadata, swc does.
    swc.vite({
      module: { type: "es6" },
    }),
  ],
});
