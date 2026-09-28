#!/usr/bin/env node
/**
 * The browser suite in the Linux image (design phase 15, Decision 87) — the
 * only place the visual references in tests/browser/visual are compared.
 * Same command locally and in CI, so a reference means the same everywhere.
 *
 * Needs the dev stack running (docker compose ... up -d). The image holds the
 * dependencies; the specs, the support code and the references are mounted,
 * so a test edit needs no rebuild (the build is cached otherwise).
 *
 * Usage: pnpm test:visual [playwright args]
 *   pnpm test:visual                                 whole suite, compared
 *   pnpm test:visual tests/chat.spec.ts              one spec
 *   pnpm test:visual --update-snapshots=changed      after a WANTED visual change:
 *                                                    commit the new references with their reason
 * References depend on the seeded catalogue only. A dev database that holds
 * hand-made data (a test domain on the home) will differ from them, so they
 * are (re)generated against a fresh stack, as CI runs — without touching the
 * dev volumes:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml down
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml -p fixiyi-clean up -d --wait
 *   pnpm test:visual --update-snapshots=changed
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml -p fixiyi-clean down -v
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 * The container shares the host network: the browser reaches the stack on
 * localhost, as it does outside the container.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BROWSER = resolve(ROOT, "tests/browser");
const IMAGE = "fixiyi-browser-tests";

function docker(args) {
  const result = spawnSync("docker", args, { cwd: ROOT, stdio: "inherit" });
  if (result.error) {
    console.error(`docker could not be started: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const mount = (path, mode) => [
  "-v",
  `${resolve(BROWSER, path)}:/app/tests/browser/${path}:${mode}`,
];

docker(["build", "--file", "tests/browser/Dockerfile", "--tag", IMAGE, "."]);
docker([
  "run",
  "--rm",
  "--network",
  "host",
  "--ipc",
  "host",
  ...mount("tests", "ro"),
  ...mount("support", "ro"),
  ...mount("fixtures", "ro"),
  ...mount("playwright.config.ts", "ro"),
  // Written by --update-snapshots, and by Playwright's diffs on a failure.
  ...mount("visual", "rw"),
  ...mount("test-results", "rw"),
  IMAGE,
  ...process.argv.slice(2),
]);
