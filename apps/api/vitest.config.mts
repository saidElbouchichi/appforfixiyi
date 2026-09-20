import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
