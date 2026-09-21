import {
  CreateTargetMediaUploadSessionInputSchema,
  EditMessageInputSchema,
  MarkReceiptInputSchema,
  MessageListQuerySchema,
  MessageSearchQuerySchema,
  OpenConversationInputSchema,
  SendMessageInputSchema,
  SetReactionInputSchema,
  type Conversation,
  type CreateTargetMediaUploadSessionInput,
  type EditMessageInput,
  type MarkReceiptInput,
  type Media,
  type Message,
  type MessageListQuery,
  type MessagePage,
  type MessageSearchQuery,
  type OpenConversationInput,
  type ReceiptsEvent,
  type SendMessageInput,
  type SetReactionInput,
} from "@fixiyi/contracts";
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { RateLimit } from "../auth/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../auth/rate-limit/rate-limit.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { ConversationService } from "./conversation.service.js";
import { MessageService, type ConversationUploadSession } from "./message.service.js";

/**
 * Per-USER quotas (02_SPEC_ENGINEERING #634/#640 — "limiter les messages
 * massifs"). Keyed by user, not IP: behind a NAT many users share an IP
 * (finding B4). Generous enough for a real conversation, tight enough that
 * a script cannot flood a provider.
 */
const MINUTE = 60;
const SEND_LIMIT = { scope: "chat-send", limit: 30, windowSeconds: MINUTE, key: "user" } as const;
const CHANGE_LIMIT = { scope: "chat-change", limit: 60, windowSeconds: MINUTE, key: "user" } as const;
const OPEN_LIMIT = { scope: "chat-open", limit: 20, windowSeconds: MINUTE, key: "user" } as const;
const SEARCH_LIMIT = { scope: "chat-search", limit: 30, windowSeconds: MINUTE, key: "user" } as const;
const UPLOAD_LIMIT = { scope: "chat-upload", limit: 20, windowSeconds: MINUTE, key: "user" } as const;

/**
 * Every write the chat accepts lives here, on HTTP — same guards, same Zod
 * validation, same Problem Details errors as the rest of the API. The socket
 * only announces what these routes stored (01_SPEC_PRODUCT.md #49).
 *
 * Deliberately absent: any route that unlocks contact details. That happens
 * only when an offer is accepted (Phase 7), via
 * `ConversationService.unlockContact`.
 */
@ApiTags("chat")
@Controller("conversations")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
  ) {}

  @Post()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(OPEN_LIMIT)
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(OpenConversationInputSchema)) body: OpenConversationInput,
  ): Promise<Conversation> {
    return this.conversations.open(user.id, body);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<Conversation[]> {
    return this.conversations.listMine(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<Conversation> {
    return this.conversations.getForParticipant(id, user.id);
  }

  @Get(":id/messages")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(MessageListQuerySchema)) query: MessageListQuery,
  ): Promise<MessagePage> {
    return this.messages.list(id, user.id, query);
  }

  @Get(":id/messages/search")
  @UseGuards(RateLimitGuard)
  @RateLimit(SEARCH_LIMIT)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(MessageSearchQuerySchema)) query: MessageSearchQuery,
  ): Promise<Message[]> {
    return this.messages.search(id, user.id, query.q);
  }

  @Post(":id/messages")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(SEND_LIMIT)
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SendMessageInputSchema)) body: SendMessageInput,
  ): Promise<Message> {
    return this.messages.send(id, user.id, body);
  }

  @Patch(":id/messages/:messageId")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(CHANGE_LIMIT)
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body(new ZodValidationPipe(EditMessageInputSchema)) body: EditMessageInput,
  ): Promise<Message> {
    return this.messages.edit(id, messageId, user.id, body);
  }

  @Delete(":id/messages/:messageId")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(CHANGE_LIMIT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("messageId") messageId: string): Promise<Message> {
    return this.messages.remove(id, messageId, user.id);
  }

  @Put(":id/messages/:messageId/reaction")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(CHANGE_LIMIT)
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body(new ZodValidationPipe(SetReactionInputSchema)) body: SetReactionInput,
  ): Promise<Message> {
    return this.messages.setReaction(id, messageId, user.id, body.emoji);
  }

  @Delete(":id/messages/:messageId/reaction")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(CHANGE_LIMIT)
  unreact(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("messageId") messageId: string): Promise<Message> {
    return this.messages.setReaction(id, messageId, user.id, null);
  }

  @Post(":id/receipts/delivered")
  @UseGuards(CsrfGuard)
  delivered(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(MarkReceiptInputSchema)) body: MarkReceiptInput,
  ): Promise<ReceiptsEvent> {
    return this.messages.markDelivered(id, user.id, body.upToSeq);
  }

  @Post(":id/receipts/read")
  @UseGuards(CsrfGuard)
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(MarkReceiptInputSchema)) body: MarkReceiptInput,
  ): Promise<ReceiptsEvent> {
    return this.messages.markRead(id, user.id, body.upToSeq);
  }

  @Post(":id/attachments")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(UPLOAD_LIMIT)
  createAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateTargetMediaUploadSessionInputSchema)) body: CreateTargetMediaUploadSessionInput,
  ): Promise<ConversationUploadSession> {
    return this.messages.createAttachmentUploadSession(id, user.id, body);
  }

  @Post(":id/attachments/:mediaId/finalize")
  @UseGuards(CsrfGuard)
  finalizeAttachment(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("mediaId") mediaId: string): Promise<Media> {
    return this.messages.finalizeAttachment(id, user.id, mediaId);
  }
}
