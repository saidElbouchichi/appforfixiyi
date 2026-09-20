import { z } from "zod";

import { IdSchema, IsoDateTimeSchema, PhoneE164Schema } from "./common.js";
import { UserSchema } from "./user.js";

/** Verification codes are 4-8 digits — see `generateVerificationCode` in @fixiyi/shared-utils. */
const VerificationCodeSchema = z.string().regex(/^\d{4,8}$/, "Code must be 4 to 8 digits");

export const DeviceInputSchema = z.object({
  id: IdSchema.optional(),
  name: z.string().min(1).max(120).optional(),
});
export type DeviceInput = z.infer<typeof DeviceInputSchema>;

export const OtpRequestInputSchema = z.object({
  phone: PhoneE164Schema,
});
export type OtpRequestInput = z.infer<typeof OtpRequestInputSchema>;

/** `devCode` is only ever populated outside production, by the dev SmsProvider — never in a real send. */
export const OtpRequestOutputSchema = z.object({
  retryAfterSeconds: z.number().int().positive(),
  devCode: z.string().optional(),
});
export type OtpRequestOutput = z.infer<typeof OtpRequestOutputSchema>;

export const OtpVerifyInputSchema = z.object({
  phone: PhoneE164Schema,
  code: VerificationCodeSchema,
  device: DeviceInputSchema.optional(),
});
export type OtpVerifyInput = z.infer<typeof OtpVerifyInputSchema>;

/** Accepted for a future mobile client (01_SPEC_PRODUCT.md #69) that has no cookie jar; web relies on the refresh cookie instead. */
export const RefreshInputSchema = z.object({
  refreshToken: z.string().optional(),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthSessionResultSchema = AuthTokensSchema.extend({
  user: UserSchema,
});
export type AuthSessionResult = z.infer<typeof AuthSessionResultSchema>;

/** Device-management view of one session (01_SPEC_PRODUCT.md #70). */
export const SessionSchema = z.object({
  id: IdSchema,
  deviceName: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  lastUsedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  current: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

export const EmailAttachInputSchema = z.object({
  email: z.email(),
});
export type EmailAttachInput = z.infer<typeof EmailAttachInputSchema>;

export const EmailVerifyInputSchema = z.object({
  code: VerificationCodeSchema,
});
export type EmailVerifyInput = z.infer<typeof EmailVerifyInputSchema>;

/** 01_SPEC_PRODUCT.md #71 — needed to enforce the minimum-provider-age rule. */
export const UpdateMeInputSchema = z.object({
  dateOfBirth: IsoDateTimeSchema,
});
export type UpdateMeInput = z.infer<typeof UpdateMeInputSchema>;
