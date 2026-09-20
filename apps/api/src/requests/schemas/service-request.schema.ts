import type { RequestStatus, RequestUrgency } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false, versionKey: false })
export class RequestGeoPointSubdocument {
  @Prop({ type: String, required: true })
  type!: "Point";

  /** [longitude, latitude] — GeoJSON order. */
  @Prop({ type: [Number], required: true })
  coordinates!: number[];
}
export const RequestGeoPointMongooseSchema = SchemaFactory.createForClass(RequestGeoPointSubdocument);

/** Exact position, stored as-is — see PHASE_4_PLAN.md for why approximation is deferred (Decision 35). */
@Schema({ _id: false, versionKey: false })
export class RequestLocationSubdocument {
  @Prop({ type: String, default: null })
  address!: string | null;

  @Prop({ type: RequestGeoPointMongooseSchema, required: true })
  point!: RequestGeoPointSubdocument;
}
export const RequestLocationMongooseSchema = SchemaFactory.createForClass(RequestLocationSubdocument);

/**
 * 01_SPEC_PRODUCT.md #10 — client-created request. `mediaIds` is
 * deliberately NOT stored here — it's computed at read time from the
 * `media` collection (`MediaService.listReadyIdsForTarget`), so there is
 * exactly one source of truth for "is this media attached and usable".
 */
@Schema({ collection: "service_requests", timestamps: true, versionKey: false })
export class ServiceRequestEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  clientUserId!: string;

  @Prop({ type: String, default: null })
  serviceId!: string | null;

  @Prop({ type: String, default: null })
  interventionTypeId!: string | null;

  @Prop({ type: String, default: null })
  complexityId!: string | null;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: String, default: null })
  urgency!: RequestUrgency | null;

  @Prop({ type: RequestLocationMongooseSchema, default: null })
  location!: RequestLocationSubdocument | null;

  @Prop({ type: String, required: true, default: "DRAFT" })
  status!: RequestStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ServiceRequestDocument = HydratedDocument<ServiceRequestEntity>;
export const ServiceRequestEntitySchema = SchemaFactory.createForClass(ServiceRequestEntity);
/** Prepared for Phase 5 proximity matching — not queried yet (same status as `ProviderProfileEntitySchema`'s `serviceAreas.center` index). */
ServiceRequestEntitySchema.index({ "location.point": "2dsphere" });
