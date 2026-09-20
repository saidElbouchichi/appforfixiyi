import type { CreateProviderProfileInput, ProviderProfile, UpdateProviderProfileInput } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { CatalogService } from "../catalog/catalog.service.js";
import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";

import { ProviderProfileEntity, type ProviderProfileDocument } from "./schemas/provider-profile.schema.js";

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

function toProviderProfile(doc: ProviderProfileDocument): ProviderProfile {
  return {
    id: doc._id,
    userId: doc.userId,
    type: doc.type,
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
