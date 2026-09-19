import { z } from "zod";

/** Distributed identifier — UUIDv7 per 01_SPEC_PRODUCT.md #43. Format-checked as any UUID; version is enforced at generation time by @fixiyi/shared-utils. */
export const IdSchema = z.uuid();

/** ISO-4217 3-letter currency code. */
export const CurrencySchema = z.string().length(3);

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
