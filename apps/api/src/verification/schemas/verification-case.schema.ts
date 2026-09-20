import type { VerificationStatus, VerificationTargetType } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 01_SPEC_PRODUCT.md #23-24 — progressive verification, same state machine for individuals and companies. */
@Schema({ collection: "verification_cases", timestamps: true, versionKey: false })
export class VerificationCaseEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true })
  targetType!: VerificationTargetType;

  @Prop({ type: String, required: true })
  targetId!: string;

  @Prop({ type: String, required: true, default: "DRAFT" })
  status!: VerificationStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type VerificationCaseDocument = HydratedDocument<VerificationCaseEntity>;
export const VerificationCaseEntitySchema = SchemaFactory.createForClass(VerificationCaseEntity);
// One case per target — resubmission after NEEDS_CORRECTION reuses the same case, it doesn't create a new one.
VerificationCaseEntitySchema.index({ targetType: 1, targetId: 1 }, { unique: true });
