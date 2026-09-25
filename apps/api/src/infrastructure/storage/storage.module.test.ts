import type { Env } from "@fixiyi/config";
import { describe, expect, it } from "vitest";

import { StorageModule } from "./storage.module.js";

/**
 * Decision 73. The value of this test is not that a string comparison works:
 * it is that `STORAGE_PROVIDER` refuses a value it cannot honour instead of
 * ignoring it. Ignoring it is what let `STORAGE_PROVIDER=fake` sit in
 * `.env.test.example` while a real S3 client was built anyway, and what hid
 * the missing MinIO container from CI until 2026-09-22.
 */
function moduleFor(provider: string): StorageModule {
  return new StorageModule({ STORAGE_PROVIDER: provider } as Env);
}

describe("StorageModule", () => {
  it("accepts the adapter that exists", () => {
    expect(() => {
      moduleFor("minio").onModuleInit();
    }).not.toThrow();
  });

  it("refuses a provider nobody implemented, naming it", () => {
    expect(() => {
      moduleFor("fake").onModuleInit();
    }).toThrow(/STORAGE_PROVIDER "fake"/);
  });

  it("refuses a plausible-looking one just the same — s3 is not wired either", () => {
    expect(() => {
      moduleFor("s3").onModuleInit();
    }).toThrow(/only minio is implemented/);
  });
});
