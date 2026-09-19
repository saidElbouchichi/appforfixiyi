/**
 * Time is always stored/exchanged in UTC (01_SPEC_PRODUCT.md #44).
 * Conversion to a local timezone happens only in the presentation layer.
 */

/** Current instant as an ISO-8601 UTC string. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}

export function isValidIsoDateTime(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

/** Milliseconds between two ISO-8601 UTC timestamps (`to` - `from`). */
export function diffMillis(from: string, to: string): number {
  return new Date(to).getTime() - new Date(from).getTime();
}
