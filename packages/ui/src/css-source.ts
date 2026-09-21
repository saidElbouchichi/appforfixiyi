import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Test helper: the stylesheet a consumer of `@fixiyi/ui/css` really gets —
 * styles.css with every relative `@import` inlined, in order. The stylesheet
 * invariants must hold for the whole package, not for the entry file alone.
 */
export function readStylesheet(entry = join(here, "styles.css")): string {
  const source = readFileSync(entry, "utf8");
  return source.replace(/@import\s+"(\.[^"]+)";/g, (_statement, relative: string) => readStylesheet(join(dirname(entry), relative)));
}

/** Every file the entry point imports, as published paths relative to `src/`. */
export function importedSheets(): string[] {
  const source = readFileSync(join(here, "styles.css"), "utf8");
  return [...source.matchAll(/@import\s+"\.\/([^"]+)";/g)].map((match) => match[1] ?? "");
}
