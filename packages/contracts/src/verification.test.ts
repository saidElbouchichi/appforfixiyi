import { describe, expect, it } from "vitest";

import {
  CreateVerificationCaseInputSchema,
  RequestDocumentUploadInputSchema,
  VerificationStatusSchema,
  VerificationTargetTypeSchema,
} from "./verification.js";

describe("VerificationStatusSchema", () => {
  it("accepts every documented state (01_SPEC_PRODUCT.md #24)", () => {
    for (const status of ["DRAFT", "IN_REVIEW", "NEEDS_CORRECTION", "VERIFIED", "REJECTED", "SUSPENDED", "EXPIRED"]) {
      expect(VerificationStatusSchema.safeParse(status).success).toBe(true);
    }
  });
});

describe("VerificationTargetTypeSchema", () => {
  it("accepts PROVIDER and COMPANY only", () => {
    expect(VerificationTargetTypeSchema.safeParse("PROVIDER").success).toBe(true);
    expect(VerificationTargetTypeSchema.safeParse("COMPANY").success).toBe(true);
    expect(VerificationTargetTypeSchema.safeParse("USER").success).toBe(false);
  });
});

describe("CreateVerificationCaseInputSchema", () => {
  it("accepts a valid PROVIDER target", () => {
    const result = CreateVerificationCaseInputSchema.safeParse({
      targetType: "PROVIDER",
      targetId: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID targetId", () => {
    expect(CreateVerificationCaseInputSchema.safeParse({ targetType: "PROVIDER", targetId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("RequestDocumentUploadInputSchema", () => {
  it("accepts a valid upload request", () => {
    expect(
      RequestDocumentUploadInputSchema.safeParse({ type: "IDENTITY", fileName: "cin.pdf", contentType: "application/pdf" }).success,
    ).toBe(true);
  });

  it("rejects an empty fileName", () => {
    expect(RequestDocumentUploadInputSchema.safeParse({ type: "IDENTITY", fileName: "", contentType: "application/pdf" }).success).toBe(
      false,
    );
  });
});
