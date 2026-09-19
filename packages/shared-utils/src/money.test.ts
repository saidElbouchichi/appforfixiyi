import { describe, expect, it } from "vitest";

import {
  addMoney,
  createMoney,
  formatMoney,
  isNegative,
  isPositive,
  MoneyError,
  multiplyMoney,
  subtractMoney,
  sumMoney,
  zeroMoney,
} from "./money.js";

describe("money", () => {
  it("rejects non-integer amounts", () => {
    expect(() => createMoney(300.55, "MAD")).toThrow(MoneyError);
  });

  it("rejects invalid currency codes", () => {
    expect(() => createMoney(100, "MA")).toThrow(MoneyError);
  });

  it("normalizes currency to uppercase", () => {
    expect(createMoney(100, "mad").currency).toBe("MAD");
  });

  it("adds and subtracts amounts of the same currency", () => {
    const a = createMoney(30000, "MAD");
    const b = createMoney(2000, "MAD");
    expect(addMoney(a, b)).toEqual({ amountMinor: 32000, currency: "MAD" });
    expect(subtractMoney(a, b)).toEqual({ amountMinor: 28000, currency: "MAD" });
  });

  it("refuses to mix currencies", () => {
    const mad = createMoney(100, "MAD");
    const usd = createMoney(100, "USD");
    expect(() => addMoney(mad, usd)).toThrow(MoneyError);
  });

  it("sums a list of amounts against a base currency", () => {
    const amounts = [createMoney(1000, "MAD"), createMoney(2000, "MAD"), createMoney(500, "MAD")];
    expect(sumMoney(amounts, "MAD")).toEqual({ amountMinor: 3500, currency: "MAD" });
  });

  it("computes a commission via multiplyMoney (wallet example from 01_SPEC_PRODUCT.md #38)", () => {
    const service = createMoney(30000, "MAD"); // 300 MAD
    const commission = multiplyMoney(service, 0.1); // 10%
    expect(commission).toEqual({ amountMinor: 3000, currency: "MAD" }); // 30 MAD
  });

  it("rounds multiplication to the nearest minor unit instead of producing a float", () => {
    const amount = createMoney(1, "MAD");
    const result = multiplyMoney(amount, 0.5);
    expect(Number.isInteger(result.amountMinor)).toBe(true);
  });

  it("reports sign", () => {
    expect(isPositive(createMoney(1, "MAD"))).toBe(true);
    expect(isNegative(createMoney(-1, "MAD"))).toBe(true);
    expect(isPositive(zeroMoney("MAD"))).toBe(false);
  });

  it("formats using the currency's real fraction-digit exponent", () => {
    expect(formatMoney(createMoney(30000, "MAD"), "en-US")).toContain("300");
    expect(formatMoney(createMoney(150, "JPY"), "en-US")).toContain("150");
  });
});
