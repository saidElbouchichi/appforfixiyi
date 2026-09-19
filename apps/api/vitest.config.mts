import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "./",
    globals: false,
    setupFiles: ["./test/setup-env.ts"],
  },
  plugins: [
    // NestJS relies on TS experimentalDecorators/emitDecoratorMetadata;
    // esbuild (vitest's default transform) doesn't emit decorator metadata, swc does.
    swc.vite({
      module: { type: "es6" },
    }),
  ],
});
