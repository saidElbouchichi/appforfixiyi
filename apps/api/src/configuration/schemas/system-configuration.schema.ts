import type { MatchingConfig, TransportConfig } from "@fixiyi/contracts";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** Singleton document — there is exactly one business configuration, so its id is fixed rather than generated. */
export const SYSTEM_CONFIGURATION_ID = "system";

/**
 * `matching`/`transport` are stored as plain objects rather than nested
 * Mongoose sub-schemas: the authoritative shape is the Zod contract
 * (`SystemConfigurationSchema`), validated on every read and write in
 * `ConfigurationService`, so duplicating it as a Mongoose schema would be
 * two sources of truth to keep in sync. Always assigned whole (never mutated
 * in place), so Mongoose change tracking stays correct.
 */
@Schema({ collection: "system_configuration", timestamps: true, versionKey: false })
export class SystemConfigurationEntity {
  @Prop({ type: String, default: SYSTEM_CONFIGURATION_ID })
  _id!: string;

  @Prop({ type: Object, required: true })
  matching!: MatchingConfig;

  @Prop({ type: Object, required: true })
  transport!: TransportConfig;

  @Prop({ type: String, default: null })
  updatedBy!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SystemConfigurationDocument = HydratedDocument<SystemConfigurationEntity>;
export const SystemConfigurationEntitySchema = SchemaFactory.createForClass(SystemConfigurationEntity);
