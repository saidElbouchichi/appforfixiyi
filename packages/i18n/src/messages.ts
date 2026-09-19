import { DEFAULT_LOCALE, type SupportedLocale } from "./locale-config.js";
import ar from "./locales/ar.json" with { type: "json" };
import ary from "./locales/ary.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };

export type MessageKey = keyof typeof fr;
export type Messages = Record<MessageKey, string>;

const catalogs: Record<SupportedLocale, Messages> = { fr, en, ar, ary };

/** Returns the full message catalog for a locale, falling back key-by-key to {@link DEFAULT_LOCALE}. */
export function getMessages(locale: SupportedLocale): Messages {
  if (locale === DEFAULT_LOCALE) {
    return catalogs[DEFAULT_LOCALE];
  }
  return { ...catalogs[DEFAULT_LOCALE], ...catalogs[locale] };
}

export function translate(locale: SupportedLocale, key: MessageKey): string {
  return getMessages(locale)[key];
}
