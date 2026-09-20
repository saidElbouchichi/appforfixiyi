import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 02_SPEC_ENGINEERING.md #98 — `Device` aggregate (device/session management, 01_SPEC_PRODUCT.md #70). */
@Schema({ collection: "devices", timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class DeviceEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, default: null })
  name!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  lastSeenIp!: string | null;

  @Prop({ type: Date, required: true })
  lastSeenAt!: Date;

  createdAt!: Date;
}

export type DeviceDocument = HydratedDocument<DeviceEntity>;
export const DeviceEntitySchema = SchemaFactory.createForClass(DeviceEntity);
// TTL index: a device untouched for 90 days is purged. `lastSeenAt` is bumped
// on every login/refresh (see SessionService.upsertDevice), so this counts
// down from the device's *last* real use, not its creation. Safe against
// dangling session references: a UserSession's own TTL (`expiresAt`, capped
// at JWT_REFRESH_TTL — 30 days by default) always deletes the session long
// before a device it points to could reach 90 days of inactivity.
const DEVICE_INACTIVITY_TTL_SECONDS = 90 * 24 * 60 * 60;
DeviceEntitySchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: DEVICE_INACTIVITY_TTL_SECONDS });
