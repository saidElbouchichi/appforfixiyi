import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** Append-only record of each wave sent out — the audit trail proving dispatch was progressive, not a broadcast. */
@Schema({ collection: "dispatch_batches", timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class DispatchBatchEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  matchId!: string;

  @Prop({ type: Number, required: true })
  index!: number;

  @Prop({ type: Number, required: true })
  radiusKm!: number;

  @Prop({ type: [String], required: true, default: [] })
  candidateIds!: string[];

  @Prop({ type: Date, required: true })
  dispatchedAt!: Date;

  createdAt!: Date;
}

export type DispatchBatchDocument = HydratedDocument<DispatchBatchEntity>;
export const DispatchBatchEntitySchema = SchemaFactory.createForClass(DispatchBatchEntity);
DispatchBatchEntitySchema.index({ matchId: 1, index: 1 }, { unique: true });
