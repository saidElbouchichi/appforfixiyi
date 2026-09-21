import { CONTACT_REDACTION_PLACEHOLDER, type ContactRedaction, type ContactRedactionType } from "@fixiyi/contracts";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import { expandNumbers, normalizeChars, type MappedText } from "./normalize.js";

/**
 * 01_SPEC_PRODUCT.md #27 — detect numbers, emails, URLs, attempts to move
 * the conversation off-platform, and their obvious textual variants.
 *
 * Every detector returns ranges in the ORIGINAL text, so masking replaces
 * exactly what the user typed. Precision matters as much as recall: a
 * detector that masks "1500 DH" or "14h30" makes the chat unusable, which is
 * why phone candidates are confirmed by real numbering-plan validation
 * (libphonenumber) rather than by "looks like enough digits".
 */

export interface Detection {
  type: ContactRedactionType;
  /** Original-text range to mask; `null` for mentions that are recorded but not masked. */
  start: number | null;
  end: number | null;
}

/** Morocco first (#5): a bare "0612345678" is read as a Moroccan number. */
const DEFAULT_REGION = "MA";
const PHONE_MIN_DIGITS = 8;
/** E.164 caps a number at 15 digits; nothing longer can be one. */
const PHONE_MAX_DIGITS = 15;

// ------------------------------------------------------------------- phones

/**
 * Digit groups joined by short separators: "06 12 34 56 78", "06.12.34",
 * "+212 (6) 12...". `\p{Zs}` is every space separator — including the
 * no-break and narrow no-break spaces French typography puts inside
 * numbers — but never a line break, which would glue unrelated lines.
 */
const PHONE_CANDIDATE = /\+?\d(?:[\t\p{Zs}.\-/()]{0,3}\d)*/gu;

interface DigitGroup {
  digits: string;
  start: number;
  end: number;
}

function digitGroups(text: string, offset: number): DigitGroup[] {
  return [...text.matchAll(/\d+/g)].map((match) => ({
    digits: match[0],
    start: offset + match.index,
    end: offset + match.index + match[0].length,
  }));
}

function isPhoneNumber(candidate: string): boolean {
  const parsed = parsePhoneNumberFromString(candidate, DEFAULT_REGION);
  return parsed?.isValid() ?? false;
}

/**
 * Longest run of consecutive groups, starting at `from`, that forms a valid
 * number. Needed because separators can glue a phone to a neighbouring
 * number: in "300 0612345678" the whole candidate is invalid, but groups
 * [1..1] are a phone.
 */
function longestPhoneFrom(groups: DigitGroup[], from: number, plusPrefixed: boolean): number | null {
  let digits = "";
  let best: number | null = null;
  for (let to = from; to < groups.length; to += 1) {
    digits += groups[to]?.digits ?? "";
    if (digits.length > PHONE_MAX_DIGITS) break;
    const candidate = (from === 0 && plusPrefixed ? "+" : "") + digits;
    if (digits.length >= PHONE_MIN_DIGITS && isPhoneNumber(candidate)) best = to;
  }
  return best;
}

function detectPhones(mapped: MappedText): Detection[] {
  const detections: Detection[] = [];
  for (const match of mapped.text.matchAll(PHONE_CANDIDATE)) {
    const plusPrefixed = match[0].startsWith("+");
    const groups = digitGroups(match[0], match.index);

    let from = 0;
    while (from < groups.length) {
      const to = longestPhoneFrom(groups, from, plusPrefixed);
      const first = groups[from];
      const last = to === null ? undefined : groups[to];
      if (to === null || !first || !last) {
        from += 1;
        continue;
      }
      const normalizedStart = from === 0 && plusPrefixed ? match.index : first.start;
      detections.push({
        type: "PHONE",
        start: mapped.starts[normalizedStart] ?? 0,
        end: mapped.ends[last.end - 1] ?? 0,
      });
      from = to + 1;
    }
  }
  return detections;
}

// ------------------------------------------------------ emails, urls, handles

/** Common TLDs. Kept closed on purpose: an open `\.[a-z]{2,}` would read "photo.png" as a website. */
const TLDS = "com|net|org|ma|fr|io|co|me|info|biz|edu|be|ch|es|de|uk|us|ca|app|dev|live";
/** Extra TLDs only plausible for a link, never for a mail domain (shorteners, shops). */
const LINK_ONLY_TLDS = "ly|gl|shop|site|online|store|link|to|tv|xyz";
const TLD = `(?:${TLDS})`;
const AT = "(?:@|\\(at\\)|\\[at\\]|\\{at\\}|<at>|\\bat\\b|\\barobase\\b|\\barobas\\b)";
const DOT = "(?:\\.|\\(dot\\)|\\[dot\\]|\\{dot\\}|<dot>|\\bdot\\b|\\bpoint\\b)";
const MAIL_PROVIDERS = "(?:gmail|hotmail|yahoo|outlook|live|icloud|protonmail|gmx|menara)";

