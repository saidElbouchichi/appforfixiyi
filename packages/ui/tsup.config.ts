import { defineConfig } from "tsup";

/**
 * Config file rather than inline CLI flags (the convention in the other
 * packages) because this one needs `banner`: every component here is
 * interactive (hooks, event handlers), so the bundle must carry the
 * `"use client"` directive for Next.js' App Router — esbuild drops
 * per-file directives when bundling, so it is re-added once at the top.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  banner: { js: '"use client";' },
});
