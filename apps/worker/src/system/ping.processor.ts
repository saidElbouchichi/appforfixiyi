import type { ConnectionOptions, Job } from "bullmq";
import { Worker } from "bullmq";

import { PING_JOB_NAME, type PingJobResult } from "./ping.job.js";
import { SYSTEM_QUEUE_NAME } from "./queue-names.js";

export function createSystemWorker(connection: ConnectionOptions): Worker<undefined, PingJobResult> {
  return new Worker<undefined, PingJobResult>(
    SYSTEM_QUEUE_NAME,
    // eslint-disable-next-line @typescript-eslint/require-await -- BullMQ's Processor type requires a Promise-returning function
    async (job: Job<undefined, PingJobResult>): Promise<PingJobResult> => {
      if (job.name !== PING_JOB_NAME) {
        throw new Error(`unknown job name: ${job.name}`);
      }
      return { pong: true, respondedAt: new Date().toISOString() };
    },
    { connection },
  );
}
