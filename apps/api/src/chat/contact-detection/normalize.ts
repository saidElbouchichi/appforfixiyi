import { lookupNumberWord, parseNumberWords } from "./number-words.js";

/**
 * Normalisation that REMEMBERS where every normalised character came from.
 *
 * Detection has to run on a normalised text ("zero six" -> "0 6", "٠٦" ->
 * "06"), but masking has to happen on the ORIGINAL text the user typed. So
 * every normalised character carries the [start, end) range of the original
 * characters it stands for; a detection in normalised coordinates maps back
 * to exactly what must be masked.
 */
export interface MappedText {
  text: string;
  /** For each normalised char k: original range [starts[k], ends[k]). */
  starts: number[];
  ends: number[];
}

/**
 * One-to-one character substitutions (same length, so offsets are
 * unchanged): Arabic-Indic and Persian digits, full-width digits and "@" / ".".
 * A Moroccan user writing in Arabic may type "٠٦١٢٣٤٥٦٧٨" — a detector that
 * only knows 0-9 would wave it through.
 */
export function normalizeChars(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (code >= 0xff10 && code <= 0xff19) out += String(code - 0xff10);
    else if (code === 0xff20) out += "@";
    else if (code === 0xff0e) out += ".";
    else out += char;
  }
  return out;
}

/** Letters people substitute for digits: "O6 12 34 56 78", "06l2345678". */
const DIGIT_LOOKALIKES: Record<string, string> = { o: "0", O: "0", l: "1", I: "1", i: "1" };
const LOOKALIKE_CHAR = /[oOlIi]/g;
const DIGITS_AND_LOOKALIKES_ONLY = /^[\doOlIi]+$/;
const LOOKALIKE_MIN_DIGITS = 4;

/**
 * A token that is mostly digits with a few look-alike letters is a number in
 * disguise. The 4-digit floor keeps ordinary words ("lion", "oil") out: they
 * contain no digits at all.
 */
function unmaskLookalikes(token: string): string {
  const digitCount = (token.match(/\d/g) ?? []).length;
  if (digitCount < LOOKALIKE_MIN_DIGITS || !DIGITS_AND_LOOKALIKES_ONLY.test(token)) return token;
  // One ASCII letter -> one ASCII digit: same length, so the offset map stays aligned.
  return token.replace(LOOKALIKE_CHAR, (char) => DIGIT_LOOKALIKES[char] ?? char);
}

interface Token {
  text: string;
  start: number;
  end: number;
  isWord: boolean;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu)) {
    const start = match.index;
    tokens.push({ text: match[0], start, end: start + match[0].length, isWord: /[\p{L}\p{N}]/u.test(match[0]) });
  }
  return tokens;
}

/** A space or hyphen may sit between the words of one spelled number ("trente-quatre", "vingt et un"). */
function isWordJoiner(token: Token): boolean {
  return !token.isWord && /^[\s-]$/.test(token.text);
}

function isNumberWordOrJoiner(token: Token): boolean {
  return token.isWord && (lookupNumberWord(token.text) !== null || token.text.toLowerCase() === "et");
}

/**
 * Indexed by UTF-16 code unit, NOT by code point: regex match indices are in
 * code units, so the map must be too. Iterating code points here would let a
 * single emoji earlier in the message shift every later offset by one — and
 * mask the wrong characters.
 */
class MappedBuilder {
  readonly mapped: MappedText = { text: "", starts: [], ends: [] };

  /** Every code unit of `chars` stands for the whole original range [start, end). */
  pushSpanning(chars: string, start: number, end: number): void {
    this.mapped.text += chars;
    this.mapped.starts.push(...Array.from({ length: chars.length }, () => start));
    this.mapped.ends.push(...Array.from({ length: chars.length }, () => end));
  }

  /** `chars` has the same length as the original slice at `start`: map each unit to its own position. */
  pushAligned(chars: string, start: number): void {
    this.mapped.text += chars;
    this.mapped.starts.push(...Array.from({ length: chars.length }, (_, unit) => start + unit));
    this.mapped.ends.push(...Array.from({ length: chars.length }, (_, unit) => start + unit + 1));
  }
}

function isNumberWordOrJoinerAt(tokens: Token[], index: number): boolean {
  const token = tokens[index];
  return token !== undefined && isNumberWordOrJoiner(token);
}

/** Collects a maximal run of number words (and their joiners) starting at `index`. */
function collectNumberRun(tokens: Token[], index: number): Token[] {
  const run: Token[] = [];
  let cursor = index;
  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (!token) break;
    if (isNumberWordOrJoiner(token)) {
      run.push(token);
      cursor += 1;
    } else if (isWordJoiner(token) && isNumberWordOrJoinerAt(tokens, cursor + 1)) {
      cursor += 1; // the joiner itself is dropped; numbers are re-separated below
    } else {
      break;
    }
  }
  // A lone "et" is just the conjunction.
  return run.some((token) => token.text.toLowerCase() !== "et") ? run : [];
}

function emitNumberRun(builder: MappedBuilder, run: Token[]): void {
  const numbers = parseNumberWords(run.map((token) => token.text));
  numbers.forEach((parsed, position) => {
    const first = run[parsed.firstWord];
    const last = run[parsed.lastWord];
    if (!first || !last) return;
    if (position > 0) builder.pushSpanning(" ", first.start, first.start);
    builder.pushSpanning(String(parsed.value), first.start, last.end);
  });
}

/**
 * Char-normalised text with spelled-out numbers and look-alike digits
 * rewritten as digits, plus the map back to the original.
 */
export function expandNumbers(original: string): MappedText {
  const tokens = tokenize(normalizeChars(original));
  const builder = new MappedBuilder();

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) break;

    const run = token.isWord ? collectNumberRun(tokens, index) : [];
    if (run.length > 0) {
      emitNumberRun(builder, run);
      const lastToken = run[run.length - 1];
      index = lastToken ? tokens.indexOf(lastToken) + 1 : index + 1;
      continue;
    }

    // Same length as the source token (look-alike substitution is 1:1), so
    // each code unit maps to its own original position.
    builder.pushAligned(token.isWord ? unmaskLookalikes(token.text) : token.text, token.start);
    index += 1;
  }
  return builder.mapped;
}
