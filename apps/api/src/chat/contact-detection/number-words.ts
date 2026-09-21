/**
 * Spelled-out numbers -> digits, for the "variantes textuelles evidentes" of
 * 01_SPEC_PRODUCT.md #27: someone who cannot type "06 12 34 56 78" types
 * "zero six douze trente-quatre cinquante-six soixante-dix-huit" instead.
 *
 * Languages are the ones the product actually serves (#5): French, English,
 * Moroccan darija in Latin script (arabizi, where digits stand in for Arabic
 * letters — "rb3a", "sb3a") and in Arabic script.
 *
 * Deliberately a small, closed lexicon rather than a general number parser:
 * the goal is to rebuild a DICTATED phone number, not to understand
 * "deux cent mille". A French phone number is dictated in pairs, so the
 * parser handles the forms pairs take (units, teens, tens + unit, the
 * soixante-dix / quatre-vingt compounds) and nothing larger.
 */

type WordKind = "unit" | "teen" | "tens";

interface NumberWord {
  kind: WordKind;
  value: number;
}

const UNITS: Record<string, number> = {
  // fr
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  // en
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9,
  // darija, Latin script
  sifr: 0, wahed: 1, wa7ed: 1, jouj: 2, zouj: 2, tlata: 3, tlat: 3, rb3a: 4, reb3a: 4, arba3a: 4,
  khamsa: 5, "5amsa": 5, stta: 6, sitta: 6, sb3a: 7, seb3a: 7, tmnya: 8, tmenya: 8, tmanya: 8,
  ts3oud: 9, tes3oud: 9, tis3a: 9,
  // Arabic script (MSA + darija spellings)
  صفر: 0, واحد: 1, اثنان: 2, اثنين: 2, جوج: 2, ثلاثة: 3, تلاتة: 3, أربعة: 4, اربعة: 4, ربعة: 4,
  خمسة: 5, ستة: 6, سبعة: 7, ثمانية: 8, تمنية: 8, تسعة: 9, تسعود: 9,
};

const TEENS: Record<string, number> = {
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Lower-cased, accents stripped — "Zéro" and "zero" are the same word. */
export function foldWord(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function lookupNumberWord(word: string): NumberWord | null {
  const folded = foldWord(word);
  if (folded in UNITS) return { kind: "unit", value: UNITS[folded] ?? 0 };
  if (folded in TEENS) return { kind: "teen", value: TEENS[folded] ?? 0 };
  if (folded in TENS) return { kind: "tens", value: TENS[folded] ?? 0 };
  return null;
}

/** A parsed number and which input words it consumed (indices into the word list). */
export interface ParsedNumber {
  value: number;
  firstWord: number;
  lastWord: number;
}

interface Cursor {
  words: string[];
  index: number;
}

function peek(cursor: Cursor, offset = 0): string | undefined {
  const word = cursor.words[cursor.index + offset];
  return word === undefined ? undefined : foldWord(word);
}

function kindAt(cursor: Cursor, offset = 0): NumberWord | null {
  const word = cursor.words[cursor.index + offset];
  return word === undefined ? null : lookupNumberWord(word);
}

/** "dix" followed by sept/huit/neuf -> 17/18/19 ("dix-sept"). Returns the extra value, advancing past it. */
function takeDixCompound(cursor: Cursor): number | null {
  if (peek(cursor) !== "dix") return null;
  const unit = kindAt(cursor, 1);
  if (unit?.kind === "unit" && unit.value >= 7) {
    cursor.index += 2;
    return 10 + unit.value;
  }
  return null;
}

/** What may follow soixante / quatre-vingt: a teen, a dix-compound, or a unit. */
function takeSixtyOrEightyTail(cursor: Cursor): number {
  const dix = takeDixCompound(cursor);
  if (dix !== null) return dix;
  const next = kindAt(cursor);
  if (next?.kind === "teen" || (next?.kind === "unit" && next.value > 0)) {
    cursor.index += 1;
    return next.value;
  }
  return 0;
}

/** What may follow a plain tens word: "et un" / a unit. */
function takeTensTail(cursor: Cursor): number {
  if (peek(cursor) === "et") {
    const after = kindAt(cursor, 1);
    if (after && after.value > 0 && after.value <= 11) {
      cursor.index += 2;
      return after.value;
    }
    return 0;
  }
  const next = kindAt(cursor);
  if (next?.kind === "unit" && next.value > 0) {
    cursor.index += 1;
    return next.value;
  }
  return 0;
}

function parseOne(cursor: Cursor): number {
  const word = peek(cursor);
  const current = kindAt(cursor);

  // quatre-vingt(s)[-dix...] -> 80..99
  if (word === "quatre" && (peek(cursor, 1) === "vingt" || peek(cursor, 1) === "vingts")) {
    cursor.index += 2;
    return 80 + takeSixtyOrEightyTail(cursor);
  }

  const dix = takeDixCompound(cursor);
  if (dix !== null) return dix;

  cursor.index += 1;
  if (current?.kind !== "tens") return current?.value ?? 0;
  if (current.value === 60) return 60 + takeSixtyOrEightyTail(cursor);
  return current.value + takeTensTail(cursor);
}

/**
 * Parses a run of words that are all number words (or the joiner "et") into
 * the sequence of numbers they spell. "zero six douze trente quatre" ->
 * [0, 6, 12, 34].
 */
export function parseNumberWords(words: string[]): ParsedNumber[] {
  const cursor: Cursor = { words, index: 0 };
  const numbers: ParsedNumber[] = [];

  while (cursor.index < words.length) {
    if (peek(cursor) === "et") {
      cursor.index += 1;
      continue;
    }
    const firstWord = cursor.index;
    const value = parseOne(cursor);
    numbers.push({ value, firstWord, lastWord: cursor.index - 1 });
  }
  return numbers;
}
