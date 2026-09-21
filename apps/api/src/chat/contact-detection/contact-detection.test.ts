import { CONTACT_REDACTION_PLACEHOLDER as MASK } from "@fixiyi/contracts";
import { describe, expect, it } from "vitest";

import { detectContacts, redactContacts } from "./contact-detection.js";

function typesIn(text: string): string[] {
  return detectContacts(text).map((detection) => detection.type);
}

describe("test preconditions", () => {
  // Every expectation below compares against MASK. If @fixiyi/contracts' dist
  // is stale and lacks the constant, MASK is undefined, masked text reads
  // "...undefined...", and template-string comparisons pass VACUOUSLY on both
  // sides. That happened while writing this file; this guard makes it loud.
  it("resolves a real, non-empty redaction placeholder", () => {
    expect(typeof MASK).toBe("string");
    expect(MASK.length).toBeGreaterThan(0);
  });
});

describe("phones — the exit criterion of Phase 6", () => {
  const cases: [string, string][] = [
    ["plain Moroccan mobile", "appelez-moi au 0612345678"],
    ["spaced pairs", "appelez-moi au 06 12 34 56 78"],
    ["dots", "appelez-moi au 06.12.34.56.78"],
    ["dashes", "appelez-moi au 06-12-34-56-78"],
    ["international +212", "mon numero +212 6 12 34 56 78"],
    ["international 00212", "mon numero 00212612345678"],
    ["national without the leading 0", "mon numero 612345678"],
    ["landline", "le bureau: 0522 12 34 56"],
    ["foreign number", "en France: +33 6 12 34 56 78"],
    ["one digit per space", "0 6 1 2 3 4 5 6 7 8"],
    ["parentheses", "(06) 12 34 56 78"],
  ];

  for (const [label, text] of cases) {
    it(`masks a ${label}`, () => {
      const result = redactContacts(text);
      expect(result.text, label).toContain(MASK);
      expect(result.text, label).not.toMatch(/\d{2}.?\d{2}.?\d{2}.?\d{2}/);
      expect(result.redactions.map((r) => r.type), label).toContain("PHONE");
    });
  }

  it("masks only the number and keeps the rest of the message", () => {
    expect(redactContacts("Je passe demain, appelez-moi au 0612345678 merci").text).toBe(`Je passe demain, appelez-moi au ${MASK} merci`);
  });

  it("separates a phone glued to a neighbouring number by a space", () => {
    // The whole digit run "300 0612345678" is not a valid number, but its tail is.
    const result = redactContacts("prix 300 0612345678");
    expect(result.text).toBe(`prix 300 ${MASK}`);
  });

  it("masks two numbers in the same message", () => {
    const result = redactContacts("0612345678 ou 0698765432");
    expect(result.text).toBe(`${MASK} ou ${MASK}`);
    expect(result.redactions.filter((r) => r.type === "PHONE")).toHaveLength(2);
  });
});

