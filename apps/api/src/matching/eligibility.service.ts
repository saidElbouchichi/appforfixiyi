import type { GeoPoint, MatchingConfig, ProviderProfile } from "@fixiyi/contracts";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { CatalogService } from "../catalog/catalog.service.js";
import { GeoService } from "../geo/geo.service.js";
import { ProviderService } from "../providers/provider.service.js";
import { VerificationService } from "../verification/verification.service.js";

import type { RankingCandidate } from "./ranking.js";
import { MatchCandidateEntity } from "./schemas/match-candidate.schema.js";

/** Only a provider actively taking work is dispatched to; every other status means "not now" (01_SPEC_PRODUCT.md #16). */
const DISPATCHABLE_STATUSES = ["AVAILABLE"] as const;

export interface EligibilityQuery {
  serviceId: string;
  complexityId: string;
  point: GeoPoint;
  radiusKm: number;
  excludeProviderIds: string[];
  config: MatchingConfig;
}

export interface EligibleProvider {
  profile: ProviderProfile;
  ranking: RankingCandidate;
}

/**
 * The hard filters of 01_SPEC_PRODUCT.md #15's "Eligibility" step — who may
 * be contacted at all, before any ranking. Everything here excludes;
 * nothing here scores.
 */
@Injectable()
export class EligibilityService {
  constructor(
    @InjectModel(MatchCandidateEntity.name) private readonly candidateModel: Model<MatchCandidateEntity>,
    private readonly providers: ProviderService,
    private readonly catalog: CatalogService,
    private readonly verification: VerificationService,
    private readonly geo: GeoService,
  ) {}

  async findEligible(query: EligibilityQuery): Promise<EligibleProvider[]> {
    const complexity = await this.catalog.getById(query.complexityId);
    const requiredSkillIds = complexity?.requiredSkillIds ?? [];

    const profiles = await this.providers.searchForDispatch({
      serviceId: query.serviceId,
      requiredSkillIds,
      point: query.point,
      radiusKm: query.radiusKm,
      availabilityStatuses: [...DISPATCHABLE_STATUSES],
      excludeProviderIds: query.excludeProviderIds,
    });

    if (profiles.length === 0) {
      return [];
    }

    const providerIds = profiles.map((profile) => profile.id);
    const verifiedIds = await this.verification.findVerifiedTargetIds("PROVIDER", providerIds);

    // `requireVerifiedProvider` is a hard filter when enabled, a ranking signal otherwise.
    const retained = query.config.requireVerifiedProvider ? profiles.filter((profile) => verifiedIds.has(profile.id)) : profiles;
    if (retained.length === 0) {
      return [];
    }

    const dispatchCounts = await this.countPastDispatches(retained.map((profile) => profile.id));

    return retained.map((profile) => ({
      profile,
      ranking: {
        providerId: profile.id,
        distanceKm: this.nearestAreaDistanceKm(profile, query.point),
        experienceYears: profile.experienceYears,
        availability: profile.availability,
        verified: verifiedIds.has(profile.id),
        pastDispatchCount: dispatchCounts.get(profile.id) ?? 0,
      },
    }));
  }

  /** Real exposure history — how many times each provider has already been dispatched to, across every match. */
  private async countPastDispatches(providerIds: string[]): Promise<Map<string, number>> {
    const rows = await this.candidateModel.aggregate<{ _id: string; count: number }>([
      { $match: { providerId: { $in: providerIds } } },
      { $group: { _id: "$providerId", count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id, row.count]));
  }

  /**
   * A profile has no single coordinate — only service areas. The nearest
   * area centre is the best real proxy for "how far is this provider",
   * and it is exactly the point the provider said they work around.
   */
  private nearestAreaDistanceKm(profile: ProviderProfile, point: GeoPoint): number {
    const distances = profile.serviceAreas.map((area) => this.geo.distanceKm(area.center, point));
    return distances.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...distances);
  }
}
