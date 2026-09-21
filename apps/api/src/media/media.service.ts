import {
  MEDIA_KIND_BY_CONTENT_TYPE,
  MEDIA_MAX_SIZE_BYTES,
  type CreateUploadSessionInput,
  type CreateUploadSessionOutput,
  type Media,
  type MediaTargetType,
} from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { ForbiddenException, HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { StorageService } from "../infrastructure/storage/storage.service.js";

import { extractImageDimensions } from "./media-metadata.js";
import { matchesSignature, SIGNATURE_PREFIX_BYTES } from "./media-signature.js";
import { MediaEntity, type MediaDocument } from "./schemas/media.schema.js";

/** Enough of an image's header to reach dimension data for the formats we accept (JPEG/PNG/WEBP). */
const IMAGE_METADATA_PREFIX_BYTES = 256 * 1024;

/**
 * Generic media pipeline (PHASE_4_PLAN.md): `CreateUploadSession ->
 * SignedUpload -> ObjectStorage -> Scan -> Process -> Finalize`. Deliberately
 * knows nothing about "requests" — callers (e.g. `RequestService`) own
 * target ownership/eligibility checks and pass a `targetType`/`targetId`
 * (mirrors `VerificationService`'s `targetType`/`targetId`, Decision 28),
 * so this module stays reusable by a future target type (e.g. chat
 * attachments, Phase 6) without a breaking change.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(MediaEntity.name) private readonly model: Model<MediaEntity>,
    private readonly storage: StorageService,
  ) {}

  async createUploadSession(ownerUserId: string, input: CreateUploadSessionInput): Promise<CreateUploadSessionOutput> {
    const kind = MEDIA_KIND_BY_CONTENT_TYPE[input.contentType];
    if (!kind) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_CONTENT_TYPE_NOT_ALLOWED",
        `contentType must be one of the allowed media types.`,
      );
    }
    if (input.sizeBytes > MEDIA_MAX_SIZE_BYTES[kind]) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_SIZE_LIMIT_EXCEEDED",
        `Declared size exceeds the ${MEDIA_MAX_SIZE_BYTES[kind].toString()}-byte limit for ${kind}.`,
      );
    }

    const mediaId = generateId();
    const objectKey = `media/${input.targetType.toLowerCase()}/${input.targetId}/${mediaId}-${sanitizeFileName(input.fileName)}`;

    await this.model.create({
      _id: mediaId,
      ownerUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      kind,
      status: "PENDING_UPLOAD",
      contentType: input.contentType,
      fileName: input.fileName,
      objectKey,
      declaredSizeBytes: input.sizeBytes,
    });

    // The declared size is signed into the URL, so it now bounds the actual
    // PUT instead of being a claim only re-checked after the bytes landed.
    const presigned = await this.storage.createPresignedUploadUrl(objectKey, input.contentType, input.sizeBytes);
    return { mediaId, uploadUrl: presigned.url, objectKey, expiresInSeconds: presigned.expiresInSeconds };
  }

  async getById(mediaId: string, ownerUserId: string): Promise<Media> {
    const doc = await this.requireOwned(mediaId, ownerUserId);
    return toMedia(doc);
  }

  /** Scan -> Process -> Finalize, run as one atomic step once the client reports the PUT is done. */
  async finalize(mediaId: string, ownerUserId: string): Promise<Media> {
    const doc = await this.requireOwned(mediaId, ownerUserId);
    if (doc.status !== "PENDING_UPLOAD") {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "MEDIA_ALREADY_FINALIZED", `This media is already ${doc.status}.`);
    }

    // Scan (1/2) — the object must actually exist; never trust the client's word.
    const head = await this.storage.headObject(doc.objectKey);
    if (!head) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_NOT_UPLOADED",
        "The file has not actually been uploaded to storage yet — PUT it to the presigned URL first.",
      );
    }
    if (head.contentLength > MEDIA_MAX_SIZE_BYTES[doc.kind]) {
      return toMedia(await this.reject(doc, `Actual file size (${head.contentLength.toString()} bytes) exceeds the limit for ${doc.kind}.`));
    }

    // Scan (2/2) — real magic-byte signature check against the declared content type.
    const prefix = await this.storage.readObjectPrefix(doc.objectKey, SIGNATURE_PREFIX_BYTES);
    if (!matchesSignature(prefix, doc.contentType)) {
      return toMedia(await this.reject(doc, `File content does not match the declared type ${doc.contentType}.`));
    }

    // Process — best-effort metadata extraction, never fails the whole file.
    if (doc.kind === "IMAGE") {
      const bytes = await this.storage.readObjectPrefix(doc.objectKey, IMAGE_METADATA_PREFIX_BYTES);
      const dimensions = extractImageDimensions(bytes);
      doc.width = dimensions?.width ?? null;
      doc.height = dimensions?.height ?? null;
    }

    // Finalize
    doc.actualSizeBytes = head.contentLength;
    doc.status = "READY";
    await doc.save();
    return toMedia(doc);
  }

  /** Reusable by other modules (e.g. `RequestService` computing `ServiceRequest.mediaIds`) — only successfully-scanned media counts as "attached". */
  async listReadyIdsForTarget(targetType: MediaTargetType, targetId: string): Promise<string[]> {
    const docs = await this.model.find({ targetType, targetId, status: "READY" }).select("_id");
    return docs.map((doc) => doc._id);
  }

  /** Every status, for the owner's own view (e.g. to show a still-scanning or rejected upload) — the caller must have already checked ownership of the target. */
  async listForTarget(targetType: MediaTargetType, targetId: string): Promise<Media[]> {
    const docs = await this.model.find({ targetType, targetId }).sort({ createdAt: 1 });
    return docs.map(toMedia);
  }

  /**
   * Marks the media rejected AND removes the stored object: the bytes are
   * already in the bucket by the time a scan can fail, and nothing else would
   * ever reference or clean them. Deletion is best-effort — a storage hiccup
   * must not turn a rejection into a 500, so it is logged and swallowed. The
   * document keeps its `REJECTED` status either way, which is what the client
   * is shown.
   */
  private async reject(doc: MediaDocument, reason: string): Promise<MediaDocument> {
    doc.status = "REJECTED";
    doc.rejectionReason = reason;
    await doc.save();

    try {
      await this.storage.deleteObject(doc.objectKey);
    } catch (error) {
      this.logger.warn(`Rejected media ${doc._id} left its object behind (${doc.objectKey}): ${String(error)}`);
    }

    return doc;
  }

  private async requireOwned(mediaId: string, ownerUserId: string): Promise<MediaDocument> {
    const doc = await this.model.findById(mediaId);
    if (!doc) {
      throw new NotFoundException("Media not found");
    }
    if (doc.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("Not the owner of this media.");
    }
    return doc;
  }
}

/** Keeps the object key readable/debuggable while staying safe for an S3 key. */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

function toMedia(doc: MediaDocument): Media {
  return {
    id: doc._id,
    ownerUserId: doc.ownerUserId,
    targetType: doc.targetType,
    targetId: doc.targetId,
    kind: doc.kind,
    status: doc.status,
    contentType: doc.contentType,
    fileName: doc.fileName,
    declaredSizeBytes: doc.declaredSizeBytes,
    actualSizeBytes: doc.actualSizeBytes,
    width: doc.width,
    height: doc.height,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
