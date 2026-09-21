import { z } from "zod";

import { IdSchema, IsoDateTimeSchema, PhoneE164Schema } from "./common.js";
import { MediaKindSchema } from "./media.js";

/**
 * 01_SPEC_PRODUCT.md #26 (chat) and #27 (protection against going
 * off-platform). See docs/phases/PHASE_6_PLAN.md for the reasoning behind
 * every rule encoded here.
 */

/**
 * `PROTECTED` until an offer is accepted, then `UNLOCKED` (#27). Offers are
 * Phase 7, so nothing in Phase 6 performs that transition from the outside:
 * `ConversationService.unlockContact` is the one entry point, deliberately
 * not exposed over HTTP — a route a user could call would switch the
 * protection off for themselves.
 */
export const ContactPolicySchema = z.enum(["PROTECTED", "UNLOCKED"]);
export type ContactPolicy = z.infer<typeof ContactPolicySchema>;

/**
 * What the detector found. Stored on the message WITHOUT the value itself:
 * the fact of an attempt is kept for future risk scoring (Phase 10), the
 * contact detail is not — so no later read, search or export can leak it.
 *
 * `OFF_PLATFORM` is a mention of an external channel ("whatsapp", "insta")
 * with no contact detail attached. It is recorded, not masked: the word is
 * not a contact detail.
 */
export const ContactRedactionTypeSchema = z.enum(["PHONE", "EMAIL", "URL", "HANDLE", "OFF_PLATFORM"]);
export type ContactRedactionType = z.infer<typeof ContactRedactionTypeSchema>;

export const ContactRedactionSchema = z.object({ type: ContactRedactionTypeSchema });
export type ContactRedaction = z.infer<typeof ContactRedactionSchema>;

/**
 * Written in place of a masked contact detail. Language-neutral on purpose:
 * the stored text is read in fr/en/ar/ary alike (#5), so the explanation
 * belongs in each client's own language, not baked into the data.
 */
export const CONTACT_REDACTION_PLACEHOLDER = "[•••]";

/**
 * Closed list, one per user and per message. A free-form reaction would be
 * a second text channel — and the easiest way to smuggle a phone number
 * past a detector that only watches the message body.
 */
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export const ReactionEmojiSchema = z.enum(ALLOWED_REACTIONS);
export type ReactionEmoji = z.infer<typeof ReactionEmojiSchema>;

export const MESSAGE_BODY_MAX_LENGTH = 4000;
export const MESSAGE_ATTACHMENTS_MAX = 5;
/** Business rules, not deployment config (same reasoning as `auth.constants.ts`). */
export const MESSAGE_EDIT_WINDOW_SECONDS = 15 * 60;
export const MESSAGE_DELETE_WINDOW_SECONDS = 24 * 60 * 60;

/** Only ever set on the viewer's OWN messages — "did the other side get it". */
export const MessageDeliveryStatusSchema = z.enum(["SENT", "DELIVERED", "READ"]);
export type MessageDeliveryStatus = z.infer<typeof MessageDeliveryStatusSchema>;

export const ChatParticipantRoleSchema = z.enum(["CLIENT", "PROVIDER"]);
export type ChatParticipantRole = z.infer<typeof ChatParticipantRoleSchema>;

export const MessageAttachmentSchema = z.object({
  mediaId: IdSchema,
  kind: MediaKindSchema,
  contentType: z.string(),
  /** Scanned by the contact detector like a message body — a file name can carry a phone number. */
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  /** Short-lived presigned GET, issued per read to a participant only. */
  url: z.string(),
  urlExpiresAt: IsoDateTimeSchema,
});
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;

/** Resolved at read time so a deleted target reads as deleted, not as a stale snapshot. */
export const ReplyPreviewSchema = z.object({
  id: IdSchema,
  senderUserId: IdSchema,
  excerpt: z.string().nullable(),
  deleted: z.boolean(),
});
export type ReplyPreview = z.infer<typeof ReplyPreviewSchema>;

export const MessageReactionSchema = z.object({
  userId: IdSchema,
  emoji: ReactionEmojiSchema,
});
export type MessageReaction = z.infer<typeof MessageReactionSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  conversationId: IdSchema,
  /**
   * Monotonic per conversation — the catch-up cursor after a reconnect.
   * Monotonic, NOT guaranteed dense: a client must catch up with
   * `after=<last seq>`, never by hunting for gaps.
   */
  seq: z.number().int().positive(),
  senderUserId: IdSchema,
  clientMessageId: IdSchema,
  /** Already masked when protected. `null` once deleted. */
  body: z.string().nullable(),
  attachments: z.array(MessageAttachmentSchema),
  replyTo: ReplyPreviewSchema.nullable(),
  reactions: z.array(MessageReactionSchema),
  /** Non-empty tells the sender their message was masked — never silently. */
  redactions: z.array(ContactRedactionSchema),
  /** Viewer-relative; `null` on messages the viewer received. */
  deliveryStatus: MessageDeliveryStatusSchema.nullable(),
  /** Viewer-relative; `null` unless the viewer sent it and can still act on it. */
  editableUntil: IsoDateTimeSchema.nullable(),
  deletableUntil: IsoDateTimeSchema.nullable(),
  /** Bumped on every change — a client keeps the highest version it has seen (dedup of out-of-order events). */
  version: z.number().int().positive(),
  editedAt: IsoDateTimeSchema.nullable(),
  deletedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const ChatCounterpartSchema = z.object({
  userId: IdSchema,
  role: ChatParticipantRoleSchema,
  displayName: z.string(),
  /**
   * The counterpart's VERIFIED account phone — "le numero autorise" of #27.
   * `null` while the conversation is PROTECTED.
   */
  phone: PhoneE164Schema.nullable(),
});
export type ChatCounterpart = z.infer<typeof ChatCounterpartSchema>;

