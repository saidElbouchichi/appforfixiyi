/** Minimal class-name joiner — a `clsx` dependency would be disproportionate for this. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");
}
