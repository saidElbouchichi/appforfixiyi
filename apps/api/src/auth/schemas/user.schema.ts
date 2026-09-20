import type { UserRole, UserStatus } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** 02_SPEC_ENGINEERING.md #98 — `User` aggregate. */
@Schema({ collection: "users", timestamps: true, versionKey: false })
export class UserEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  phone!: string;

  @Prop({ type: Date, default: null })
  phoneVerifiedAt!: Date | null;

  /** Set only once `pendingEmail` is verified — see `pendingEmail`. Uniqueness enforced by the partial index below (not `sparse`: a `sparse` index only excludes a *missing* field, but every document here explicitly stores `email: null`). */
  @Prop({ type: String, default: null })
  email!: string | null;

  @Prop({ type: Date, default: null })
  emailVerifiedAt!: Date | null;

  /** Email awaiting verification via `POST /auth/email/verify` — not yet public until confirmed. */
  @Prop({ type: String, default: null })
  pendingEmail!: string | null;

  /** Required to enforce the minimum-provider-age rule (01_SPEC_PRODUCT.md #71). */
  @Prop({ type: Date, default: null })
  dateOfBirth!: Date | null;

  @Prop({ type: [String], required: true, default: ["CLIENT"] })
  roles!: UserRole[];

  @Prop({ type: String, required: true, default: "ACTIVE" })
  status!: UserStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<UserEntity>;
export const UserEntitySchema = SchemaFactory.createForClass(UserEntity);
// Partial index: only documents where `email` is an actual string participate in the
// uniqueness check, so any number of users can share `email: null`.
UserEntitySchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
