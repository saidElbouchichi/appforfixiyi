import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** One document per one-time seed key — see `SeedLockService.runOnce`. */
@Schema({ collection: "seed_locks", timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class SeedLockEntity {
  @Prop({ type: String })
  _id!: string;

  /** Set once the winner's seed function has actually finished — losers wait for this, not just for the lock doc to exist. */
  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  createdAt!: Date;
}

export type SeedLockDocument = HydratedDocument<SeedLockEntity>;
export const SeedLockEntitySchema = SchemaFactory.createForClass(SeedLockEntity);
