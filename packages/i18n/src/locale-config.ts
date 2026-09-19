/**
 * 01_SPEC_PRODUCT.md #5 — the four languages Fixiyi must support. UI
 * language is independent from the language used to talk to the AI.
 *
 * Darija ("ary") content here is a best-effort placeholder for the
 * Foundation phase and must be reviewed by a native speaker before it
 * ships in a real screen.
 */
export const SUPPORTED_LOCALES = ["fr", "en", "ar", "ary"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "fr";

export interface LocaleInfo {
  readonly code: SupportedLocale;
  readonly nativeName: string;
  readonly dir: "ltr" | "rtl";
}

export const LOCALE_INFO: Record<SupportedLocale, LocaleInfo> = {
  fr: { code: "fr", nativeName: "Français", dir: "ltr" },
  en: { code: "en", nativeName: "English", dir: "ltr" },
  ar: { code: "ar", nativeName: "العربية", dir: "rtl" },
  ary: { code: "ary", nativeName: "الدارجة المغربية", dir: "rtl" },
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
