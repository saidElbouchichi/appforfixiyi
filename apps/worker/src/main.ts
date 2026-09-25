import { loadEnv } from "@fixiyi/config";

import { loggerFor } from "./logger.js";
import { createRedisConnection } from "./redis-connection.js";
import { createSystemWorker } from "./system/ping.processor.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const log = loggerFor(env);
  const connection = createRedisConnection(env);
  await connection.ping();

  const worker = createSystemWorker(connection);
  await worker.waitUntilReady();
  log.info("worker ready", { env: env.NODE_ENV });

  worker.on("failed", (job, error) => {
    log.error("job failed", { jobId: job?.id ?? "unknown", error });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn("shutting down", { signal });
    await worker.close();
    connection.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
