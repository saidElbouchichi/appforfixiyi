import {
  MESSAGE_DELETE_WINDOW_SECONDS,
  MESSAGE_EDIT_WINDOW_SECONDS,
  type ChatParticipantRole,
  type Message,
  type MessageAttachment,
  type MessageDeliveryStatus,
  type ReplyPreview,
} from "@fixiyi/contracts";

import type { MediaDisplay } from "../media/media.service.js";

import { roleOf, watermarksOf } from "./conversation.service.js";
import type { ConversationEntity } from "./schemas/conversation.schema.js";
import type { MessageEntity } from "./schemas/message.schema.js";

/**
 * Builds the viewer-relative `Message` DTO. Everything that depends on WHO is
 * looking — delivery ticks, whether it can still be edited or deleted — is
 * decided here, server-side, so React only renders (03_AGENT_PROTOCOL.md #2:
 * no business logic in components).
 */

const REPLY_EXCERPT_LENGTH = 120;

export interface MessageViewContext {
  viewerId: string;
  conversation: ConversationEntity;
  attachments: Map<string, MediaDisplay>;
  replies: Map<string, MessageEntity>;
  now: Date;
}

function otherRole(role: ChatParticipantRole): ChatParticipantRole {
  return role === "CLIENT" ? "PROVIDER" : "CLIENT";
}

/** Only for the viewer's own messages: how far the OTHER side has got. */
function deliveryStatusFor(message: MessageEntity, context: MessageViewContext): MessageDeliveryStatus | null {
  if (message.senderUserId !== context.viewerId) return null;
  const role = roleOf(context.conversation, context.viewerId);
  if (!role) return null;
  const other = watermarksOf(context.conversation, otherRole(role));
  if (other.read >= message.seq) return "READ";
  if (other.delivered >= message.seq) return "DELIVERED";
  return "SENT";
}

/** The deadline for an action on one's own message, or `null` once it has passed (or it is not one's own). */
function windowEnd(message: MessageEntity, context: MessageViewContext, windowSeconds: number): string | null {
  if (message.senderUserId !== context.viewerId || message.deletedAt) return null;
  const end = new Date(message.createdAt.getTime() + windowSeconds * 1000);
  return end > context.now ? end.toISOString() : null;
}

function toAttachment(display: MediaDisplay): MessageAttachment {
  return {
    mediaId: display.mediaId,
    kind: display.kind,
    contentType: display.contentType,
    fileName: display.fileName,
    sizeBytes: display.sizeBytes,
    width: display.width,
    height: display.height,
    url: display.url,
    urlExpiresAt: display.urlExpiresAt.toISOString(),
  };
}

function replyPreviewFor(message: MessageEntity, context: MessageViewContext): ReplyPreview | null {
  if (!message.replyToMessageId) return null;
  const target = context.replies.get(message.replyToMessageId);
  if (!target) return null;
  const deleted = target.deletedAt !== null;
  return {
    id: target._id,
    senderUserId: target.senderUserId,
    // The target's STORED body — already masked if it was protected, so a reply can never resurface a contact detail.
    excerpt: deleted ? null : target.body.slice(0, REPLY_EXCERPT_LENGTH),
    deleted,
  };
}

export function toMessageView(message: MessageEntity, context: MessageViewContext): Message {
  const deleted = message.deletedAt !== null;
  return {
    id: message._id,
    conversationId: message.conversationId,
    seq: message.seq,
    senderUserId: message.senderUserId,
    clientMessageId: message.clientMessageId,
    // A deleted message keeps its row (disputes) but shows nothing to either participant.
    body: deleted ? null : message.body,
    attachments: deleted
      ? []
      : message.attachmentMediaIds.flatMap((id) => {
          const display = context.attachments.get(id);
          return display ? [toAttachment(display)] : [];
        }),
    replyTo: deleted ? null : replyPreviewFor(message, context),
    reactions: deleted ? [] : message.reactions.map(({ userId, emoji }) => ({ userId, emoji })),
    redactions: message.redactions.map(({ type }) => ({ type })),
    deliveryStatus: deliveryStatusFor(message, context),
    editableUntil: windowEnd(message, context, MESSAGE_EDIT_WINDOW_SECONDS),
    deletableUntil: windowEnd(message, context, MESSAGE_DELETE_WINDOW_SECONDS),
    version: message.version,
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}
