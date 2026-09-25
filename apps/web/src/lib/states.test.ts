import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Design phase 9 — the two rules this phase established, checked against the
 * screens themselves rather than trusted to hold.
 *
 * It reads sources, like `env-usage.test.ts` does for the configuration, and
 * for the same reason: both rules are about what is *absent* from a file, and
 * nothing else can see that.
 */
const APP = path.resolve(__dirname, "../app");

/**
 * Words from the engine and the database. They belong in `matching.service.ts`
 * and in the contracts, never in a sentence shown to someone waiting for a
 * plumber. Phase 8 cleaned the screens; two of these had survived inside a
 * loading label and an error message, one level below where anyone looked.
 */
const ENGINE_WORDS = ["matching", "dispatch", "batch", "candidate", "payload"];

function screens(): { file: string; source: string }[] {
  const found: { file: string; source: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".tsx")) {
        found.push({ file: path.relative(APP, full), source: readFileSync(full, "utf8") });
      }
    }
  };
  walk(APP);
  return found;
}

/** Strings a reader sees: `label="…"`, `title="…"`, `message="…"`. Comments and identifiers are not. */
function userFacingStrings(source: string): string[] {
  return [...source.matchAll(/(?:label|title|message|hint|placeholder)="([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("what the screens say", () => {
  const all = screens();

  it("reads the real screens — an empty scan would pass everything", () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it("never shows the engine's own words to a reader", () => {
    const leaks: string[] = [];
    for (const { file, source } of all) {
      for (const text of userFacingStrings(source)) {
        for (const word of ENGINE_WORDS) {
          if (text.toLowerCase().includes(word)) leaks.push(`${file}: "${text}"`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
