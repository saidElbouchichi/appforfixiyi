import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

/** A VerificationCase targets either an individual provider profile or a company — same state machine for both (see Decision). */
export const VerificationTargetTypeSchema = z.enum(["PROVIDER", "COMPANY"]);
export type VerificationTargetType = z.infer<typeof VerificationTargetTypeSchema>;

/** 01_SPEC_PRODUCT.md #24 — verification states. */
export const VerificationStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "NEEDS_CORRECTION",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const VerificationDocumentTypeSchema = z.enum([
  "IDENTITY",
  "PROOF_OF_ADDRESS",
  "PROFESSIONAL_CERTIFICATE",
  "COMPANY_REGISTRATION",
  "OTHER",
]);
export type VerificationDocumentType = z.infer<typeof VerificationDocumentTypeSchema>;

export const VerificationDocumentStatusSchema = z.enum(["PENDING_UPLOAD", "UPLOADED"]);
export type VerificationDocumentStatus = z.infer<typeof VerificationDocumentStatusSchema>;

export const VerificationDecisionOutcomeSchema = z.enum(["APPROVED", "REJECTED", "CORRECTION_REQUESTED", "SUSPENDED"]);
export type VerificationDecisionOutcome = z.infer<typeof VerificationDecisionOutcomeSchema>;

export const VerificationCaseSchema = z.object({
  id: IdSchema,
  targetType: VerificationTargetTypeSchema,
  targetId: IdSchema,
  status: VerificationStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type VerificationCase = z.infer<typeof VerificationCaseSchema>;

export const CreateVerificationCaseInputSchema = z.object({
  targetType: VerificationTargetTypeSchema,
  targetId: IdSchema,
});
export type CreateVerificationCaseInput = z.infer<typeof CreateVerificationCaseInputSchema>;

export const VerificationDocumentSchema = z.object({
  id: IdSchema,
  caseId: IdSchema,
  type: VerificationDocumentTypeSchema,
  status: VerificationDocumentStatusSchema,
  objectKey: z.string(),
  createdAt: IsoDateTimeSchema,
});
export type VerificationDocument = z.infer<typeof VerificationDocumentSchema>;

/** 01_SPEC_PRODUCT.md #24 — "chaque decision doit etre historisee": append-only, never overwritten. */
export const VerificationDecisionSchema = z.object({
  id: IdSchema,
  caseId: IdSchema,
  decidedByUserId: IdSchema,
  outcome: VerificationDecisionOutcomeSchema,
  reason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type VerificationDecision = z.infer<typeof VerificationDecisionSchema>;

export const RequestDocumentUploadInputSchema = z.object({
  type: VerificationDocumentTypeSchema,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
});
export type RequestDocumentUploadInput = z.infer<typeof RequestDocumentUploadInputSchema>;

export const RequestDocumentUploadOutputSchema = z.object({
  documentId: IdSchema,
  uploadUrl: z.string(),
  objectKey: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type RequestDocumentUploadOutput = z.infer<typeof RequestDocumentUploadOutputSchema>;

export const SubmitVerificationDecisionInputSchema = z.object({
  outcome: VerificationDecisionOutcomeSchema,
  reason: z.string().max(2000).nullable().optional(),
});
export type SubmitVerificationDecisionInput = z.infer<typeof SubmitVerificationDecisionInputSchema>;
