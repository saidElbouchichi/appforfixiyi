import { describe, expect, it } from "vitest";

import { WalletTransactionSchema } from "./wallet.js";

const validTransaction = {
  id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
  walletId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ac",
  type: "COMMISSION",
  amountMinor: -3000,
  currency: "MAD",
  balanceAfterMinor: 47000,
  idempotencyKey: "intervention-018f5b0a-commission",
  referenceType: "Intervention",
  referenceId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ad",
  actorId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ae",
  createdAt: "2026-09-19T10:00:00.000Z",
};

describe("WalletTransactionSchema", () => {
  it("parses a valid transaction (negative amountMinor allowed for debits)", () => {
    expect(WalletTransactionSchema.parse(validTransaction).amountMinor).toBe(-3000);
  });

  it("rejects a negative balanceAfterMinor", () => {
    expect(() =>
      WalletTransactionSchema.parse({ ...validTransaction, balanceAfterMinor: -1 }),
    ).toThrow();
  });

  it("rejects an unknown transaction type", () => {
    expect(() => WalletTransactionSchema.parse({ ...validTransaction, type: "BONUS" })).toThrow();
  });
});
