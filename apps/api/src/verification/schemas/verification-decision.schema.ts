import type { VerificationDecisionOutcome } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 01_SPEC_PRODUCT.md #24 — "chaque decision doit etre historisee": append-only, never overwritten or deleted. */
@Schema({ collection: "verification_decisions", timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class VerificationDecisionEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  caseId!: string;

  @Prop({ type: String, required: true })
  decidedByUserId!: string;

  @Prop({ type: String, required: true })
  outcome!: VerificationDecisionOutcome;

  @Prop({ type: String, default: null })
  reason!: string | null;

  createdAt!: Date;
}

export type VerificationDecisionDocument = HydratedDocument<VerificationDecisionEntity>;
export const VerificationDecisionEntitySchema = SchemaFactory.createForClass(VerificationDecisionEntity);
