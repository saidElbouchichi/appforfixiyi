import {
  SystemConfigurationSchema,
  type MatchingConfig,
  type SystemConfiguration,
  type TransportConfig,
  type UpdateSystemConfigurationInput,
} from "@fixiyi/contracts";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { SeedLockService } from "../common/seed/seed-lock.service.js";

import { DEFAULT_MATCHING_CONFIG, DEFAULT_TRANSPORT_CONFIG } from "./configuration.defaults.js";
import { SYSTEM_CONFIGURATION_ID, SystemConfigurationEntity } from "./schemas/system-configuration.schema.js";

const SEED_LOCK_KEY = "system-configuration-v1";

/**
 * 01_SPEC_PRODUCT.md #97 — administrable business configuration. Every read
 * re-validates against the Zod contract: the document is stored loosely
 * (see the schema's note), so a hand-edited or partially migrated document
 * must fail loudly here rather than silently feed nonsense weights into the
 * matching engine.
 */
@Injectable()
export class ConfigurationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    @InjectModel(SystemConfigurationEntity.name) private readonly model: Model<SystemConfigurationEntity>,
    private readonly seedLock: SeedLockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedLock.runOnce(SEED_LOCK_KEY, async () => {
      await this.model.create({
        _id: SYSTEM_CONFIGURATION_ID,
        matching: DEFAULT_MATCHING_CONFIG,
        transport: DEFAULT_TRANSPORT_CONFIG,
        updatedBy: null,
      });
      this.logger.log("System configuration seeded with defaults");
    });
  }

  async get(): Promise<SystemConfiguration> {
    const doc = await this.model.findById(SYSTEM_CONFIGURATION_ID);
    if (!doc) {
      // Only reachable if the document was deleted after boot — defaults are still the correct answer.
      return SystemConfigurationSchema.parse({
        matching: DEFAULT_MATCHING_CONFIG,
        transport: DEFAULT_TRANSPORT_CONFIG,
        updatedBy: null,
        updatedAt: new Date().toISOString(),
      });
    }

    return SystemConfigurationSchema.parse({
      matching: doc.matching,
      transport: doc.transport,
      updatedBy: doc.updatedBy,
      updatedAt: doc.updatedAt.toISOString(),
    });
  }

  async getMatching(): Promise<MatchingConfig> {
    return (await this.get()).matching;
  }

  async getTransport(): Promise<TransportConfig> {
    return (await this.get()).transport;
  }

  async update(input: UpdateSystemConfigurationInput, actorUserId: string): Promise<SystemConfiguration> {
    const current = await this.get();

    // `weights` is merged on its own: the patch carries a PARTIAL weights object,
    // which is not assignable to the whole-object slot the outer merge expects.
    const { weights: weightsPatch, ...matchingPatch } = input.matching ?? {};
    const matching: MatchingConfig = {
      ...mergeDefined(current.matching, matchingPatch),
      weights: mergeDefined(current.matching.weights, weightsPatch),
    };
    const transport: TransportConfig = mergeDefined(current.transport, input.transport);

    // Validated before persisting: a partial update must never be able to write a document that fails `get()`.
    const validated = SystemConfigurationSchema.parse({
      matching,
      transport,
      updatedBy: actorUserId,
      updatedAt: new Date().toISOString(),
    });

    await this.model.updateOne(
      { _id: SYSTEM_CONFIGURATION_ID },
      { $set: { matching: validated.matching, transport: validated.transport, updatedBy: actorUserId } },
      { upsert: true },
    );

    return this.get();
  }
}

/**
 * Overlays only the keys actually present in `patch`. A plain spread would
 * write `undefined` over a real value under `exactOptionalPropertyTypes`,
 * turning "field omitted from the PATCH" into "field cleared".
 */
function mergeDefined<T extends object>(base: T, patch: { [K in keyof T]?: T[K] | undefined } | undefined): T {
  if (!patch) {
    return { ...base };
  }
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      merged[key as keyof T] = value as T[keyof T];
    }
  }
  return merged;
}
