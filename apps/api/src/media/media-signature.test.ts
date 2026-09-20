import { describe, expect, it } from "vitest";

import { matchesSignature } from "./media-signature.js";

describe("matchesSignature", () => {
  it("accepts a real JPEG signature", () => {
    expect(matchesSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), "image/jpeg")).toBe(true);
  });

  it("accepts a real PNG signature", () => {
    expect(matchesSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
  });

  it("accepts a real WEBP signature", () => {
    const bytes = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP", "ascii")]);
    expect(matchesSignature(bytes, "image/webp")).toBe(true);
  });

  it("accepts a real MP4 ftyp box", () => {
    const bytes = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftyp", "ascii"), Buffer.from("isom", "ascii")]);
    expect(matchesSignature(bytes, "video/mp4")).toBe(true);
  });

  it("accepts a real WEBM/EBML signature", () => {
    expect(matchesSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]), "video/webm")).toBe(true);
  });

  it("accepts an ID3-tagged MP3", () => {
    expect(matchesSignature(Buffer.from("ID3\u0003\u0000", "binary"), "audio/mpeg")).toBe(true);
  });

  it("accepts a raw MPEG frame-sync MP3", () => {
    expect(matchesSignature(Buffer.from([0xff, 0xfb, 0x90, 0x00]), "audio/mpeg")).toBe(true);
  });

  it("accepts a real WAV signature", () => {
    const bytes = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.from([0, 0, 0, 0]), Buffer.from("WAVE", "ascii")]);
    expect(matchesSignature(bytes, "audio/wav")).toBe(true);
  });

  it("accepts a real OGG signature", () => {
    expect(matchesSignature(Buffer.from("OggS", "ascii"), "audio/ogg")).toBe(true);
  });

  it("rejects a text file disguised as a JPEG", () => {
    expect(matchesSignature(Buffer.from("not actually a jpeg", "ascii"), "image/jpeg")).toBe(false);
  });

  it("rejects a PNG disguised as an MP4", () => {
    expect(matchesSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "video/mp4")).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(matchesSignature(Buffer.from([]), "image/jpeg")).toBe(false);
  });

  it("rejects an unknown content type", () => {
    expect(matchesSignature(Buffer.from([0xff, 0xd8, 0xff]), "application/x-unknown")).toBe(false);
  });
});
