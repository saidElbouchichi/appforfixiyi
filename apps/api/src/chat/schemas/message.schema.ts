import type { ContactRedactionType, ReactionEmoji } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false, versionKey: false })
export class MessageReactionSubdocument {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  emoji!: ReactionEmoji;
}
const MessageReactionSchema = SchemaFactory.createForClass(MessageReactionSubdocument);

@Schema({ _id: false, versionKey: false })
export class MessageRedactionSubdocument {
  @Prop({ type: String, required: true })
  type!: ContactRedactionType;
}
const MessageRedactionSchema = SchemaFactory.createForClass(MessageRedactionSubdocument);

/**
 * `body` is stored ALREADY MASKED while the conversation is protected. The
 * original contact detail is never written anywhere, which is the only way
 * to guarantee no later read, search, export or bug can leak it. What is
 * kept is the fact of the attempt (`redactions`, types only).
 *
 * Deletion is soft: `deletedAt` hides the content from both participants,
 * but the row is retained for disputes (a dispute "contains the relevant
 * chat", 02_SPEC_ENGINEERING). That retention is a legal choice flagged for
 * human validation in PHASE_6_PLAN.md; retaining is the reversible default.
 */
@Schema({ collection: "messages", timestamps: true, versionKey: false })
export class MessageEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true })
  conversationId!: string;

  @Prop({ type: Number, required: true })
  seq!: number;

  @Prop({ type: String, required: true })
  senderUserId!: string;

  @Prop({ type: String, required: true })
  clientMessageId!: string;

  @Prop({ type: String, default: "" })
  body!: string;

  @Prop({ type: [String], default: [] })
  attachmentMediaIds!: string[];

  @Prop({ type: String, default: null })
  replyToMessageId!: string | null;

  @Prop({ type: [MessageReactionSchema], default: [] })
  reactions!: MessageReactionSubdocument[];

  @Prop({ type: [MessageRedactionSchema], default: [] })
  redactions!: MessageRedactionSubdocument[];

  /** Bumped on every change, so a client can drop a stale, out-of-order event. */
  @Prop({ type: Number, required: true, default: 1 })
  version!: number;

  @Prop({ type: Date, default: null })
  editedAt!: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MessageDocument = HydratedDocument<MessageEntity>;
export const MessageEntitySchema = SchemaFactory.createForClass(MessageEntity);
/** The cursor of every page and every catch-up — and a hard guarantee that two messages never share a seq. */
MessageEntitySchema.index({ conversationId: 1, seq: 1 }, { unique: true });
/** Idempotency: the same client-generated id from the same sender is the same message. */
MessageEntitySchema.index({ conversationId: 1, senderUserId: 1, clientMessageId: 1 }, { unique: true });
