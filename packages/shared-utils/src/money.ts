/**
 * Monetary value rules — 01_SPEC_PRODUCT.md #39/#42, 02_SPEC_ENGINEERING.md #173:
 * amounts are ALWAYS integer minor units. Never a float. Division into major
 * units happens only at presentation time, in {@link formatMoney}.
 */
export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export class MoneyError extends Error {}

function assertInteger(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new MoneyError(
      `amountMinor must be an integer minor unit, got ${String(amountMinor)}`,
    );
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function createMoney(amountMinor: number, currency: string): Money {
  assertInteger(amountMinor);
  if (currency.length !== 3) {
    throw new MoneyError(`currency must be an ISO 4217 3-letter code, got "${currency}"`);
  }
  return { amountMinor, currency: currency.toUpperCase() };
}

export function zeroMoney(currency: string): Money {
  return createMoney(0, currency);
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return createMoney(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return createMoney(a.amountMinor - b.amountMinor, a.currency);
}

export function sumMoney(amounts: readonly Money[], currency: string): Money {
  return amounts.reduce((total, amount) => addMoney(total, amount), zeroMoney(currency));
}

/** Multiplies by a rate (e.g. a commission percentage as 0.1) and rounds to the nearest minor unit. */
export function multiplyMoney(money: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`factor must be finite, got ${String(factor)}`);
  }
  return createMoney(Math.round(money.amountMinor * factor), money.currency);
}

export function isPositive(money: Money): boolean {
  return money.amountMinor > 0;
}

export function isNegative(money: Money): boolean {
  return money.amountMinor < 0;
}

/**
 * Formats for display using the currency's real fraction-digit exponent
 * (e.g. 2 for MAD/EUR/USD, 0 for JPY) instead of assuming 2 everywhere.
 */
export function formatMoney(money: Money, locale = "en-US"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  });
  // Intl types allow undefined even though the runtime always returns a number here;
  // 2 matches the ISO 4217 default (used by e.g. MAD/EUR/USD) if it were ever absent.
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const majorAmount = money.amountMinor / 10 ** fractionDigits;
  return formatter.format(majorAmount);
}
