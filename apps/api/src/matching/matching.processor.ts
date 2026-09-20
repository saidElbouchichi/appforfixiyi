import type { Env } from "@fixiyi/config";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";

import { ENV } from "../infrastructure/env.token.js";

import { DispatchService } from "./dispatch.service.js";
import { ADVANCE_BATCH_JOB, createMatchingRedisConnection, MATCHING_QUEUE_NAME, type AdvanceBatchJobData } from "./matching.queue.js";

/**
 * The consumer side of the wait between batches (01_SPEC_PRODUCT.md #15),
 * hosted in `apps/api` alongside the domain it drives (Decision 43). First
 * real business queue in the project — `apps/worker` still only has the
 * diagnostic one (Decision 9).
 */
@Injectable()
export class MatchingProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingProcessor.name);
  private worker: Worker<AdvanceBatchJobData> | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly dispatch: DispatchService,
  ) {}

  onModuleInit(): void {
    const connection = createMatchingRedisConnection(this.env);
    this.worker = new Worker<AdvanceBatchJobData>(
      MATCHING_QUEUE_NAME,
      async (job: Job<AdvanceBatchJobData>) => {
        if (job.name !== ADVANCE_BATCH_JOB) {
          throw new Error(`unknown job name: ${job.name}`);
        }
        await this.dispatch.runBatch(job.data.matchId);
      },
      { connection },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(`advance-batch job ${job?.id ?? "unknown"} failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
