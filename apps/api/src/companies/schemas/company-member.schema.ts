import type { CompanyMemberRole, CompanyMemberStatus } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 01_SPEC_PRODUCT.md #25 — `CompanyMember` aggregate (Members/Technicians). */
@Schema({ collection: "company_members", timestamps: false, versionKey: false })
export class CompanyMemberEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true })
  companyId!: string;

  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  role!: CompanyMemberRole;

  @Prop({ type: String, required: true, default: "INVITED" })
  status!: CompanyMemberStatus;

  @Prop({ type: Date, required: true })
  invitedAt!: Date;

  @Prop({ type: Date, default: null })
  joinedAt!: Date | null;
}

export type CompanyMemberDocument = HydratedDocument<CompanyMemberEntity>;
export const CompanyMemberEntitySchema = SchemaFactory.createForClass(CompanyMemberEntity);
// One membership per user per company — invite/accept mutate this single row rather than creating duplicates.
CompanyMemberEntitySchema.index({ companyId: 1, userId: 1 }, { unique: true });
