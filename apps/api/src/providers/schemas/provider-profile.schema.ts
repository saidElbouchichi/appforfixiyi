import type { ProviderType } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 01_SPEC_PRODUCT.md #98 `ProviderAvailability`, embedded (see PHASE_3_PLAN.md — always read/written with the profile). */
@Schema({ _id: false, versionKey: false })
export class AvailabilitySlotSubdocument {
  @Prop({ type: Number, required: true })
  dayOfWeek!: number;

  @Prop({ type: Number, required: true })
  startMinute!: number;

  @Prop({ type: Number, required: true })
  endMinute!: number;
}
export const AvailabilitySlotMongooseSchema = SchemaFactory.createForClass(AvailabilitySlotSubdocument);

@Schema({ _id: false, versionKey: false })
export class GeoPointSubdocument {
  @Prop({ type: String, required: true })
  type!: "Point";

  /** [longitude, latitude] — GeoJSON order. */
  @Prop({ type: [Number], required: true })
  coordinates!: number[];
}
export const GeoPointMongooseSchema = SchemaFactory.createForClass(GeoPointSubdocument);

/** 01_SPEC_PRODUCT.md #98 `ProviderServiceArea`, embedded. Real `2dsphere` index prepared for Phase 5 proximity matching — not queried yet. */
@Schema({ _id: false, versionKey: false })
export class ServiceAreaSubdocument {
  @Prop({ type: GeoPointMongooseSchema, required: true })
  center!: GeoPointSubdocument;

  @Prop({ type: Number, required: true })
  radiusKm!: number;
}
export const ServiceAreaMongooseSchema = SchemaFactory.createForClass(ServiceAreaSubdocument);

/**
 * 01_SPEC_PRODUCT.md #98 — `ProviderProfile` + embedded `ProviderSkill`
 * (`skillIds`) / `ProviderService` (`serviceIds`) / `ProviderAvailability`
 * (`availability`) / `ProviderServiceArea` (`serviceAreas`). See
 * PHASE_3_PLAN.md for why these 4 sub-aggregates are embedded rather than
 * 4 separate collections.
 */
@Schema({ collection: "provider_profiles", timestamps: true, versionKey: false })
export class ProviderProfileEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  /** One profile per user (01_SPEC_PRODUCT.md #6 — a single account, no second profile). */
  @Prop({ type: String, required: true, unique: true })
  userId!: string;

  @Prop({ type: String, required: true })
  type!: ProviderType;

  @Prop({ type: String, required: true })
  displayName!: string;

  @Prop({ type: String, default: null })
  bio!: string | null;

  @Prop({ type: [String], required: true, default: [] })
  languages!: string[];

  @Prop({ type: Number, default: null })
  experienceYears!: number | null;

  @Prop({ type: [String], required: true, default: [] })
  skillIds!: string[];

  @Prop({ type: [String], required: true, default: [] })
  serviceIds!: string[];

  @Prop({ type: [AvailabilitySlotMongooseSchema], required: true, default: [] })
  availability!: AvailabilitySlotSubdocument[];

  @Prop({ type: [ServiceAreaMongooseSchema], required: true, default: [] })
  serviceAreas!: ServiceAreaSubdocument[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type ProviderProfileDocument = HydratedDocument<ProviderProfileEntity>;
export const ProviderProfileEntitySchema = SchemaFactory.createForClass(ProviderProfileEntity);
ProviderProfileEntitySchema.index({ "serviceAreas.center": "2dsphere" });
