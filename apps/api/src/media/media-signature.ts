/**
 * Real file-signature (magic bytes) verification — detects a file disguised
 * as a different MIME type (PHASE_4_PLAN.md "Scan" step). Hand-rolled rather
 * than a dependency: the set of formats is small and fixed
 * (`@fixiyi/contracts`' `MEDIA_KIND_BY_CONTENT_TYPE`), unlike image
 * dimension parsing (see `media-metadata.ts`, which does use a library —
 * getting JPEG segment scanning right by hand is a real risk of subtle
 * bugs, this is not). Not an antivirus scan — no such service is
 * provisioned in this environment (documented limitation).
 */

/** Longest prefix any signature below needs to inspect. */
export const SIGNATURE_PREFIX_BYTES = 16;

export function matchesSignature(bytes: Buffer, contentType: string): boolean {
  switch (contentType) {
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "image/webp":
      return startsWith(bytes, ascii("RIFF")) && sliceMatches(bytes, 8, ascii("WEBP"));
    case "video/mp4":
      return sliceMatches(bytes, 4, ascii("ftyp"));
    case "video/webm":
      return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/mpeg":
      return startsWith(bytes, ascii("ID3")) || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0);
    case "audio/wav":
      return startsWith(bytes, ascii("RIFF")) && sliceMatches(bytes, 8, ascii("WAVE"));
    case "audio/ogg":
      return startsWith(bytes, ascii("OggS"));
    default:
      return false;
  }
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.codePointAt(0) ?? 0);
}

function startsWith(bytes: Buffer, prefix: number[]): boolean {
  return prefix.every((expected, index) => bytes[index] === expected);
}

function sliceMatches(bytes: Buffer, offset: number, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}