describe("phones — obvious textual variants (#27)", () => {
  it("reads Arabic-Indic digits, as typed on an Arabic keyboard", () => {
    expect(typesIn("رقمي ٠٦١٢٣٤٥٦٧٨")).toContain("PHONE");
  });

  it("reads Persian digits", () => {
    expect(typesIn("۰۶۱۲۳۴۵۶۷۸")).toContain("PHONE");
  });

  it("reads full-width digits", () => {
    expect(typesIn("０６１２３４５６７８")).toContain("PHONE");
  });

  it("reads a French number dictated in pairs", () => {
    const text = "zero six douze trente-quatre cinquante-six soixante-dix-huit";
    const result = redactContacts(text);
    expect(result.redactions.map((r) => r.type)).toContain("PHONE");
    expect(result.text).toBe(MASK);
  });

  it("reads French compounds: vingt et un, quatre-vingt-dix-neuf", () => {
    // 06 21 99 34 56 -> "zero six vingt et un quatre-vingt-dix-neuf trente-quatre cinquante-six"
    expect(typesIn("zero six vingt et un quatre-vingt-dix-neuf trente-quatre cinquante-six")).toContain("PHONE");
  });

  it("reads accented and capitalised words", () => {
    expect(typesIn("Zéro Six Douze Trente-Quatre Cinquante-Six Soixante-Dix-Huit")).toContain("PHONE");
  });

  it("reads an English number spelled digit by digit", () => {
    expect(typesIn("zero six one two three four five six seven eight")).toContain("PHONE");
  });

  it("reads darija in Latin script (arabizi)", () => {
    expect(typesIn("sifr stta wahed jouj tlata rb3a khamsa stta sb3a tmnya")).toContain("PHONE");
  });

  it("reads darija in Arabic script", () => {
    expect(typesIn("صفر ستة واحد جوج ثلاثة أربعة خمسة ستة سبعة ثمانية")).toContain("PHONE");
  });

  it("reads letters used as digits: O for 0, l and I for 1", () => {
    expect(typesIn("O6I2345678")).toContain("PHONE");
    expect(typesIn("06l2345678")).toContain("PHONE");
  });

  it("reads a number grouped with no-break spaces, as French typography formats it", () => {
    // Built from code points so no editor or linter can silently normalise them.
    const nbsp = String.fromCharCode(0x00a0);
    const narrowNbsp = String.fromCharCode(0x202f);
    expect(typesIn(["06", "12", "34", "56", "78"].join(nbsp))).toContain("PHONE");
    expect(typesIn(["06", "12", "34", "56", "78"].join(narrowNbsp))).toContain("PHONE");
  });

  it("never joins digits across a line break", () => {
    // "06 12" on one line and "34 56 78" on the next are two fragments, not one number.
    expect(typesIn("06 12\n34 56 78")).not.toContain("PHONE");
  });

  it("reads digits mixed with spelled words", () => {
    expect(typesIn("06 douze 34 56 78")).toContain("PHONE");
  });

  it("masks the spelled-out words themselves, not some shifted slice of the text", () => {
    const result = redactContacts("appelle zero six douze trente-quatre cinquante-six soixante-dix-huit stp");
    expect(result.text).toBe(`appelle ${MASK} stp`);
  });

  it("keeps offsets right after an emoji (UTF-16 surrogate pairs)", () => {
    const result = redactContacts("👍👍 appelle 0612345678 stp");
    expect(result.text).toBe(`👍👍 appelle ${MASK} stp`);
  });
});

describe("phones — what must NOT be masked", () => {
  // A detector that masks prices or times makes the chat unusable.
  const ordinary: [string, string][] = [
    ["a price", "le devis est de 1500 DH"],
    ["several prices", "entre 1500 2000 et 3000 dirhams"],
    ["a time", "je peux venir a 14h30"],
    ["a time with colon", "rendez-vous a 09:45"],
    ["a date", "disponible le 12/10/2026"],
    ["an ISO date", "le 2026-10-12"],
    ["an address", "12 rue des Fleurs, Casablanca 20250"],
    ["a quantity", "il faut 3 tuyaux de 20 mm et 2 coudes"],
    ["a duration", "comptez 2 heures, peut-etre 3"],
    ["spelled small numbers in a sentence", "j'ai deux enfants et trois chats"],
    ["an article that is also a number word", "un plombier et une fuite"],
    ["neuf meaning new", "un tuyau neuf"],
    ["a year", "installe en 2019"],
    ["a reference", "facture n 4521"],
    ["a percentage", "remise de 15 %"],
    // Found by probing strings typical of this domain, then pinned here.
    ["a price with a thousands separator", "2 000 000 DH"],
    ["an order reference", "REF-2026-00123"],
    ["a bank account number", "RIB 011 780 0000123456789012 34"],
    ["a meter number", "compteur 45612378"],
    ["a serial number", "serie 12345678"],
    ["a national ID", "CIN AB123456"],
    ["time ranges", "entre 10h et 12h, puis 14h-18h"],
    ["dimensions", "12 x 34 x 56 cm"],
    ["an incomplete number", "06 12 34"],
  ];

  for (const [label, text] of ordinary) {
    it(`leaves ${label} alone`, () => {
      const result = redactContacts(text);
      expect(result.text, label).toBe(text);
      expect(result.redactions, label).toEqual([]);
    });
  }
});

