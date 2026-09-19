import { loadEnv } from "@fixiyi/config";
import { Queue, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRedisConnection } from "../src/redis-connection.js";
import { PING_JOB_NAME, type PingJobResult } from "../src/system/ping.job.js";
import { createSystemWorker } from "../src/system/ping.processor.js";
import { SYSTEM_QUEUE_NAME } from "../src/system/queue-names.js";

/**
 * Real integration test against the actual Redis dev container
 * (04_ENVIRONMENT.md) — not a mocked queue.
 * BullMQ recommends a dedicated connection per Queue/Worker/QueueEvents
 * (the Worker uses blocking commands that would stall a shared connection).
 */
describe("system ping queue (e2e)", () => {
  const env = loadEnv();
  let queueConnection: Redis;
  let workerConnection: Redis;
  let eventsConnection: Redis;
  let queue: Queue<undefined, PingJobResult>;
  let worker: ReturnType<typeof createSystemWorker>;
  let queueEvents: QueueEvents;

  beforeAll(async () => {
    queueConnection = createRedisConnection(env);
    workerConnection = createRedisConnection(env);
    eventsConnection = createRedisConnection(env);

    queue = new Queue(SYSTEM_QUEUE_NAME, { connection: queueConnection });
    worker = createSystemWorker(workerConnection);
    queueEvents = new QueueEvents(SYSTEM_QUEUE_NAME, { connection: eventsConnection });

    await worker.waitUntilReady();
    await queueEvents.waitUntilReady();
  }, 30_000);

  afterAll(async () => {
    await worker.close();
    await queueEvents.close();
    await queue.close();
    queueConnection.disconnect();
    workerConnection.disconnect();
    eventsConnection.disconnect();
  });

  it("processes a real ping job through Redis end-to-end", async () => {
    const job = await queue.add(PING_JOB_NAME, undefined);
    const result = await job.waitUntilFinished(queueEvents, 10_000);

    expect(result.pong).toBe(true);
    expect(typeof result.respondedAt).toBe("string");
  }, 15_000);

  it("fails a job with an unrecognized name instead of silently succeeding", async () => {
    const job = await queue.add("not-a-real-job", undefined);

    await expect(job.waitUntilFinished(queueEvents, 10_000)).rejects.toThrow("unknown job name");
  }, 15_000);
});
