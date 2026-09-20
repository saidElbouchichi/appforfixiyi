import { describe, expect, it } from "vitest";

import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  CreateTargetMediaUploadSessionInputSchema,
  CreateUploadSessionInputSchema,
  MEDIA_KIND_BY_CONTENT_TYPE,
  MEDIA_MAX_SIZE_BYTES,
} from "./media.js";

describe("MEDIA_KIND_BY_CONTENT_TYPE", () => {
  it("maps every allowed content type to a kind with a defined size ceiling", () => {
    for (const contentType of ALLOWED_MEDIA_CONTENT_TYPES) {
      const kind = MEDIA_KIND_BY_CONTENT_TYPE[contentType];
      if (!kind) {
        throw new Error(`No kind mapped for ${contentType}`);
      }
      expect(MEDIA_MAX_SIZE_BYTES[kind]).toBeGreaterThan(0);
    }
  });
});

describe("CreateUploadSessionInputSchema", () => {
  it("accepts a valid upload session request", () => {
    const result = CreateUploadSessionInputSchema.safeParse({
      targetType: "REQUEST",
      targetId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative sizeBytes", () => {
    expect(
      CreateUploadSessionInputSchema.safeParse({
        targetType: "REQUEST",
        targetId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 0,
      }).success,
    ).toBe(false);
  });
});

describe("CreateTargetMediaUploadSessionInputSchema", () => {
  it("accepts a body with no targetType/targetId — implied by the route", () => {
    const result = CreateTargetMediaUploadSessionInputSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });
});
