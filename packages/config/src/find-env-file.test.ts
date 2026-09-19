import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findNearestEnvFile } from "./find-env-file.js";

describe("findNearestEnvFile", () => {
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("finds .env in the starting directory itself", () => {
    root = mkdtempSync(path.join(tmpdir(), "fixiyi-env-"));
    writeFileSync(path.join(root, ".env"), "X=1");

    expect(findNearestEnvFile(root)).toBe(path.join(root, ".env"));
  });

  it("walks up from a nested app directory (apps/api) to find the monorepo root .env", () => {
    root = mkdtempSync(path.join(tmpdir(), "fixiyi-env-"));
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    writeFileSync(path.join(root, ".env"), "X=1");
    const appDir = path.join(root, "apps", "api");
    mkdirSync(appDir, { recursive: true });

    expect(findNearestEnvFile(appDir)).toBe(path.join(root, ".env"));
  });

  it("stops at the monorepo root and returns undefined when no .env exists anywhere in the workspace", () => {
    root = mkdtempSync(path.join(tmpdir(), "fixiyi-env-"));
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    const appDir = path.join(root, "apps", "api");
    mkdirSync(appDir, { recursive: true });

    expect(findNearestEnvFile(appDir)).toBeUndefined();
  });

  it("never searches above the monorepo root even if an ancestor outside it has a .env", () => {
    root = mkdtempSync(path.join(tmpdir(), "fixiyi-env-"));
    writeFileSync(path.join(root, ".env"), "OUTSIDE=1");
    const workspaceRoot = path.join(root, "workspace");
    const appDir = path.join(workspaceRoot, "apps", "api");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");

    expect(findNearestEnvFile(appDir)).toBeUndefined();
  });
});
