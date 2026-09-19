import { z } from "zod";

import { CurrencySchema, IdSchema, IsoDateTimeSchema, MoneyAmountSchema, NonNegativeMoneyAmountSchema } from "./common.js";

/** 01_SPEC_PRODUCT.md #38/#39 — provider wallet, integer minor units, immutable ledger entries. */
export const WalletTransactionTypeSchema = z.enum([
  "TOPUP",
  "COMMISSION",
  "RESERVATION",
  "RELEASE",
  "REFUND",
  "ADJUSTMENT",
]);
export type WalletTransactionType = z.infer<typeof WalletTransactionTypeSchema>;

export const WalletTransactionSchema = z.object({
  id: IdSchema,
  walletId: IdSchema,
  type: WalletTransactionTypeSchema,
  amountMinor: MoneyAmountSchema,
  currency: CurrencySchema,
  balanceAfterMinor: NonNegativeMoneyAmountSchema,
  idempotencyKey: z.string(),
  referenceType: z.string(),
  referenceId: IdSchema,
  actorId: IdSchema,
  reason: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;
