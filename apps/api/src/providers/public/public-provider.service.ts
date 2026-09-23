import type { ProviderProfile, PublicProviderProfile } from "@fixiyi/contracts";
import { approximateCoordinates } from "@fixiyi/shared-utils";
import { Injectable } from "@nestjs/common";

import { VerificationService } from "../../verification/verification.service.js";
import { ProviderService } from "../provider.service.js";

/**
 * The public read model of a provider (Decision 70), composed from two
 * domains: the profile itself and whether a verification case was approved.
 *
 * It lives in its own module on purpose. `VerificationService` already needs
 * `ProviderService` (to know who owns a case), so letting `ProviderService`
 * reach back into verification would close a cycle — which this repository
 * forbids (`import-x/no-cycle`). A read model that depends on both, and that
 * neither depends on, keeps the graph acyclic and says what this really is:
 * a view, not a domain.
 */
@Injectable()
export class PublicProviderService {
  constructor(
    private readonly providers: ProviderService,
    private readonly verification: VerificationService,
  ) {}

  /**
   * No `userId`, no exact service-area centre, and no rating, review count or
   * job count — none of those three exists in the database, so none of them
   * is invented here (D2, 03_AGENT_PROTOCOL §2).
   */
  async getById(id: string): Promise<PublicProviderProfile> {
    const profile = await this.providers.getById(id);
    const verifiedIds = await this.verification.findVerifiedTargetIds("PROVIDER", [profile.id]);
    return toPublicProviderProfile(profile, verifiedIds.has(profile.id));
  }
}

/**
 * The exact centre never leaves: it is rounded by `approximateCoordinates()`
 * — the same blur the matching engine already applies to a client's address
 * before a provider sees it (01_SPEC_PRODUCT.md #17).
 */
function toPublicProviderProfile(profile: ProviderProfile, verified: boolean): PublicProviderProfile {
  return {
    id: profile.id,
    type: profile.type,
    displayName: profile.displayName,
    bio: profile.bio,
    languages: profile.languages,
    experienceYears: profile.experienceYears,
    skillIds: profile.skillIds,
    serviceIds: profile.serviceIds,
    availability: profile.availability,
    availabilityStatus: profile.availabilityStatus,
    serviceZones: profile.serviceAreas.map((area) => {
      const [lng, lat] = area.center.coordinates;
      const blurred = approximateCoordinates({ lat, lng });
      return {
        approximateCenter: { type: "Point" as const, coordinates: [blurred.lng, blurred.lat] as [number, number] },
        radiusKm: area.radiusKm,
      };
    }),
    verified,
    createdAt: profile.createdAt,
  };
}
