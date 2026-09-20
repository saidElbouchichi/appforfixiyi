import { z } from "zod";

import { IdSchema, IsoDateTimeSchema, PhoneE164Schema } from "./common.js";

/** 01_SPEC_PRODUCT.md #66 — RBAC roles. */
export const UserRoleSchema = z.enum([
  "CLIENT",
  "PROVIDER",
  "COMPANY_MEMBER",
  "SUPPORT",
  "VERIFICATION_AGENT",
  "MODERATOR",
  "DISPUTE_AGENT",
  "FINANCE_AGENT",
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Account lifecycle status — full deletion workflow (01_SPEC_PRODUCT.md #72) is a later phase. */
export const UserStatusSchema = z.enum(["ACTIVE", "DEACTIVATED"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

/** Public-safe representation of a User — never includes session/token internals. */
export const UserSchema = z.object({
  id: IdSchema,
  phone: PhoneE164Schema,
  phoneVerifiedAt: IsoDateTimeSchema.nullable(),
  email: z.email().nullable(),
  emailVerifiedAt: IsoDateTimeSchema.nullable(),
  dateOfBirth: IsoDateTimeSchema.nullable(),
  roles: z.array(UserRoleSchema).min(1),
  status: UserStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type User = z.infer<typeof UserSchema>;
