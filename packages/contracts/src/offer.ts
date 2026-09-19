import { z } from "zod";

import { CurrencySchema, IdSchema, IsoDateTimeSchema, NonNegativeMoneyAmountSchema } from "./common.js";

/** 02_SPEC_ENGINEERING.md #100 — Offer state machine. */
export const OfferStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "COUNTERED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
]);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

/** 01_SPEC_PRODUCT.md #28 — an Offer is a structured business object, not a chat message. */
export const OfferSchema = z.object({
  id: IdSchema,
  requestId: IdSchema,
  providerId: IdSchema,
  serviceAmount: NonNegativeMoneyAmountSchema,
  transportAmount: NonNegativeMoneyAmountSchema,
  materialsAmount: NonNegativeMoneyAmountSchema,
  totalAmount: NonNegativeMoneyAmountSchema,
  currency: CurrencySchema,
  estimatedDurationMinutes: z.number().int().positive(),
  proposedDate: IsoDateTimeSchema.optional(),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  conditions: z.string().optional(),
  validityUntil: IsoDateTimeSchema,
  status: OfferStatusSchema,
  version: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Offer = z.infer<typeof OfferSchema>;
