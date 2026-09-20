import type {
  CreateProviderProfileInput,
  GeoPoint,
  ProviderAvailabilityStatus,
  ProviderProfile,
  UpdateProviderAvailabilityInput,
  UpdateProviderProfileInput,
} from "@fixiyi/contracts";
import { generateId, haversineDistanceKm } from "@fixiyi/shared-utils";
import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model, QueryFilter } from "mongoose";

import { CatalogService } from "../catalog/catalog.service.js";
import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";

import { ProviderProfileEntity, type ProviderProfileDocument } from "./schemas/provider-profile.schema.js";

const EARTH_RADIUS_KM = 6371;

/** What the matching engine asks for; the policy behind these values stays in `apps/api/src/matching/`. */
export interface ProviderDispatchSearch {
  serviceId: string;
  /** Hard requirement — every one of them must be held (Decision 41). */
  requiredSkillIds: string[];
  point: GeoPoint;
  radiusKm: number;
  availabilityStatuses: ProviderAvailabilityStatus[];
  excludeProviderIds: string[];
}

@Injectable()
export class ProviderService {
  constructor(
    @InjectModel(ProviderProfileEntity.name) private readonly model: Model<ProviderProfileEntity>,
    private readonly catalog: CatalogService,
  ) {}

  async getByUserId(userId: string): Promise<ProviderProfile | null> {
    const doc = await this.model.findOne({ userId });
    return doc ? toProviderProfile(doc) : null;
  }

  async getById(id: string): Promise<ProviderProfile> {
    const profile = await this.findById(id);
    if (!profile) {
      throw new NotFoundException("Provider profile not found");
    }
    return profile;
  }

  /** Reusable by other modules (e.g. VerificationService checking who may act on a PROVIDER verification case) — `null`, not a throw, when absent. */
  async findById(id: string): Promise<ProviderProfile | null> {
    const doc = await this.model.findById(id);
    return doc ? toProviderProfile(doc) : null;
  }

  async create(userId: string, input: CreateProviderProfileInput): Promise<ProviderProfile> {
    const existing = await this.model.findOne({ userId });
    if (existing) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        "PROVIDER_PROFILE_ALREADY_EXISTS",
        "A provider profile already exists for this account.",
      );
    }

    const created = await this.model.create({
      _id: generateId(),
      userId,
      type: input.type,
      displayName: input.displayName,
      bio: input.bio ?? null,
      languages: input.languages ?? [],
      experienceYears: input.experienceYears ?? null,
      skillIds: [],
      serviceIds: [],
      availability: [],
      serviceAreas: [],
    });
    return toProviderProfile(created);
  }

  async update(userId: string, input: UpdateProviderProfileInput): Promise<ProviderProfile> {
    const doc = await this.model.findOne({ userId });
    if (!doc) {
      throw new NotFoundException("Provider profile not found");
    }

    if (input.skillIds) {
      await this.assertCatalogRefs(input.skillIds, "SKILL", "PROVIDER_SKILL_INVALID");
      doc.skillIds = input.skillIds;
    }
    if (input.serviceIds) {
      await this.assertCatalogRefs(input.serviceIds, "SERVICE", "PROVIDER_SERVICE_INVALID");
      doc.serviceIds = input.serviceIds;
    }
    if (input.displayName !== undefined) doc.displayName = input.displayName;
    if (input.bio !== undefined) doc.bio = input.bio;
    if (input.languages !== undefined) doc.languages = input.languages;
    if (input.experienceYears !== undefined) doc.experienceYears = input.experienceYears;
    if (input.availability !== undefined) doc.availability = input.availability;
    if (input.serviceAreas !== undefined) doc.serviceAreas = input.serviceAreas;

    await doc.save();
    return toProviderProfile(doc);
  }

  /** 01_SPEC_PRODUCT.md #16 — only the statuses no intervention drives (Decision 42); the others are set by the system in Phase 8. */
  async updateAvailability(userId: string, input: UpdateProviderAvailabilityInput): Promise<ProviderProfile> {
    const doc = await this.model.findOne({ userId });
    if (!doc) {
      throw new NotFoundException("Provider profile not found");
    }
    doc.availabilityStatus = input.status;
    await doc.save();
    return toProviderProfile(doc);
  }

  /**
   * Real geospatial query against the `2dsphere` index prepared in Phase 3
   * (`serviceAreas.center`) — its first actual consumer. Two radii are at
   * play and both matter: `radiusKm` is how far the CLIENT is willing to
   * search, `serviceAreas[].radiusKm` is how far each PROVIDER is willing
   * to travel. Mongo filters on the first (indexed); the second is checked
   * per document below, since it varies per provider and cannot be
   * expressed in the same index lookup.
   *
   * A provider who declared no service area is therefore never matched —
   * correct: nothing says where they work.
   */
  async searchForDispatch(criteria: ProviderDispatchSearch): Promise<ProviderProfile[]> {
    const filter: QueryFilter<ProviderProfileEntity> = {
      availabilityStatus: { $in: criteria.availabilityStatuses },
      serviceIds: criteria.serviceId,
      "serviceAreas.center": {
        $geoWithin: { $centerSphere: [criteria.point.coordinates, criteria.radiusKm / EARTH_RADIUS_KM] },
      },
    };
    if (criteria.requiredSkillIds.length > 0) {
      filter.skillIds = { $all: criteria.requiredSkillIds };
    }
    if (criteria.excludeProviderIds.length > 0) {
      filter._id = { $nin: criteria.excludeProviderIds };
    }

    const docs = await this.model.find(filter);
    return docs.map(toProviderProfile).filter((profile) => coversPoint(profile, criteria.point));
  }

  private async assertCatalogRefs(ids: string[], level: "SKILL" | "SERVICE", code: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const count = await this.catalog.countExisting(ids, level);
    if (count !== new Set(ids).size) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, code, `Referenced ${level} ids must reference existing, active catalog nodes.`);
    }
  }
}

/** The request must fall inside at least one of the provider's own declared travel radii. */
function coversPoint(profile: ProviderProfile, point: GeoPoint): boolean {
  return profile.serviceAreas.some((area) => {
    const distance = haversineDistanceKm(
      { lng: area.center.coordinates[0], lat: area.center.coordinates[1] },
      { lng: point.coordinates[0], lat: point.coordinates[1] },
    );
    return distance <= area.radiusKm;
  });
}

function toProviderProfile(doc: ProviderProfileDocument): ProviderProfile {
  return {
    id: doc._id,
    userId: doc.userId,
    type: doc.type,
    availabilityStatus: doc.availabilityStatus,
    displayName: doc.displayName,
    bio: doc.bio,
    languages: doc.languages,
    experienceYears: doc.experienceYears,
    skillIds: doc.skillIds,
    serviceIds: doc.serviceIds,
    availability: doc.availability.map((slot) => ({ dayOfWeek: slot.dayOfWeek, startMinute: slot.startMinute, endMinute: slot.endMinute })),
    serviceAreas: doc.serviceAreas.map((area) => ({
      center: { type: "Point", coordinates: [area.center.coordinates[0] ?? 0, area.center.coordinates[1] ?? 0] },
      radiusKm: area.radiusKm,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
