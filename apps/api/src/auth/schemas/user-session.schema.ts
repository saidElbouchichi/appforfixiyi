import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const SESSION_REVOKED_REASONS = ["LOGOUT", "LOGOUT_ALL", "REUSE_DETECTED", "REVOKED_BY_USER"] as const;
export type SessionRevokedReason = (typeof SESSION_REVOKED_REASONS)[number];

/**
 * 02_SPEC_ENGINEERING.md #98 — `UserSession` aggregate. The refresh JWT
 * itself is never persisted: only `tokenVersion` (bumped on each rotation)
 * is stored, so a stale-but-still-signature-valid refresh token is detected
 * by comparing its `rtv` claim against this field — no token hashing needed.
 */
@Schema({ collection: "user_sessions", timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class UserSessionEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true })
  deviceId!: string;

  @Prop({ type: Number, required: true, default: 0 })
  tokenVersion!: number;

  @Prop({ type: String, enum: ["ACTIVE", "REVOKED"], required: true, default: "ACTIVE" })
  status!: "ACTIVE" | "REVOKED";

  @Prop({ type: String, enum: SESSION_REVOKED_REASONS, default: null })
  revokedReason!: SessionRevokedReason | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: Date, required: true })
  lastUsedAt!: Date;

  /** Hard session lifetime (from JWT_REFRESH_TTL at creation) — rotation never extends it. */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  createdAt!: Date;
}

export type UserSessionDocument = HydratedDocument<UserSessionEntity>;
export const UserSessionEntitySchema = SchemaFactory.createForClass(UserSessionEntity);
// TTL index: MongoDB deletes a session document once `expiresAt` is in the
// past (`expireAfterSeconds: 0` = "expire exactly at the stored timestamp",
// not N seconds after it) — no cron job, no manual cleanup. Also serves as
// the lookup index for `findActiveById`/`rotate` (single index, dual purpose).
UserSessionEntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
