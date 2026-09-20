import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { SeedLockEntity } from "./seed-lock.schema.js";

const POLL_INTERVAL_MS = 100;
const MAX_WAIT_MS = 30_000;

/**
 * Runs a one-time idempotent seed exactly once across however many app
 * instances boot concurrently against the same (initially empty) database.
 *
 * A plain "check if empty, then insert" is a check-then-act race: several
 * instances (or, in tests, several `Test.createTestingModule()` boots
 * against the same real MongoDB) starting at the same time can all pass an
 * "is it empty?" check before any of them finishes inserting — a real bug
 * found via the e2e suite booting three separate Nest apps concurrently.
 * `create()` on a unique `_id` is atomic at the database level, so exactly
 * one caller ever wins the race and runs `seed()`; every other caller
 * *waits* for the winner's `completedAt` instead of just skipping —
 * otherwise a "loser" instance could start serving requests against a
 * still-empty or partially-seeded collection.
 */
@Injectable()
export class SeedLockService {
  constructor(@InjectModel(SeedLockEntity.name) private readonly model: Model<SeedLockEntity>) {}

  async runOnce(key: string, seed: () => Promise<void>): Promise<void> {
    const acquired = await this.tryAcquire(key);
    if (acquired) {
      await seed();
      await this.model.updateOne({ _id: key }, { $set: { completedAt: new Date() } });
      return;
    }
    await this.waitForCompletion(key);
  }

  private async tryAcquire(key: string): Promise<boolean> {
    try {
      await this.model.create({ _id: key, completedAt: null });
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }

  private async waitForCompletion(key: string): Promise<void> {
    const deadline = Date.now() + MAX_WAIT_MS;
    for (;;) {
      const lock = await this.model.findById(key);
      if (lock?.completedAt) {
        return;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for seed "${key}" to complete on another instance`);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
