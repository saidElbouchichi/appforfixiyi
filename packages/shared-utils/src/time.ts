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

/** Whole years between `dateOfBirthIso` and `atIso` (defaults to now) — feeds the minimum-provider-age rule (01_SPEC_PRODUCT.md #71). */
export function calculateAgeYears(dateOfBirthIso: string, atIso: string = nowIso()): number {
  const dob = new Date(dateOfBirthIso);
  const at = new Date(atIso);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthdayThisYear =
    at.getUTCMonth() > dob.getUTCMonth() || (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() >= dob.getUTCDate());
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
