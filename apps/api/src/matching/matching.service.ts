import type {
  DeclineMatchInput,
  ExpandRadiusInput,
  Match,
  MatchCandidate,
  ProviderMatch,
  StartMatchInput,
} from "@fixiyi/contracts";
import { approximateCoordinates, generateId } from "@fixiyi/shared-utils";
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { ConfigurationService } from "../configuration/configuration.service.js";
import { GeoService } from "../geo/geo.service.js";
import { TransportPricingService } from "../geo/transport-pricing.service.js";
import { ProviderService } from "../providers/provider.service.js";
import { RequestService } from "../requests/request.service.js";

import { DispatchService } from "./dispatch.service.js";
import { MatchCandidateEntity, type MatchCandidateDocument } from "./schemas/match-candidate.schema.js";
import { MatchEntity, type MatchDocument } from "./schemas/match.schema.js";

@Injectable()
export class MatchingService {
  constructor(
    @InjectModel(MatchEntity.name) private readonly matchModel: Model<MatchEntity>,
    @InjectModel(MatchCandidateEntity.name) private readonly candidateModel: Model<MatchCandidateEntity>,
    private readonly requests: RequestService,
    private readonly providers: ProviderService,
    private readonly configuration: ConfigurationService,
    private readonly transport: TransportPricingService,
    private readonly geo: GeoService,
    private readonly dispatch: DispatchService,
  ) {}

  /**
   * 01_SPEC_PRODUCT.md #14 — AUTO (Fixiyi searches) or DIRECT (the client
   * picked a provider). Idempotent: re-starting an existing match returns
   * it instead of dispatching twice.
   */
  async start(requestId: string, clientUserId: string, input: StartMatchInput): Promise<Match> {
    const request = await this.requests.getById(requestId, clientUserId);

    const existing = await this.matchModel.findOne({ requestId });
    if (existing) {
      return this.toMatchWithCount(existing);
    }
    if (request.status !== "REQUESTED") {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "REQUEST_NOT_MATCHABLE",
        `Only a REQUESTED request can enter matching (current status: ${request.status}).`,
      );
    }

    const config = await this.configuration.getMatching();
    const mode = input.mode ?? "AUTO";

    const match = await this.matchModel.create({
      _id: generateId(),
      requestId,
      clientUserId,
      mode,
      status: "ACTIVE",
      currentRadiusKm: config.defaultRadiusKm,
      batchCount: 0,
      nextBatchAt: null,
    });

    await this.requests.markMatching(requestId);

    if (mode === "DIRECT") {
      await this.dispatchDirect(match, input.providerId ?? "", config.candidateExpirySeconds);
    } else {
      await this.dispatch.runBatch(match._id);
    }

