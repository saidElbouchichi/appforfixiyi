import {
  MESSAGE_DELETE_WINDOW_SECONDS,
  MESSAGE_EDIT_WINDOW_SECONDS,
  type ContactRedaction,
  type CreateTargetMediaUploadSessionInput,
  type CreateUploadSessionOutput,
  type EditMessageInput,
  type Media,
  type Message,
  type MessageListQuery,
  type MessagePage,
  type ReactionEmoji,
  type ReceiptsEvent,
  type SendMessageInput,
} from "@fixiyi/contracts";
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model, QueryFilter } from "mongoose";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { MediaService } from "../media/media.service.js";

import { ChatEventsPublisher, type Addressed } from "./chat-events.publisher.js";
import { ContactDetectionService } from "./contact-detection/contact-detection.service.js";
import { ConversationService, counterpartOf, type Participation } from "./conversation.service.js";
import { toMessageView } from "./message-view.js";
import { ConversationEntity } from "./schemas/conversation.schema.js";
import { MessageEntity, type MessageDocument } from "./schemas/message.schema.js";

const SEARCH_RESULT_LIMIT = 50;

export interface ConversationUploadSession extends CreateUploadSessionOutput {
  /** The file name as stored — masked if it carried a contact detail. */
  fileName: string;
  redactions: ContactRedaction[];
}

/** Regex search on user input must never be user-controlled regex (injection, ReDoS). */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface NewMessage {
  conversationId: string;
  seq: number;
  senderUserId: string;
  clientMessageId: string;
  body: string;
  attachmentMediaIds: string[];
  replyToMessageId: string | null;
  redactions: ContactRedaction[];
}

