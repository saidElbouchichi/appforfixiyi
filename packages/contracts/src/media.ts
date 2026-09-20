import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

/**
 * 01_SPEC_PRODUCT.md #10 — a request may carry photo(s), video, audio.
 * Generic pipeline (02_SPEC_ENGINEERING.md #124):
 * `CreateUploadSession -> SignedUpload -> ObjectStorage -> Scan -> Process
 * -> Finalize` — see `apps/api/src/media/` and PHASE_4_PLAN.md.
 *
 * `targetType`/`targetId` mirrors `verification.ts`'s
 * `VerificationTargetType`/`targetId` (Decision 28) — a generic
 * "what is this attached to" pair rather than a `requestId`-only field, so
 * a later phase (e.g. chat attachments, Phase 6) can add a new target type
 * without a breaking contract change. Only `REQUEST` exists today.
 */
export const MediaTargetTypeSchema = z.enum(["REQUEST"]);
export type MediaTargetType = z.infer<typeof MediaTargetTypeSchema>;

export const MediaKindSchema = z.enum(["IMAGE", "VIDEO", "AUDIO"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaStatusSchema = z.enum(["PENDING_UPLOAD", "READY", "REJECTED"]);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

/**
 * Whitelist of accepted content types -> kind, shared between the server
 * (enforcement) and any client (file-picker `accept` attribute / early
 * feedback before even requesting an upload session). The server
 * additionally verifies the real file signature at Scan time — this map
 * only governs what a client is allowed to *declare*.
 */
export const MEDIA_KIND_BY_CONTENT_TYPE: Record<string, MediaKind> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "audio/mpeg": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/ogg": "AUDIO",
};
export const ALLOWED_MEDIA_CONTENT_TYPES = Object.keys(MEDIA_KIND_BY_CONTENT_TYPE);

/** Per-kind ceiling — real limits, enforced at CreateUploadSession, not decorative. */
export const MEDIA_MAX_SIZE_BYTES: Record<MediaKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
  AUDIO: 50 * 1024 * 1024,
};

export const MediaSchema = z.object({
  id: IdSchema,
  ownerUserId: IdSchema,
  targetType: MediaTargetTypeSchema,
  targetId: IdSchema,
  kind: MediaKindSchema,
  status: MediaStatusSchema,
  contentType: z.string(),
  fileName: z.string(),
  /** Declared by the client at CreateUploadSession — always known. */
  declaredSizeBytes: z.number().int().positive(),
  /** Known only from Scan onward (real `HeadObject`) — `null` while `PENDING_UPLOAD`. */
  actualSizeBytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Media = z.infer<typeof MediaSchema>;

export const CreateUploadSessionInputSchema = z.object({
  targetType: MediaTargetTypeSchema,
  targetId: IdSchema,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});
export type CreateUploadSessionInput = z.infer<typeof CreateUploadSessionInputSchema>;

/** What a caller nested under a known target (e.g. `POST /requests/:id/media`) actually needs to send — the route itself implies `targetType`/`targetId`. */
export const CreateTargetMediaUploadSessionInputSchema = CreateUploadSessionInputSchema.omit({ targetType: true, targetId: true });
export type CreateTargetMediaUploadSessionInput = z.infer<typeof CreateTargetMediaUploadSessionInputSchema>;

export const CreateUploadSessionOutputSchema = z.object({
  mediaId: IdSchema,
  uploadUrl: z.string(),
  objectKey: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type CreateUploadSessionOutput = z.infer<typeof CreateUploadSessionOutputSchema>;
