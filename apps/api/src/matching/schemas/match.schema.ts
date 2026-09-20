import type { MatchMode, MatchStatus } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** One match per `ServiceRequest` — the running state of the progressive dispatch (01_SPEC_PRODUCT.md #15). */
@Schema({ collection: "matches", timestamps: true, versionKey: false })
export class MatchEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, unique: true })
  requestId!: string;

  @Prop({ type: String, required: true, index: true })
  clientUserId!: string;

  @Prop({ type: String, required: true })
  mode!: MatchMode;

  @Prop({ type: String, required: true, default: "ACTIVE" })
  status!: MatchStatus;

  @Prop({ type: Number, required: true })
  currentRadiusKm!: number;

  @Prop({ type: Number, required: true, default: 0 })
  batchCount!: number;

  /** When the next batch is due. `null` once terminal — also what the scheduler checks before advancing. */
  @Prop({ type: Date, default: null })
  nextBatchAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MatchDocument = HydratedDocument<MatchEntity>;
export const MatchEntitySchema = SchemaFactory.createForClass(MatchEntity);
