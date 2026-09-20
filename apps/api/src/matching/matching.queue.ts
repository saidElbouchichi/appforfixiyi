import type { Env } from "@fixiyi/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const MATCHING_QUEUE_NAME = "matching";
export const ADVANCE_BATCH_JOB = "advance-batch";

/** Injection token for the producer side of the queue. */
export const MATCHING_QUEUE = Symbol("MATCHING_QUEUE");

export interface AdvanceBatchJobData {
  matchId: string;
}

export type MatchingQueue = Queue<AdvanceBatchJobData>;

/**
 * The progressive dispatch of 01_SPEC_PRODUCT.md #15 needs a real "wait,
 * then send the next batch" timer. That timer runs in `apps/api`, not in
 * `apps/worker` (Decision 43): the matching domain needs Mongo, the
 * catalog, provider and verification services, and `apps/worker` has none
 * of them — giving it a database connection would mean duplicating schemas
 * or extracting a persistence package, which is premature (Decision 1).
 *
 * BullMQ requires `maxRetriesPerRequest: null` on the ioredis connection it
 * is handed, so it gets its own rather than sharing `RedisService`'s.
 */
export function createMatchingRedisConnection(env: Env): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function createMatchingQueue(connection: Redis): Queue<AdvanceBatchJobData> {
  return new Queue<AdvanceBatchJobData>(MATCHING_QUEUE_NAME, { connection });
}

/**
 * Deterministic id so a retry or a double-schedule cannot dispatch the same
 * batch twice. No `:` — BullMQ rejects it in a custom job id ("Custom Id
 * cannot contain :"), since it separates the segments of its own Redis keys.
 */
export function advanceBatchJobId(matchId: string, batchIndex: number): string {
  return `${matchId}-batch-${batchIndex.toString()}`;
}
