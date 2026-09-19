import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

/**
 * Tests run against the real docker-compose dev Redis (04_ENVIRONMENT.md),
 * using the same non-secret defaults documented in .env.test.example as the
 * single source of truth. Values already present in process.env (e.g. set
 * by CI) are never overridden.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadDotenv({ path: path.join(repoRoot, ".env.test.example") });
