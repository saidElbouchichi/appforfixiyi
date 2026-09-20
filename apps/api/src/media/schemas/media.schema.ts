import type { MediaKind, MediaStatus, MediaTargetType } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ collection: "media", timestamps: true, versionKey: false })
export class MediaEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  ownerUserId!: string;

  @Prop({ type: String, required: true })
  targetType!: MediaTargetType;

  @Prop({ type: String, required: true, index: true })
  targetId!: string;

  @Prop({ type: String, required: true })
  kind!: MediaKind;

  @Prop({ type: String, required: true, default: "PENDING_UPLOAD" })
  status!: MediaStatus;

  @Prop({ type: String, required: true })
  contentType!: string;

  @Prop({ type: String, required: true })
  fileName!: string;

  /** MinIO/S3 object key — real existence/signature are verified against it before this ever leaves PENDING_UPLOAD. */
  @Prop({ type: String, required: true })
  objectKey!: string;

  @Prop({ type: Number, required: true })
  declaredSizeBytes!: number;

  @Prop({ type: Number, default: null })
  actualSizeBytes!: number | null;

  @Prop({ type: Number, default: null })
  width!: number | null;

  @Prop({ type: Number, default: null })
  height!: number | null;

  @Prop({ type: String, default: null })
  rejectionReason!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaDocument = HydratedDocument<MediaEntity>;
export const MediaEntitySchema = SchemaFactory.createForClass(MediaEntity);
