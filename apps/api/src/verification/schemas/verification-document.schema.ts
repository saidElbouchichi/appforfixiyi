import type { VerificationDocumentStatus, VerificationDocumentType } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ collection: "verification_documents", timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class VerificationDocumentEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  caseId!: string;

  @Prop({ type: String, required: true })
  type!: VerificationDocumentType;

  @Prop({ type: String, required: true, default: "PENDING_UPLOAD" })
  status!: VerificationDocumentStatus;

  /** MinIO/S3 object key — real object existence is verified via `StorageService.objectExists` before this ever becomes UPLOADED. */
  @Prop({ type: String, required: true })
  objectKey!: string;

  createdAt!: Date;
}

export type VerificationDocumentDocument = HydratedDocument<VerificationDocumentEntity>;
export const VerificationDocumentEntitySchema = SchemaFactory.createForClass(VerificationDocumentEntity);
