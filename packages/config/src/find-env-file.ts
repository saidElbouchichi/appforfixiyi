import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Every app in the monorepo runs with its own package directory as cwd
 * (pnpm/turbo convention), but `.env` lives at the monorepo root. Plain
 * `dotenv` only looks in `process.cwd()`, so it silently misses the file
 * unless the process happens to be started from the repo root. This walks
 * upward from `startDir` looking for `fileName`, stopping once it reaches
 * the monorepo root (marked by `pnpm-workspace.yaml`) or the filesystem root.
 */
export function findNearestEnvFile(startDir: string, fileName = ".env"): string | undefined {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}
