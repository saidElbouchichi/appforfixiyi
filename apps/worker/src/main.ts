import { loadEnv } from "@fixiyi/config";

import { createRedisConnection } from "./redis-connection.js";
import { createSystemWorker } from "./system/ping.processor.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const connection = createRedisConnection(env);
  await connection.ping();

  const worker = createSystemWorker(connection);
  await worker.waitUntilReady();
  // eslint-disable-next-line no-console -- worker process has no HTTP surface; this is its startup log
  console.log(`[worker] ready (env=${env.NODE_ENV})`);

  worker.on("failed", (job, error) => {
    console.error(`[worker] job ${job?.id ?? "unknown"} failed:`, error);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.warn(`[worker] received ${signal}, shutting down`);
    await worker.close();
    connection.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
