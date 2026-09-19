import path from "node:path";

import { config as loadDotenv } from "dotenv";

/**
 * Tests run against the real docker-compose dev services (MongoDB/Redis/MinIO
 * on localhost — 04_ENVIRONMENT.md), using the same non-secret defaults
 * documented in .env.test.example as the single source of truth. Values
 * already present in process.env (e.g. set by CI) are never overridden.
 */
const repoRoot = path.resolve(__dirname, "../../..");
loadDotenv({ path: path.join(repoRoot, ".env.test.example") });
