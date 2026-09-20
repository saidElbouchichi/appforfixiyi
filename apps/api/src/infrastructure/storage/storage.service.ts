import { CreateBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  private readonly bucket: string;

  constructor(@Inject(ENV) env: Env) {
    this.bucket = env.STORAGE_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: true, // required for MinIO (virtual-hosted-style buckets don't work against it)
      credentials: { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET },
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

  async createPresignedUploadUrl(objectKey: string, contentType: string): Promise<PresignedUpload> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, ContentType: contentType });
    const url = await getSignedUrl(this.client, command, { expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS });
    return { url, expiresInSeconds: PRESIGNED_UPLOAD_TTL_SECONDS };
  }

  /** Real existence check against the object store — never trust the client's word that an upload happened. */
  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return true;
    } catch {
      return false;
    }
  }
}

function isBucketAlreadyOwnedError(error: unknown): boolean {
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : undefined;
  return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists";
}
