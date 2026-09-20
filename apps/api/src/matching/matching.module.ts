import type { Env } from "@fixiyi/config";
import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ConfigurationModule } from "../configuration/configuration.module.js";
import { GeoModule } from "../geo/geo.module.js";
import { ENV } from "../infrastructure/env.token.js";
import { ProviderModule } from "../providers/provider.module.js";
import { RequestModule } from "../requests/request.module.js";
import { VerificationModule } from "../verification/verification.module.js";

import { DispatchService } from "./dispatch.service.js";
import { EligibilityService } from "./eligibility.service.js";
import { MatchingController } from "./matching.controller.js";
import { MatchingProcessor } from "./matching.processor.js";
import { createMatchingQueue, createMatchingRedisConnection, MATCHING_QUEUE, type MatchingQueue } from "./matching.queue.js";
import { MatchingService } from "./matching.service.js";
import { DispatchBatchEntity, DispatchBatchEntitySchema } from "./schemas/dispatch-batch.schema.js";
import { MatchCandidateEntity, MatchCandidateEntitySchema } from "./schemas/match-candidate.schema.js";
import { MatchEntity, MatchEntitySchema } from "./schemas/match.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MatchEntity.name, schema: MatchEntitySchema },
      { name: MatchCandidateEntity.name, schema: MatchCandidateEntitySchema },
      { name: DispatchBatchEntity.name, schema: DispatchBatchEntitySchema },
    ]),
    AuthModule,
    CatalogModule,
    ConfigurationModule,
    GeoModule,
    ProviderModule,
    RequestModule,
    VerificationModule,
  ],
  controllers: [MatchingController],
  providers: [
    {
      provide: MATCHING_QUEUE,
      inject: [ENV],
      useFactory: (env: Env): MatchingQueue => createMatchingQueue(createMatchingRedisConnection(env)),
    },
    EligibilityService,
    DispatchService,
    MatchingService,
    MatchingProcessor,
  ],
})
export class MatchingModule implements OnApplicationShutdown {
  constructor(@Inject(MATCHING_QUEUE) private readonly queue: MatchingQueue) {}

  /** Closes the producer connection too — without this, tests and dev restarts leak an open ioredis socket. */
  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