export const ConversationSchema = z.object({
  id: IdSchema,
  requestId: IdSchema,
  clientUserId: IdSchema,
  providerUserId: IdSchema,
  providerId: IdSchema,
  myRole: ChatParticipantRoleSchema,
  counterpart: ChatCounterpartSchema,
  contactPolicy: ContactPolicySchema,
  contactUnlockedAt: IsoDateTimeSchema.nullable(),
  /** `false` when the request was cancelled or the provider's candidacy lapsed — read-only. */
  canSend: z.boolean(),
  lastMessageSeq: z.number().int().nonnegative(),
  lastMessageAt: IsoDateTimeSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
});
export type Conversation = z.infer<typeof ConversationSchema>;

// ------------------------------------------------------------------ inputs

/**
 * A client opens a conversation with one of the providers the engine
 * contacted, so it names that provider. A provider opens the conversation
 * about a request it was dispatched to, so it names nobody.
 */
export const OpenConversationInputSchema = z.object({
  requestId: IdSchema,
  providerUserId: IdSchema.optional(),
});
export type OpenConversationInput = z.infer<typeof OpenConversationInputSchema>;

export const SendMessageInputSchema = z
  .object({
    /** Idempotency key generated by the client: resending the same one returns the same message. */
    clientMessageId: IdSchema,
    body: z.string().max(MESSAGE_BODY_MAX_LENGTH).default(""),
    attachmentMediaIds: z.array(IdSchema).max(MESSAGE_ATTACHMENTS_MAX).default([]),
    replyToMessageId: IdSchema.optional(),
  })
  .refine((input) => input.body.trim().length > 0 || input.attachmentMediaIds.length > 0, {
    message: "A message needs text or at least one attachment.",
    path: ["body"],
  });
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const EditMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(MESSAGE_BODY_MAX_LENGTH),
});
export type EditMessageInput = z.infer<typeof EditMessageInputSchema>;

export const SetReactionInputSchema = z.object({ emoji: ReactionEmojiSchema });
export type SetReactionInput = z.infer<typeof SetReactionInputSchema>;

export const MESSAGE_PAGE_DEFAULT_LIMIT = 50;
export const MESSAGE_PAGE_MAX_LIMIT = 100;

/**
 * Cursor pagination on `seq` (02_SPEC_ENGINEERING — cursor-based for
 * messages). `before` pages back through history, newest first; `after`
 * is the catch-up after a reconnect, oldest first. Never both.
 */
export const MessageListQuerySchema = z
  .object({
    before: z.coerce.number().int().positive().optional(),
    after: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_MAX_LIMIT).default(MESSAGE_PAGE_DEFAULT_LIMIT),
  })
  .refine((query) => query.before === undefined || query.after === undefined, {
    message: "Use either `before` or `after`, not both.",
    path: ["before"],
  });
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>;

export const MessagePageSchema = z.object({
  messages: z.array(MessageSchema),
  /** Whether older (for `before`) or newer (for `after`) messages remain. */
  hasMore: z.boolean(),
});
export type MessagePage = z.infer<typeof MessagePageSchema>;

/** Watermarks only move forward, so re-sending an old value is harmless (idempotent). */
export const MarkReceiptInputSchema = z.object({
  upToSeq: z.number().int().nonnegative(),
});
export type MarkReceiptInput = z.infer<typeof MarkReceiptInputSchema>;

export const MessageSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});
export type MessageSearchQuery = z.infer<typeof MessageSearchQuerySchema>;

// ---------------------------------------------------------- realtime events

/**
 * The socket only ever NOTIFIES — every mutation above goes through HTTP and
 * the database (#49: "le WebSocket n'est jamais la source de verite"). A
 * client that misses events loses nothing: it catches up with
 * `GET .../messages?after=<seq>`.
 */
export const CHAT_SERVER_EVENTS = {
  messageCreated: "message.created",
  messageUpdated: "message.updated",
  receiptsUpdated: "receipts.updated",
  typing: "typing",
} as const;

/** The only client -> server event: ephemeral, never persisted. */
export const CHAT_CLIENT_EVENTS = {
  typing: "typing",
} as const;

export const MessageEventSchema = z.object({
  conversationId: IdSchema,
  message: MessageSchema,
});
export type MessageEvent = z.infer<typeof MessageEventSchema>;

export const ReceiptsEventSchema = z.object({
  conversationId: IdSchema,
  userId: IdSchema,
  deliveredSeq: z.number().int().nonnegative(),
  readSeq: z.number().int().nonnegative(),
});
export type ReceiptsEvent = z.infer<typeof ReceiptsEventSchema>;

export const TypingInputSchema = z.object({
  conversationId: IdSchema,
  isTyping: z.boolean(),
});
export type TypingInput = z.infer<typeof TypingInputSchema>;

export const TypingEventSchema = TypingInputSchema.extend({ userId: IdSchema });
export type TypingEvent = z.infer<typeof TypingEventSchema>;
