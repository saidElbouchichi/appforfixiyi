import type { ContactPolicy } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/**
 * One conversation per (request, provider): the client of a request and one
 * provider the engine actually dispatched to (01_SPEC_PRODUCT.md #26 — "le
 * chat est lie a la demande").
 *
 * Receipts are watermarks, not per-message rows: in a two-party chat, "the
 * other side has read everything up to seq N" answers every message's
 * read state in O(1), and a watermark can only move forward, which makes
 * re-sending an old acknowledgement harmless.
 */
@Schema({ collection: "conversations", timestamps: true, versionKey: false })
export class ConversationEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  requestId!: string;

  @Prop({ type: String, required: true, index: true })
  clientUserId!: string;

  @Prop({ type: String, required: true, index: true })
  providerUserId!: string;

  @Prop({ type: String, required: true })
  providerId!: string;

  /** Only `ConversationService.unlockContact` moves this — see PHASE_6_PLAN.md. */
  @Prop({ type: String, required: true, default: "PROTECTED" })
  contactPolicy!: ContactPolicy;

  @Prop({ type: Date, default: null })
  contactUnlockedAt!: Date | null;

  /** Allocated with an atomic `$inc`: monotonic, not guaranteed dense. */
  @Prop({ type: Number, required: true, default: 0 })
  lastMessageSeq!: number;

  @Prop({ type: Date, default: null })
  lastMessageAt!: Date | null;

  @Prop({ type: Number, required: true, default: 0 })
  clientDeliveredSeq!: number;

  @Prop({ type: Number, required: true, default: 0 })
  clientReadSeq!: number;

  @Prop({ type: Number, required: true, default: 0 })
  providerDeliveredSeq!: number;

  @Prop({ type: Number, required: true, default: 0 })
  providerReadSeq!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ConversationDocument = HydratedDocument<ConversationEntity>;
export const ConversationEntitySchema = SchemaFactory.createForClass(ConversationEntity);
/** Opening a conversation twice (a double click, two tabs) must return the same one. */
ConversationEntitySchema.index({ requestId: 1, providerUserId: 1 }, { unique: true });
/** "My conversations, most recent first", for either side. */
ConversationEntitySchema.index({ clientUserId: 1, lastMessageAt: -1 });
ConversationEntitySchema.index({ providerUserId: 1, lastMessageAt: -1 });
