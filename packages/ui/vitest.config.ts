import { defineConfig } from "vitest/config";

/** JSX needs no explicit transform option: Vitest 5 transforms with oxc, which reads `jsx` from tsconfig.json. */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
