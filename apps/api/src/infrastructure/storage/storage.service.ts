import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "@fixiyi/config";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { ENV } from "../env.token.js";

const PRESIGNED_UPLOAD_TTL_SECONDS = 15 * 60;

export interface PresignedUpload {
  url: string;
  expiresInSeconds: number;
}

/**
 * S3-compatible object storage (MinIO in dev — 04_ENVIRONMENT.md). Real
 * client, real presigned URLs, real `HeadObject` existence checks — no
 * simulated upload state (03_AGENT_PROTOCOL.md #2).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  /** Signs presigned URLs against a client-reachable host — see `STORAGE_PUBLIC_ENDPOINT`'s doc comment in env-schema.ts. Signing is a local HMAC computation, not a network call, so a second client purely for this is cheap. */
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ENV) env: Env) {
    this.bucket = env.STORAGE_BUCKET;
    const credentials = { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET };
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: true, // required for MinIO (virtual-hosted-style buckets don't work against it)
      credentials,
    });
    this.publicClient = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_PUBLIC_ENDPOINT ?? env.STORAGE_ENDPOINT,
      forcePathStyle: true,
      credentials,
    });
  }

  /** Real infra provisioning belongs in IaC in production (Phase 15) — this only smooths local/dev/CI, where nothing else creates the bucket. */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created storage bucket "${this.bucket}"`);
    } catch (error) {
      if (!isBucketAlreadyOwnedError(error)) {
        throw error;
      }
    }
  }

  /**
   * When `contentLength` is given it is **signed into the URL**, so S3/MinIO
   * reject a PUT whose `Content-Length` differs from the signed value. Without
   * it the declared size was only ever a claim, re-checked at finalize — after
   * the bytes had already landed. A client could declare 1 KB and PUT
   * gigabytes; the media was marked REJECTED but the object stayed.
   *
   * Signing binds an EXACT size, not a ceiling, so it is only usable where the
   * caller knows the size up front. `MediaService` does (`sizeBytes` is part of
   * `CreateUploadSessionInput`). `VerificationService` does not — its
   * `RequestDocumentUploadInput` carries no size — so its uploads stay
   * unbounded until that contract gains one. Capping without an exact size
   * needs a POST policy (`content-length-range`), which changes the upload from
   * a PUT to a multipart form: a separate piece of work, deliberately not
   * smuggled in here. See docs/PRE_PHASE_6_REPORT.md.
   */
  async createPresignedUploadUrl(objectKey: string, contentType: string, contentLength?: number): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
      ...(contentLength === undefined ? {} : { ContentLength: contentLength }),
    });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
      // Keep content-length in the signature rather than letting the presigner
      // hoist it into the query string, where it would bind nothing.
      unhoistableHeaders: new Set(["content-length"]),
    });
    return { url, expiresInSeconds: PRESIGNED_UPLOAD_TTL_SECONDS };
  }

  /**
   * Removes an object from the bucket. Used when a media is rejected: the
   * bytes are already stored by then, and leaving them there meant every
   * rejected upload occupied the bucket permanently with nothing referencing
   * it.
   */
  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  /** Real existence check against the object store — never trust the client's word that an upload happened. */
  async objectExists(objectKey: string): Promise<boolean> {
    return (await this.headObject(objectKey)) !== null;
  }

  /** Real `HeadObject` — `null` if the object doesn't exist (never trust the client's declared size). */
  async headObject(objectKey: string): Promise<{ contentLength: number } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return { contentLength: result.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  /** Reads only the first `byteLength` bytes — enough for a magic-byte signature check without downloading the whole object. */
  async readObjectPrefix(objectKey: string, byteLength: number): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey, Range: `bytes=0-${(byteLength - 1).toString()}` }),
    );
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }
}

function isBucketAlreadyOwnedError(error: unknown): boolean {
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : undefined;
  return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists";
}