function seqCursor(query: MessageListQuery): { $gt: number } | { $lt: number } | null {
  if (query.after !== undefined) return { $gt: query.after };
  if (query.before !== undefined) return { $lt: query.before };
  return null;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(MessageEntity.name) private readonly model: Model<MessageEntity>,
    private readonly conversations: ConversationService,
    private readonly media: MediaService,
    private readonly contacts: ContactDetectionService,
    private readonly events: ChatEventsPublisher,
  ) {}

  // ------------------------------------------------------------ attachments

  /**
   * Attachment upload goes through the generic media pipeline — so it gets
   * the size signed into the presigned URL (Decision 52) for free. The file
   * name is masked BEFORE the media row exists: the stored name, and the
   * object key derived from it, never contain the contact detail.
   */
  async createAttachmentUploadSession(
    conversationId: string,
    userId: string,
    input: CreateTargetMediaUploadSessionInput,
  ): Promise<ConversationUploadSession> {
    const { conversation } = await this.conversations.requireParticipant(conversationId, userId);
    await this.conversations.assertCanSend(conversation);

    const { text: fileName, redactions } = this.contacts.protect(input.fileName, conversation.contactPolicy);
    const session = await this.media.createUploadSession(userId, { ...input, fileName, targetType: "CONVERSATION", targetId: conversationId });
    return { ...session, fileName, redactions };
  }

  /** Checks the media really belongs to THIS conversation before finalising (the gap found as B7 on requests). */
  async finalizeAttachment(conversationId: string, userId: string, mediaId: string): Promise<Media> {
    await this.conversations.requireParticipant(conversationId, userId);
    const media = await this.media.getById(mediaId, userId);
    if (media.targetType !== "CONVERSATION" || media.targetId !== conversationId) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "MEDIA_NOT_IN_CONVERSATION", "This file was not uploaded to this conversation.");
    }
    return this.media.finalize(mediaId, userId);
  }

  // ------------------------------------------------------------------ send

  async send(conversationId: string, userId: string, input: SendMessageInput): Promise<Message> {
    const participation = await this.conversations.requireParticipant(conversationId, userId);
    const { conversation } = participation;

    // Idempotency first: a retry of a message that was stored returns it,
    // even if the conversation has closed in between.
    const replay = await this.model.findOne({ conversationId, senderUserId: userId, clientMessageId: input.clientMessageId });
    if (replay) {
      return this.viewOne(replay, userId, conversation);
    }

    await this.conversations.assertCanSend(conversation);
    await this.requireReplyTarget(conversationId, input.replyToMessageId);
    await this.media.requireAttachable(input.attachmentMediaIds, userId, "CONVERSATION", conversationId);

    const { text: body, redactions } = this.contacts.protect(input.body.trim(), conversation.contactPolicy);
    const now = new Date();
    const bumped = await this.conversations.allocateSeq(conversationId, now);

    const stored = await this.insertOnce({
      conversationId,
      seq: bumped.lastMessageSeq,
      senderUserId: userId,
      clientMessageId: input.clientMessageId,
      body,
      attachmentMediaIds: [...new Set(input.attachmentMediaIds)],
      replyToMessageId: input.replyToMessageId ?? null,
      redactions,
    });

    const views = await this.viewsForBoth(stored, { ...participation, conversation: bumped });
    this.events.messageCreated(views);
    return this.viewForUser(views, userId);
  }

  // ------------------------------------------------------------------ read

  /**
   * Cursor pagination on `seq`. `after` is the reconnect catch-up (oldest
   * first); `before` pages back through history. Either way the page is
   * returned in chronological order.
   */
  async list(conversationId: string, userId: string, query: MessageListQuery): Promise<MessagePage> {
    const { conversation } = await this.conversations.requireParticipant(conversationId, userId);
    const catchingUp = query.after !== undefined;
    const seq = seqCursor(query);
    const filter: QueryFilter<MessageEntity> = seq ? { conversationId, seq } : { conversationId };

    const docs = await this.model
      .find(filter)
      .sort({ seq: catchingUp ? 1 : -1 })
      .limit(query.limit + 1);
    const hasMore = docs.length > query.limit;
    const page = docs.slice(0, query.limit);
    const chronological = catchingUp ? page : [...page].reverse();

    return { messages: await this.viewMany(chronological, userId, conversation), hasMore };
  }

  /** Searches the STORED text — already masked where protected, so a search can never resurface a contact detail. */
  async search(conversationId: string, userId: string, q: string): Promise<Message[]> {
    const { conversation } = await this.conversations.requireParticipant(conversationId, userId);
    const docs = await this.model
      .find({ conversationId, deletedAt: null, body: { $regex: escapeRegex(q), $options: "i" } })
      .sort({ seq: -1 })
      .limit(SEARCH_RESULT_LIMIT);
    return this.viewMany(docs, userId, conversation);
  }

  // --------------------------------------------------------------- mutate

  /** Sender only, within the edit window — and re-scanned, or editing would be the way around the detector. */
  async edit(conversationId: string, messageId: string, userId: string, input: EditMessageInput): Promise<Message> {
    const { participation, message } = await this.requireOwnMessage(conversationId, messageId, userId);
    this.assertWithinWindow(message, MESSAGE_EDIT_WINDOW_SECONDS, "MESSAGE_EDIT_WINDOW_CLOSED");
    await this.conversations.assertCanSend(participation.conversation);

    const { text, redactions } = this.contacts.protect(input.body, participation.conversation.contactPolicy);
    message.body = text;
    // Keep earlier detections: the attempt happened even if the edit removed it.
    message.redactions = [...message.redactions, ...redactions];
    message.editedAt = new Date();
    message.version += 1;
    await message.save();
    return this.publishUpdate(message, participation, userId);
  }

  /** Soft delete: hidden from both sides, retained for disputes (PHASE_6_PLAN.md, pending legal validation). */
  async remove(conversationId: string, messageId: string, userId: string): Promise<Message> {
    const { participation, message } = await this.requireOwnMessage(conversationId, messageId, userId);
    this.assertWithinWindow(message, MESSAGE_DELETE_WINDOW_SECONDS, "MESSAGE_DELETE_WINDOW_CLOSED");

    message.deletedAt = new Date();
    message.version += 1;
    await message.save();
    return this.publishUpdate(message, participation, userId);
  }

  /** One reaction per user per message: setting replaces, `null` removes. */
  async setReaction(conversationId: string, messageId: string, userId: string, emoji: ReactionEmoji | null): Promise<Message> {
    const participation = await this.conversations.requireParticipant(conversationId, userId);
    const message = await this.requireMessageIn(conversationId, messageId);
    if (message.deletedAt) {
      throw new DomainHttpException(HttpStatus.CONFLICT, "MESSAGE_DELETED", "This message was deleted.");
    }
    await this.conversations.assertCanSend(participation.conversation);

    const others = message.reactions.filter((reaction) => reaction.userId !== userId);
    message.reactions = emoji === null ? others : [...others, { userId, emoji }];
    message.version += 1;
    await message.save();
    return this.publishUpdate(message, participation, userId);
  }

  // -------------------------------------------------------------- receipts

  async markDelivered(conversationId: string, userId: string, upToSeq: number): Promise<ReceiptsEvent> {
    return this.advanceReceipts(conversationId, userId, { delivered: upToSeq });
  }

  async markRead(conversationId: string, userId: string, upToSeq: number): Promise<ReceiptsEvent> {
    return this.advanceReceipts(conversationId, userId, { delivered: upToSeq, read: upToSeq });
  }

  private async advanceReceipts(conversationId: string, userId: string, upTo: { delivered: number; read?: number }): Promise<ReceiptsEvent> {
    const { conversation, role } = await this.conversations.requireParticipant(conversationId, userId);
    const prefix = role === "CLIENT" ? "client" : "provider";
    const before = { delivered: conversation[`${prefix}DeliveredSeq`], read: conversation[`${prefix}ReadSeq`] };

    const updated = await this.conversations.advanceWatermarks(conversation, role, upTo);
    const event: ReceiptsEvent = {
      conversationId,
      userId,
      deliveredSeq: updated[`${prefix}DeliveredSeq`],
      readSeq: updated[`${prefix}ReadSeq`],
    };
    // Only a watermark that actually moved is news — no event storm from repeated acks.
    if (event.deliveredSeq !== before.delivered || event.readSeq !== before.read) {
      this.events.receiptsUpdated([counterpartOf(updated, role), userId], event);
    }
    return event;
  }

  // --------------------------------------------------------------- helpers

  private async insertOnce(fields: NewMessage): Promise<MessageDocument> {
    try {
      return await this.model.create(fields);
    } catch (error) {
      // Two identical sends raced past the replay check: the second loses on the unique index.
      if (!isDuplicateKeyError(error)) throw error;
      const winner = await this.model.findOne({
        conversationId: fields.conversationId,
        senderUserId: fields.senderUserId,
        clientMessageId: fields.clientMessageId,
      });
      if (!winner) throw error;
      return winner;
    }
  }

  private async requireReplyTarget(conversationId: string, replyToMessageId: string | undefined): Promise<void> {
    if (replyToMessageId === undefined) return;
    const exists = await this.model.exists({ _id: replyToMessageId, conversationId });
    if (!exists) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "REPLY_TARGET_NOT_FOUND", "You can only reply to a message of this conversation.");
    }
  }

  private async requireMessageIn(conversationId: string, messageId: string): Promise<MessageDocument> {
    const message = await this.model.findOne({ _id: messageId, conversationId });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    return message;
  }

  private async requireOwnMessage(
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<{ participation: Participation; message: MessageDocument }> {
    const participation = await this.conversations.requireParticipant(conversationId, userId);
    const message = await this.requireMessageIn(conversationId, messageId);
    if (message.senderUserId !== userId) {
      throw new ForbiddenException("Only the sender can change this message.");
    }
    if (message.deletedAt) {
      throw new DomainHttpException(HttpStatus.CONFLICT, "MESSAGE_DELETED", "This message was deleted.");
    }
    return { participation, message };
  }

  private assertWithinWindow(message: MessageEntity, windowSeconds: number, code: string): void {
    if (Date.now() - message.createdAt.getTime() > windowSeconds * 1000) {
      throw new DomainHttpException(HttpStatus.CONFLICT, code, "The time allowed for this action has passed.");
    }
  }

  private async publishUpdate(message: MessageDocument, participation: Participation, userId: string): Promise<Message> {
    const views = await this.viewsForBoth(message, participation);
    this.events.messageUpdated(views);
    return this.viewForUser(views, userId);
  }

  /** A message looks different to its sender and its receiver, so each gets their own view. */
  private async viewsForBoth(message: MessageEntity, { conversation }: Participation): Promise<Addressed<Message>[]> {
    return Promise.all(
      [conversation.clientUserId, conversation.providerUserId].map(async (userId) => ({
        userId,
        payload: await this.viewOne(message, userId, conversation),
      })),
    );
  }

  private viewForUser(views: Addressed<Message>[], userId: string): Message {
    const view = views.find((entry) => entry.userId === userId);
    if (!view) {
      throw new ForbiddenException("You are not a participant in this conversation.");
    }
    return view.payload;
  }

  private async viewOne(message: MessageEntity, viewerId: string, conversation: ConversationEntity): Promise<Message> {
    const [view] = await this.viewMany([message], viewerId, conversation);
    if (!view) {
      throw new NotFoundException("Message not found");
    }
    return view;
  }

  private async findByIds(ids: string[]): Promise<Map<string, MessageEntity>> {
    if (ids.length === 0) {
      return new Map();
    }
    const docs = await this.model.find({ _id: { $in: [...new Set(ids)] } });
    return new Map(docs.map((doc) => [doc._id, doc]));
  }

  /** Two batched lookups for a whole page — attachments and reply targets — never one per message. */
  private async viewMany(messages: MessageEntity[], viewerId: string, conversation: ConversationEntity): Promise<Message[]> {
    const replyIds = messages.flatMap((message) => (message.replyToMessageId ? [message.replyToMessageId] : []));
    const [attachments, replies] = await Promise.all([
      this.media.describeForDisplay(messages.flatMap((message) => message.attachmentMediaIds)),
      this.findByIds(replyIds),
    ]);
    const context = { viewerId, conversation, attachments, replies, now: new Date() };
    return messages.map((message) => toMessageView(message, context));
  }
}