describe("emails", () => {
  const cases: [string, string][] = [
    ["plain", "ecrivez a ahmed.plombier@gmail.com"],
    ["(at) (dot)", "ahmed (at) gmail (dot) com"],
    ["[at] [dot]", "ahmed[at]gmail[dot]com"],
    ["arobase / point", "ahmed arobase gmail point com"],
    ["spaced @", "ahmed @ gmail . com"],
    ["full-width @", "ahmed＠gmail.com"],
    ["provider name only", "mon mail ahmed123 sur gmail"],
  ];

  for (const [label, text] of cases) {
    it(`masks an email written ${label}`, () => {
      const result = redactContacts(text);
      expect(result.redactions.map((r) => r.type), label).toContain("EMAIL");
      expect(result.text, label).toContain(MASK);
      expect(result.text.toLowerCase(), label).not.toContain("gmail");
    });
  }

  it("does not treat the ordinary words 'at' and 'point' as an address", () => {
    for (const text of ["on se voit at the office", "c'est un point important", "je suis at home"]) {
      expect(redactContacts(text).redactions, text).toEqual([]);
    }
  });

  it("reports an email once, not also as a URL or a handle", () => {
    expect(typesIn("ahmed.plombier@gmail.com")).toEqual(["EMAIL"]);
  });
});

describe("links, handles and other channels", () => {
  it("masks an http link", () => {
    expect(redactContacts("voir https://example.com/profil").text).toBe(`voir ${MASK}`);
  });

  it("masks a www link", () => {
    expect(typesIn("www.plomberie-ahmed.ma")).toContain("URL");
  });

  it("masks a bare domain", () => {
    expect(typesIn("plomberie-ahmed.ma")).toContain("URL");
  });

  it("masks messaging shortlinks", () => {
    expect(typesIn("wa.me/212612345678")).toContain("URL");
    expect(typesIn("t.me/ahmed_plomberie")).toContain("URL");
  });

  it("masks an obfuscated domain", () => {
    expect(typesIn("plomberieahmed point com")).toContain("URL");
  });

  it("masks a social handle", () => {
    const result = redactContacts("mon insta @ahmed_plomberie");
    expect(result.text).not.toContain("ahmed_plomberie");
    expect(result.redactions.map((r) => r.type)).toContain("HANDLE");
  });

  it("does not read a file name as a website", () => {
    expect(redactContacts("voici photo.png et devis.pdf").redactions).toEqual([]);
  });

  it("records a mention of an external channel without masking the word", () => {
    const result = redactContacts("on continue sur whatsapp");
    expect(result.text).toBe("on continue sur whatsapp");
    expect(result.redactions).toEqual([{ type: "OFF_PLATFORM" }]);
  });

  it("recognises channel names in Arabic script", () => {
    expect(typesIn("كلمني فواتساب")).toContain("OFF_PLATFORM");
  });

  it("reports both the channel and the number when a message has both", () => {
    const types = typesIn("whatsapp 0612345678");
    expect(types).toContain("OFF_PLATFORM");
    expect(types).toContain("PHONE");
  });
});

describe("redaction output", () => {
  it("merges adjacent detections into one placeholder", () => {
    expect(redactContacts("ahmed@gmail.com 0612345678").text).toBe(`${MASK} ${MASK}`);
  });

  it("is idempotent — re-scanning a masked text finds nothing new", () => {
    const once = redactContacts("appelle 0612345678 ou ahmed@gmail.com");
    const twice = redactContacts(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.redactions).toEqual([]);
  });

  it("returns clean text untouched", () => {
    const text = "Bonjour, je peux passer demain matin vers 10h. Le devis est de 450 DH.";
    expect(redactContacts(text)).toEqual({ text, redactions: [] });
  });

  it("never stores the contact detail in the redaction record — only its type", () => {
    const result = redactContacts("0612345678");
    expect(JSON.stringify(result.redactions)).not.toContain("0612345678");
  });
});
