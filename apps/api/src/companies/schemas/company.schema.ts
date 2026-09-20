import type { CompanyStatus } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 01_SPEC_PRODUCT.md #25 / 02_SPEC_ENGINEERING.md #98 — `Company` aggregate. */
@Schema({ collection: "companies", timestamps: true, versionKey: false })
export class CompanyEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: null })
  legalName!: string | null;

  @Prop({ type: String, default: null })
  registrationNumber!: string | null;

  @Prop({ type: String, required: true })
  representativeUserId!: string;

  @Prop({ type: String, required: true, default: "ACTIVE" })
  status!: CompanyStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CompanyDocument = HydratedDocument<CompanyEntity>;
export const CompanyEntitySchema = SchemaFactory.createForClass(CompanyEntity);
