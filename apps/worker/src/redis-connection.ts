import type { Env } from "@fixiyi/config";
import { Redis } from "ioredis";

/** BullMQ requires `maxRetriesPerRequest: null` on the underlying ioredis connection it's given. */
export function createRedisConnection(env: Env): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
