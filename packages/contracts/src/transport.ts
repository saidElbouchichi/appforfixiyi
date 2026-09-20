import { z } from "zod";

import { CurrencySchema, NonNegativeMoneyAmountSchema } from "./common.js";

/**
 * 01_SPEC_PRODUCT.md #18/#19 — the travel fee is computed by the engine
 * from distance/duration/configuration; the provider never sets it. A quote
 * is purely informational in Phase 5: nothing is charged (Payment is Phase
 * 9), it tells the provider and the client what the trip would cost.
 */
export const TransportQuoteSchema = z.object({
  distanceKm: z.number().nonnegative(),
  /** Estimated from distance while no routing provider is configured — see `MapProvider`. */
  travelTimeMinutes: z.number().int().nonnegative(),
  /** Distance beyond the free radius — the only part that is billed. */
  billableDistanceKm: z.number().nonnegative(),
  amountMinor: NonNegativeMoneyAmountSchema,
  currency: CurrencySchema,
  isFree: z.boolean(),
});
export type TransportQuote = z.infer<typeof TransportQuoteSchema>;
