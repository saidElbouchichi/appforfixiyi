import { config as loadDotenvFile } from "dotenv";

import { type Env, EnvSchema } from "./env-schema.js";
import { findNearestEnvFile } from "./find-env-file.js";

export class InvalidEnvironmentError extends Error {}

/**
 * Loads `.env` (if present, searching from `process.cwd()` up to the
 * monorepo root — see {@link findNearestEnvFile}) into `process.env`, then
 * validates the result against {@link EnvSchema}. Throws with a readable,
 * field-by-field report instead of letting the app boot with a missing or
 * malformed configuration.
 */
export function loadEnv(env: Record<string, string | undefined> = process.env): Env {
  const envFile = findNearestEnvFile(process.cwd());
  loadDotenvFile(envFile ? { path: envFile } : undefined);

  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new InvalidEnvironmentError(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
