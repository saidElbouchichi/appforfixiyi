import { z } from "zod";

/** Distributed identifier — UUIDv7 per 01_SPEC_PRODUCT.md #43. Format-checked as any UUID; version is enforced at generation time by @fixiyi/shared-utils. */
export const IdSchema = z.uuid();

/** ISO-4217 3-letter currency code. */
export const CurrencySchema = z.string().length(3);

/**
 * E.164 phone number (leading `+`, no leading zero on the country code, max
 * 15 digits total) — syntactic contract-level check only. Deeper validation
 * (real country/number-plan) is done where a phone is actually dialled, e.g.
 * `apps/api`'s OTP service via `libphonenumber-js`.
 */
export const PhoneE164Schema = z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format");

/** Timestamps are always stored/exchanged in UTC — 01_SPEC_PRODUCT.md #44. */
export const IsoDateTimeSchema = z.iso.datetime();

/** Integer minor units — 01_SPEC_PRODUCT.md #39/#42. Never a float amount. */
export const MoneyAmountSchema = z.number().int();
export const NonNegativeMoneyAmountSchema = z.number().int().nonnegative();

export const MoneySchema = z.object({
  amountMinor: MoneyAmountSchema,
  currency: CurrencySchema,
});
export type MoneyDto = z.infer<typeof MoneySchema>;

/** Problem Details error shape — 02_SPEC_ENGINEERING.md #62 / 01_SPEC_PRODUCT.md #62. */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  traceId: z.string(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

/** Core fields every persisted document must carry — 01_SPEC_PRODUCT.md #99. */
export const BaseEntitySchema = z.object({
  id: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

/**
 * GeoJSON Point — shared primitive (moved here in Phase 4 from `provider.ts`,
 * which had the only consumer at the time; `location.ts` is now a second
 * real consumer for `ServiceRequest` locations).
 */
export const GeoPointSchema = z.object({
  type: z.literal("Point"),
  /** [longitude, latitude] — GeoJSON order, not [lat, lng]. */
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;