    return this.getByRequest(requestId, clientUserId);
  }

  async getByRequest(requestId: string, clientUserId: string): Promise<Match> {
    await this.requests.getById(requestId, clientUserId);
    const match = await this.matchModel.findOne({ requestId });
    if (!match) {
      throw new NotFoundException("No match started for this request");
    }
    return this.toMatchWithCount(match);
  }

  private async toMatchWithCount(doc: MatchDocument): Promise<Match> {
    return toMatch(doc, await this.candidateModel.countDocuments({ matchId: doc._id }));
  }

  /** Client-facing: who was contacted, in which batch, with the score that put them there. */
  async listCandidates(requestId: string, clientUserId: string): Promise<MatchCandidate[]> {
    const match = await this.getByRequest(requestId, clientUserId);
    const candidates = await this.candidateModel.find({ matchId: match.id }).sort({ batchIndex: 1, score: -1 });

    const profiles = await Promise.all(candidates.map((candidate) => this.providers.findById(candidate.providerId)));
    return candidates.map((candidate, index) => toMatchCandidate(candidate, profiles[index]?.displayName ?? "—"));
  }

  /** 01_SPEC_PRODUCT.md #18 — the client may widen the search themselves; the next batch uses the new radius immediately. */
  async expandRadius(requestId: string, clientUserId: string, input: ExpandRadiusInput): Promise<Match> {
    const match = await this.requireActiveMatch(requestId, clientUserId);
    const config = await this.configuration.getMatching();

    if (input.radiusKm <= match.currentRadiusKm) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "MATCH_RADIUS_NOT_WIDER",
        `The new radius must be greater than the current ${match.currentRadiusKm.toString()}km.`,
      );
    }

    match.currentRadiusKm = Math.min(input.radiusKm, config.maxRadiusKm);
    await match.save();

    await this.dispatch.runBatch(match._id);
    return this.getByRequest(requestId, clientUserId);
  }

  /**
   * Provider-facing list — only their own dispatches, and only the
   * approximate location (01_SPEC_PRODUCT.md #17). This is the first real
   * caller of `approximateCoordinates()`, prepared in Phase 4 (Decision 36).
   */
  async listForProvider(providerUserId: string): Promise<ProviderMatch[]> {
    const candidates = await this.candidateModel
      .find({ providerUserId, status: { $in: ["NOTIFIED", "VIEWED"] } })
      .sort({ dispatchedAt: -1 });

    const matches: ProviderMatch[] = [];
    for (const candidate of candidates) {
      const request = await this.requests.findById(candidate.requestId);
      if (!request?.serviceId || !request.interventionTypeId || !request.complexityId || !request.location || !request.urgency) {
        continue;
      }

      const approximate = approximateCoordinates({
        lat: request.location.point.coordinates[1],
        lng: request.location.point.coordinates[0],
      });
      const approximateLocation = { type: "Point" as const, coordinates: [approximate.lng, approximate.lat] as [number, number] };

      matches.push({
        candidateId: candidate._id,
        matchId: candidate.matchId,
        requestId: candidate.requestId,
        status: candidate.status,
        serviceId: request.serviceId,
        interventionTypeId: request.interventionTypeId,
        complexityId: request.complexityId,
        description: request.description ?? "",
        urgency: request.urgency,
        approximateLocation,
        distanceKm: candidate.distanceKm,
        // Priced from the distance already computed at dispatch time, never from
        // coordinates: a fee derived from the exact point would leak it back.
        transportQuote: await this.transport.quoteForDistanceKm(candidate.distanceKm),
        mediaCount: request.mediaIds.length,
        dispatchedAt: candidate.dispatchedAt.toISOString(),
        expiresAt: candidate.expiresAt.toISOString(),
      });
    }
    return matches;
  }

  async markViewed(candidateId: string, providerUserId: string): Promise<ProviderMatch> {
    const candidate = await this.requireOwnCandidate(candidateId, providerUserId);
    if (candidate.status === "NOTIFIED") {
      candidate.status = "VIEWED";
      await candidate.save();
    }
    const matches = await this.listForProvider(providerUserId);
    const match = matches.find((entry) => entry.candidateId === candidateId);
    if (!match) {
      throw new NotFoundException("Dispatch not found");
    }
    return match;
  }

  async decline(candidateId: string, providerUserId: string, input: DeclineMatchInput): Promise<{ success: true }> {
    const candidate = await this.requireOwnCandidate(candidateId, providerUserId);
    if (candidate.status === "DECLINED") {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "MATCH_ALREADY_DECLINED", "This dispatch was already declined.");
    }
    candidate.status = "DECLINED";
    candidate.declineReason = input.reason ?? null;
    await candidate.save();
    return { success: true };
  }

  /** DIRECT mode bypasses ranking entirely — the client already chose (01_SPEC_PRODUCT.md #14, mode A). */
  private async dispatchDirect(match: MatchDocument, providerId: string, expirySeconds: number): Promise<void> {
    const profile = await this.providers.findById(providerId);
    if (!profile) {
      throw new NotFoundException("Provider profile not found");
    }

    const request = await this.requests.findById(match.requestId);
    const requestPoint = request?.location?.point;
    const distanceKm =
      requestPoint && profile.serviceAreas.length > 0
        ? Math.min(...profile.serviceAreas.map((area) => this.geo.distanceKm(area.center, requestPoint)))
        : 0;

    const now = new Date();
    await this.candidateModel.create({
      _id: generateId(),
      matchId: match._id,
      providerId: profile.id,
      providerUserId: profile.userId,
      requestId: match.requestId,
      batchIndex: 0,
      status: "NOTIFIED",
      score: 1,
      scoreBreakdown: {
        distance: 0,
        availability: 0,
        verificationLevel: 0,
        experience: 0,
        exploration: 0,
        reputation: 0,
        reliability: 0,
        history: 0,
        currentLoad: 0,
      },
      distanceKm,
      declineReason: null,
      dispatchedAt: now,
      expiresAt: new Date(now.getTime() + expirySeconds * 1000),
    });

    match.batchCount = 1;
    match.status = "EXHAUSTED"; // Nothing more to dispatch: the client picked exactly one provider.
    match.nextBatchAt = null;
    await match.save();
  }

  private async requireActiveMatch(requestId: string, clientUserId: string): Promise<MatchDocument> {
    await this.requests.getById(requestId, clientUserId);
    const match = await this.matchModel.findOne({ requestId });
    if (!match) {
      throw new NotFoundException("No match started for this request");
    }
    if (match.status !== "ACTIVE") {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "MATCH_NOT_ACTIVE", `This match is ${match.status}.`);
    }
    return match;
  }

  private async requireOwnCandidate(candidateId: string, providerUserId: string): Promise<MatchCandidateDocument> {
    const candidate = await this.candidateModel.findById(candidateId);
    if (!candidate) {
      throw new NotFoundException("Dispatch not found");
    }
    if (candidate.providerUserId !== providerUserId) {
      throw new ForbiddenException("This dispatch was not sent to you.");
    }
    return candidate;
  }
}

function toMatch(doc: MatchDocument, candidateCount: number): Match {
  return {
    id: doc._id,
    requestId: doc.requestId,
    clientUserId: doc.clientUserId,
    mode: doc.mode,
    status: doc.status,
    currentRadiusKm: doc.currentRadiusKm,
    batchCount: doc.batchCount,
    candidateCount,
    nextBatchAt: doc.nextBatchAt ? doc.nextBatchAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toMatchCandidate(doc: MatchCandidateDocument, providerDisplayName: string): MatchCandidate {
  return {
    id: doc._id,
    matchId: doc.matchId,
    providerId: doc.providerId,
    providerDisplayName,
    batchIndex: doc.batchIndex,
    status: doc.status,
    score: doc.score,
    scoreBreakdown: doc.scoreBreakdown,
    distanceKm: doc.distanceKm,
    declineReason: doc.declineReason,
    dispatchedAt: doc.dispatchedAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
  };
}
