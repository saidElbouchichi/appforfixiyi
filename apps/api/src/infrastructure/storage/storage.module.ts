import type { Env } from "@fixiyi/config";
import { Inject, Module, type OnModuleInit } from "@nestjs/common";

import { ENV } from "../env.token.js";

import { StorageService } from "./storage.service.js";

/**
 * `STORAGE_PROVIDER=minio` selects the only adapter that exists. Any other
 * value fails the boot instead of being ignored — the same contract
 * `EmailModule`, `SmsModule` and `GeoModule` already honour for their own
 * providers.
 *
 * It used to be ignored entirely, which is how `STORAGE_PROVIDER=fake` in
 * `.env.test.example` read as "storage is faked here" while `StorageService`
 * went on building a real S3 client and creating a real bucket. That is what
 * hid the missing MinIO container from CI until 2026-09-22: the tests failed
 * with `ECONNREFUSED :9000` against a backend the configuration claimed was
 * not in use (Decision 73).
 */
const SUPPORTED_STORAGE_PROVIDERS = ["minio"];

@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule implements OnModuleInit {
  constructor(@Inject(ENV) private readonly env: Env) {}

  onModuleInit(): void {
    if (!SUPPORTED_STORAGE_PROVIDERS.includes(this.env.STORAGE_PROVIDER)) {
      throw new Error(
        `Unsupported STORAGE_PROVIDER "${this.env.STORAGE_PROVIDER}" — only ${SUPPORTED_STORAGE_PROVIDERS.join(", ")} is implemented.`,
      );
    }
  }
}