/**
 * Ordered, most specific first. The obfuscated forms require a COMPLETE
 * address shape — otherwise the ordinary words "at" and "point" would be
 * masked all over normal French and English sentences.
 */
const EMAIL_PATTERNS: RegExp[] = [
  /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi,
  new RegExp(`[a-z0-9._%+-]+\\s*${AT}\\s*[a-z0-9-]+(?:\\s*${DOT}\\s*[a-z0-9-]+)*\\s*${DOT}\\s*${TLD}\\b`, "gi"),
  // "ahmed123 at gmail" / "ahmed123 sur gmail" — the provider name gives it away.
  new RegExp(`[a-z0-9._%+-]*\\d[a-z0-9._%+-]*\\s*(?:${AT}|\\bsur\\b|\\bon\\b)\\s*${MAIL_PROVIDERS}\\b`, "gi"),
];

const URL_PATTERNS: RegExp[] = [
  /\bhttps?:\/\/[^\s]+/gi,
  /\bwww\.[^\s]+/gi,
  new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS}|${LINK_ONLY_TLDS})\\b(?:/[^\\s]*)?`, "gi"),
  new RegExp(`\\b[a-z0-9-]+\\s*(?:\\(dot\\)|\\[dot\\]|\\bdot\\b|\\bpoint\\b)\\s*${TLD}\\b`, "gi"),
];

/** "@ahmed_plomberie" — an @ not preceded by a word char, so never the middle of an email. */
const HANDLE_PATTERN = /(?<![\w.@])@[a-z0-9_.]{2,30}/gi;

/**
 * Mentions of an external channel. Recorded as an attempt to move off the
 * platform, NOT masked — the word is not a contact detail. Ambiguous words
 * ("signal", "wa", "imo") are left out on purpose: every false hit here is
 * noise in the future risk score.
 */
const OFF_PLATFORM_PATTERN =
  /\b(?:whats?\s?app|wh?atsap+|wtsp|telegram|instagram|insta|snapchat|facebook|messenger|viber|tiktok)\b|واتساب|واتس|تيليجرام|انستغرام|انستا|فيسبوك|سناب/giu;

function collect(text: string, patterns: RegExp[], type: ContactRedactionType): Detection[] {
  return patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({ type, start: match.index, end: match.index + match[0].length })),
  );
}

function overlaps(detection: Detection, taken: Detection[]): boolean {
  const { start, end } = detection;
  if (start === null || end === null) return false;
  return taken.some((other) => other.start !== null && other.end !== null && start < other.end && other.start < end);
}

/** Keeps a lower-priority detection only where no higher-priority one already covers the text. */
function withoutOverlaps(detections: Detection[], taken: Detection[]): Detection[] {
  const kept: Detection[] = [];
  for (const detection of detections) {
    if (!overlaps(detection, [...taken, ...kept])) kept.push(detection);
  }
  return kept;
}

/** All detections in `text`, ranges in original coordinates. */
export function detectContacts(text: string): Detection[] {
  // Same-length normalisation: offsets are the original text's offsets.
  const chars = normalizeChars(text);

  const emails = withoutOverlaps(collect(chars, EMAIL_PATTERNS, "EMAIL"), []);
  const urls = withoutOverlaps(collect(chars, URL_PATTERNS, "URL"), emails);
  const handles = withoutOverlaps(collect(chars, [HANDLE_PATTERN], "HANDLE"), [...emails, ...urls]);
  // Phones last: digits inside an address or a link are already covered.
  const phones = withoutOverlaps(detectPhones(expandNumbers(text)), [...emails, ...urls, ...handles]);

  const offPlatform: Detection[] = [...chars.matchAll(OFF_PLATFORM_PATTERN)].map(() => ({
    type: "OFF_PLATFORM",
    start: null,
    end: null,
  }));

  return [...emails, ...urls, ...handles, ...phones, ...offPlatform];
}

export interface RedactionResult {
  text: string;
  redactions: ContactRedaction[];
}

/** Masks every ranged detection, merging overlapping and touching ranges into one placeholder. */
export function redactContacts(text: string): RedactionResult {
  const detections = detectContacts(text);
  const ranges = detections
    .filter((detection): detection is Detection & { start: number; end: number } => detection.start !== null && detection.end !== null)
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start - b.start);

  const merged = ranges.reduce<{ start: number; end: number }[]>((acc, range) => {
    const previous = acc[acc.length - 1];
    if (previous && range.start <= previous.end) {
      return [...acc.slice(0, -1), { start: previous.start, end: Math.max(previous.end, range.end) }];
    }
    return [...acc, range];
  }, []);

  let masked = text;
  for (const range of [...merged].reverse()) {
    masked = masked.slice(0, range.start) + CONTACT_REDACTION_PLACEHOLDER + masked.slice(range.end);
  }
  return { text: masked, redactions: detections.map(({ type }) => ({ type })) };
}
