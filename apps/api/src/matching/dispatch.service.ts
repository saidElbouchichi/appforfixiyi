import type { MatchingConfig, ServiceRequest } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { RequestService } from "../requests/request.service.js";

import { EligibilityService } from "./eligibility.service.js";
import { ADVANCE_BATCH_JOB, advanceBatchJobId, MATCHING_QUEUE, type MatchingQueue } from "./matching.queue.js";
import { rankCandidates, selectBatch } from "./ranking.js";
import { DispatchBatchEntity } from "./schemas/dispatch-batch.schema.js";
import { MatchCandidateEntity } from "./schemas/match-candidate.schema.js";
import { MatchEntity, type MatchDocument } from "./schemas/match.schema.js";

/**
 * 01_SPEC_PRODUCT.md #15 — `Eligibility -> Ranking -> small batch -> wait ->
 * next batch -> expand radius if necessary`. Every step here is real: the
 * batch is genuinely capped, the wait is a real delayed job, and the radius
 * genuinely widens against real geospatial data.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectModel(MatchEntity.name) private readonly matchModel: Model<MatchEntity>,
    @InjectModel(MatchCandidateEntity.name) private readonly candidateModel: Model<MatchCandidateEntity>,
    @InjectModel(DispatchBatchEntity.name) private readonly batchModel: Model<DispatchBatchEntity>,
    private readonly eligibility: EligibilityService,
    private readonly configuration: ConfigurationService,
    private readonly requests: RequestService,
    @Inject(MATCHING_QUEUE) private readonly queue: MatchingQueue,
  ) {}

  /** Idempotent by design: a match that is not ACTIVE, or whose request left MATCHING, simply stops. */
  async runBatch(matchId: string): Promise<void> {
    const match = await this.matchModel.findById(matchId);
    if (match?.status !== "ACTIVE") {
      return;
    }

    const request = await this.requests.findById(match.requestId);
    if (request?.status !== "MATCHING") {
      // The client cancelled (or the request moved on) — the dispatch loop is
      // where that is noticed, so `RequestService` never has to call back into
      // matching and create a module cycle.
      await this.terminate(match, "CANCELLED");
      return;
    }

    await this.expireStaleCandidates(matchId);

    const config = await this.configuration.getMatching();
    if (match.batchCount >= config.maxBatchesPerMatch) {
      await this.terminate(match, "EXHAUSTED");
      return;
    }

    const dispatched = await this.candidateModel.find({ matchId }).select("providerId");
    const excludeProviderIds = dispatched.map((candidate) => candidate.providerId);

    const outcome = await this.selectNextBatch(match, request, config, excludeProviderIds);
    match.currentRadiusKm = outcome.radiusKm;

    if (outcome.selected.length === 0) {
      await this.terminate(match, "EXHAUSTED");
      return;
    }

    await this.persistBatch(match, request, outcome.selected, outcome.radiusKm, config);
  }

  /**
   * Widens the radius step by step until candidates are found or the
   * administrable maximum is reached (01_SPEC_PRODUCT.md #18).
   */
  private async selectNextBatch(
    match: MatchDocument,
    request: ServiceRequest,
    config: MatchingConfig,
    excludeProviderIds: string[],
  ): Promise<{ selected: Awaited<ReturnType<DispatchService["rankEligible"]>>; radiusKm: number }> {
    let radiusKm = match.currentRadiusKm;

    for (;;) {
      const selected = await this.rankEligible(request, config, radiusKm, excludeProviderIds);
      if (selected.length > 0 || radiusKm >= config.maxRadiusKm) {
        return { selected, radiusKm };
      }
      radiusKm = Math.min(config.maxRadiusKm, radiusKm + config.radiusExpansionStepKm);
    }
  }

  private async rankEligible(request: ServiceRequest, config: MatchingConfig, radiusKm: number, excludeProviderIds: string[]) {
    if (!request.serviceId || !request.complexityId || !request.location) {
      return [];
    }

    const eligible = await this.eligibility.findEligible({
      serviceId: request.serviceId,
      complexityId: request.complexityId,
      point: request.location.point,
      radiusKm,
      excludeProviderIds,
      config,
    });
    if (eligible.length === 0) {
      return [];
    }

    const byProviderId = new Map(eligible.map((entry) => [entry.profile.id, entry.profile]));
    const ranked = rankCandidates(
      eligible.map((entry) => entry.ranking),
      {
        radiusKm,
        at: new Date(),
        maxPastDispatchCount: Math.max(...eligible.map((entry) => entry.ranking.pastDispatchCount)),
      },
      config.weights,
    );

    const batchSize = request.urgency === "URGENT" ? config.urgentBatchSize : config.batchSize;
    return selectBatch(ranked, batchSize, config.explorationSlotsPerBatch).map((entry) => ({
      ...entry,
      profile: byProviderId.get(entry.candidate.providerId),
    }));
  }

  private async persistBatch(
    match: MatchDocument,
    request: ServiceRequest,
    selected: Awaited<ReturnType<DispatchService["rankEligible"]>>,
    radiusKm: number,
    config: MatchingConfig,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.candidateExpirySeconds * 1000);
    const batchIndex = match.batchCount;

    const candidates = selected
      .filter((entry) => entry.profile !== undefined)
      .map((entry) => ({
        _id: generateId(),
        matchId: match._id,
        providerId: entry.candidate.providerId,
        providerUserId: entry.profile?.userId ?? "",
        requestId: match.requestId,
        batchIndex,
        status: "NOTIFIED" as const,
        score: entry.score,
        scoreBreakdown: entry.breakdown,
        distanceKm: entry.candidate.distanceKm,
        declineReason: null,
        dispatchedAt: now,
        expiresAt,
      }));

    await this.candidateModel.insertMany(candidates, { ordered: false });
    await this.batchModel.create({
      _id: generateId(),
      matchId: match._id,
      index: batchIndex,
      radiusKm,
      candidateIds: candidates.map((candidate) => candidate._id),
      dispatchedAt: now,
    });

    const waitSeconds = request.urgency === "URGENT" ? config.urgentBatchWaitSeconds : config.batchWaitSeconds;
    match.batchCount = batchIndex + 1;
    match.currentRadiusKm = radiusKm;
    match.nextBatchAt = new Date(now.getTime() + waitSeconds * 1000);
    await match.save();

    this.logger.log(
      `Match ${match._id}: batch ${batchIndex.toString()} dispatched to ${candidates.length.toString()} provider(s) within ${radiusKm.toString()}km`,
    );

    await this.scheduleNextBatch(match._id, match.batchCount, waitSeconds);
  }

  async scheduleNextBatch(matchId: string, batchIndex: number, waitSeconds: number): Promise<void> {
    await this.queue.add(
      ADVANCE_BATCH_JOB,
      { matchId },
      { delay: waitSeconds * 1000, jobId: advanceBatchJobId(matchId, batchIndex), removeOnComplete: true, removeOnFail: 100 },
    );
  }

  /** Real state change, not a read-time guess: a candidate nobody acted on before `expiresAt` is EXPIRED. */
  private async expireStaleCandidates(matchId: string): Promise<void> {
    await this.candidateModel.updateMany(
      { matchId, status: "NOTIFIED", expiresAt: { $lt: new Date() } },
      { $set: { status: "EXPIRED" } },
    );
  }

  private async terminate(match: MatchDocument, status: "EXHAUSTED" | "CANCELLED"): Promise<void> {
    match.status = status;
    match.nextBatchAt = null;
    await match.save();
    this.logger.log(`Match ${match._id} is now ${status}`);
  }
}
