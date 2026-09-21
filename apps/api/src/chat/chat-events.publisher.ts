import { CHAT_SERVER_EVENTS, type Message, type ReceiptsEvent, type TypingEvent } from "@fixiyi/contracts";
import { Injectable, Logger } from "@nestjs/common";
import type { Server } from "socket.io";

/** One room per user, joined on connect. The server alone decides who is in which conversation. */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export interface Addressed<T> {
  userId: string;
  payload: T;
}

/**
 * Pushes notifications to connected clients — and nothing else.
 *
 * Called only AFTER the database write succeeded (01_SPEC_PRODUCT.md #49:
 * the socket is never the source of truth). A failed or missed push loses
 * nothing: the data is already stored, and a client catches up with
 * `GET .../messages?after=<seq>` when it reconnects. That is why every
 * method here is fire-and-forget and never throws into the HTTP request
 * that triggered it.
 *
 * Messages are addressed per recipient because a message is viewer-relative
 * (delivery ticks, edit/delete deadlines differ for sender and receiver).
 */
@Injectable()
export class ChatEventsPublisher {
  private readonly logger = new Logger(ChatEventsPublisher.name);
  private server: Server | null = null;

  /** Set by the gateway once Socket.IO is up. Before that (e.g. during boot) pushes are dropped, harmlessly. */
  attach(server: Server): void {
    this.server = server;
  }

  messageCreated(recipients: Addressed<Message>[]): void {
    for (const { userId, payload } of recipients) {
      this.emit(userId, CHAT_SERVER_EVENTS.messageCreated, { conversationId: payload.conversationId, message: payload });
    }
  }

  messageUpdated(recipients: Addressed<Message>[]): void {
    for (const { userId, payload } of recipients) {
      this.emit(userId, CHAT_SERVER_EVENTS.messageUpdated, { conversationId: payload.conversationId, message: payload });
    }
  }

  receiptsUpdated(userIds: string[], event: ReceiptsEvent): void {
    for (const userId of userIds) {
      this.emit(userId, CHAT_SERVER_EVENTS.receiptsUpdated, event);
    }
  }

  typing(userId: string, event: TypingEvent): void {
    this.emit(userId, CHAT_SERVER_EVENTS.typing, event);
  }

  private emit(userId: string, event: string, payload: unknown): void {
    if (!this.server) {
      return;
    }
    try {
      this.server.to(userRoom(userId)).emit(event, payload);
    } catch (error) {
      // Never let a push failure turn a stored message into a failed request.
      this.logger.warn(`Could not push ${event} to ${userId}: ${String(error)}`);
    }
  }
}
