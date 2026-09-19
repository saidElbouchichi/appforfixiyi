import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "./locale-config.js";
import { getMessages, translate } from "./messages.js";

describe("i18n messages", () => {
  it("every supported locale has a catalog with the same keys as the default locale", () => {
    const defaultKeys = Object.keys(getMessages("fr")).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(getMessages(locale)).sort()).toEqual(defaultKeys);
    }
  });

  it("translate resolves a key for a given locale", () => {
    expect(translate("en", "common.appName")).toBe("Fixiyi");
    expect(translate("ar", "common.loading")).toBe("جارٍ التحميل...");
  });

  it("falls back to the default locale for a key missing in another catalog", () => {
    // ary/ar catalogs are hand-maintained placeholders; the merge must never surface `undefined`.
    const messages = getMessages("ary");
    for (const value of Object.values(messages)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
