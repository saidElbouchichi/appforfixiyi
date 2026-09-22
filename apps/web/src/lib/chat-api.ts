import {
  ConversationSchema,
  CreateUploadSessionOutputSchema,
  MediaSchema,
  MessagePageSchema,
  MessageSchema,
  type Conversation,
  type Message,
  type MessagePage,
  type ReactionEmoji,
} from "@fixiyi/contracts";
import { z } from "zod";

import { apiFetch, uploadFile } from "./api-client";

/**
 * Typed calls to the chat API. Every response is parsed against its
 * contract: a server that drifts from the contract fails loudly here instead
 * of rendering half a message.
 */

const MessageListSchema = z.array(MessageSchema);
const ConversationListSchema = z.array(ConversationSchema);

/** Shared by the Messages screen and the unread badge of the navigation: one query, one source. */
export const CONVERSATIONS_KEY = ["conversations"];

function base(conversationId: string): string {
  return `/api/v1/conversations/${conversationId}`;
}

export async function openConversation(input: { requestId: string; candidateId?: string }): Promise<Conversation> {
  return ConversationSchema.parse(await apiFetch("/api/v1/conversations", { method: "POST", auth: true, body: input }));
}

export async function listConversations(): Promise<Conversation[]> {
  return ConversationListSchema.parse(await apiFetch("/api/v1/conversations", { auth: true }));
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  return ConversationSchema.parse(await apiFetch(base(conversationId), { auth: true }));
}

export async function listMessages(conversationId: string, cursor: { before?: number; after?: number } = {}): Promise<MessagePage> {
  const params = new URLSearchParams();
  if (cursor.before !== undefined) params.set("before", String(cursor.before));
  if (cursor.after !== undefined) params.set("after", String(cursor.after));
  const query = params.toString();
  return MessagePageSchema.parse(await apiFetch(`${base(conversationId)}/messages${query ? `?${query}` : ""}`, { auth: true }));
}

export async function searchMessages(conversationId: string, q: string): Promise<Message[]> {
  return MessageListSchema.parse(await apiFetch(`${base(conversationId)}/messages/search?q=${encodeURIComponent(q)}`, { auth: true }));
}

export async function sendMessage(
  conversationId: string,
  input: { clientMessageId: string; body: string; attachmentMediaIds?: string[]; replyToMessageId?: string },
): Promise<Message> {
  return MessageSchema.parse(await apiFetch(`${base(conversationId)}/messages`, { method: "POST", auth: true, body: input }));
}

export async function editMessage(conversationId: string, messageId: string, body: string): Promise<Message> {
  return MessageSchema.parse(await apiFetch(`${base(conversationId)}/messages/${messageId}`, { method: "PATCH", auth: true, body: { body } }));
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<Message> {
  return MessageSchema.parse(await apiFetch(`${base(conversationId)}/messages/${messageId}`, { method: "DELETE", auth: true }));
}

export async function setReaction(conversationId: string, messageId: string, emoji: ReactionEmoji | null): Promise<Message> {
  const path = `${base(conversationId)}/messages/${messageId}/reaction`;
  const response = emoji === null ? await apiFetch(path, { method: "DELETE", auth: true }) : await apiFetch(path, { method: "PUT", auth: true, body: { emoji } });
  return MessageSchema.parse(response);
}

export async function markRead(conversationId: string, upToSeq: number): Promise<void> {
  await apiFetch(`${base(conversationId)}/receipts/read`, { method: "POST", auth: true, body: { upToSeq } });
}

export async function markDelivered(conversationId: string, upToSeq: number): Promise<void> {
  await apiFetch(`${base(conversationId)}/receipts/delivered`, { method: "POST", auth: true, body: { upToSeq } });
}

/** Upload session -> direct PUT to storage -> finalize; returns the media id to attach. */
export async function uploadAttachment(conversationId: string, file: File): Promise<string> {
  const session = CreateUploadSessionOutputSchema.parse(
    await apiFetch(`${base(conversationId)}/attachments`, {
      method: "POST",
      auth: true,
      body: { fileName: file.name, contentType: file.type, sizeBytes: file.size },
    }),
  );
  await uploadFile(session.uploadUrl, file);
  const media = MediaSchema.parse(await apiFetch(`${base(conversationId)}/attachments/${session.mediaId}/finalize`, { method: "POST", auth: true }));
  if (media.status !== "READY") {
    throw new Error(media.rejectionReason ?? "Fichier refuse");
  }
  return media.id;
}
