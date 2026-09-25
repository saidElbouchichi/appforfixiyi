import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RESERVED_ENV_KEYS } from "./env-schema.js";

/**
 * Decision 73 — the rule this file exists to enforce: every key the schema
 * accepts is either **read somewhere in the code**, or **declared reserved**
 * for a phase that has not arrived.
 *
 * Why a test and not vigilance: `STORAGE_PROVIDER` sat in the schema for
 * months looking like it selected a storage backend. It selected nothing —
 * `StorageService` built its S3 client unconditionally — and
 * `STORAGE_PROVIDER=fake` in `.env.test.example` is precisely what hid the
 * missing MinIO container from CI until 2026-09-22. A key that configures
 * nothing is worse than a missing one: it answers a question it never asked.
 */
const REPO_ROOT = path.resolve(__dirname, "../../..");

const SCANNED_ROOTS = [
  "apps/api/src",
  "apps/web/src",
  "apps/admin/src",
  "apps/worker/src",
  "packages/contracts/src",
  "packages/ui/src",
  "packages/design-tokens/src",
  "packages/shared-utils/src",
  "packages/i18n/src",
];

/** This file and the schema itself name every key by construction; they cannot count as usage. */
const SELF = ["env-schema.ts", "env-usage.test.ts"];

function sourceBlob(): string {
  const parts: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "node_modules" && entry !== "dist" && !entry.startsWith(".")) walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry) || SELF.includes(entry)) continue;
      parts.push(readFileSync(full, "utf8"));
    }
  };
  for (const root of SCANNED_ROOTS) {
    const full = path.join(REPO_ROOT, root);
    try {
      walk(full);
    } catch {
      // A package may not exist yet; the other roots still make the test meaningful.
    }
  }
  return parts.join("\n");
}

function schemaKeys(): string[] {
  const src = readFileSync(path.join(__dirname, "env-schema.ts"), "utf8");
  return [...src.matchAll(/^ {2}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1] ?? "");
}

describe("every environment key is read, or declared reserved (Decision 73)", () => {
  const blob = sourceBlob();
  const keys = schemaKeys();

  it("scans a real source tree — a silent empty scan would pass everything", () => {
    expect(blob.length).toBeGreaterThan(50_000);
    expect(keys.length).toBeGreaterThan(20);
  });

  it("leaves no key that configures nothing and says nothing", () => {
    const orphans = keys.filter((key) => !blob.includes(key) && !RESERVED_ENV_KEYS.includes(key));
    expect(orphans).toEqual([]);
  });

  it("keeps the reserved list honest — a key that became used must leave it", () => {
    const stillUnused = RESERVED_ENV_KEYS.filter((key) => !blob.includes(key));
    expect(stillUnused).toEqual([...RESERVED_ENV_KEYS]);
  });

  it("reserves only keys the schema actually declares", () => {
    expect(RESERVED_ENV_KEYS.filter((key) => !keys.includes(key))).toEqual([]);
  });
});
