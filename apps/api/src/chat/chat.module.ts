import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { UserEntity, UserEntitySchema } from "../auth/schemas/user.schema.js";
import { MatchingModule } from "../matching/matching.module.js";
import { MediaModule } from "../media/media.module.js";
import { ProviderModule } from "../providers/provider.module.js";
import { RequestModule } from "../requests/request.module.js";

import { ChatEventsPublisher } from "./chat-events.publisher.js";
import { ChatController } from "./chat.controller.js";
import { ChatGateway } from "./chat.gateway.js";
import { ContactDetectionService } from "./contact-detection/contact-detection.service.js";
import { ConversationService } from "./conversation.service.js";
import { MessageService } from "./message.service.js";
import { ConversationEntity, ConversationEntitySchema } from "./schemas/conversation.schema.js";
import { MessageEntity, MessageEntitySchema } from "./schemas/message.schema.js";

/**
 * Phase 6 — Chat (01_SPEC_PRODUCT.md #26, #27, #49, #50).
 *
 * `ConversationService` is exported for one caller to come: offer acceptance
 * (Phase 7) calls `unlockContact`. Nothing else outside this module should
 * reach into a conversation.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationEntity.name, schema: ConversationEntitySchema },
      { name: MessageEntity.name, schema: MessageEntitySchema },
      // Read-only: the counterpart's verified phone, shown once contact is unlocked (same precedent as CompanyModule).
      { name: UserEntity.name, schema: UserEntitySchema },
    ]),
    AuthModule,
    RequestModule,
    ProviderModule,
    MatchingModule,
    MediaModule,
  ],
  controllers: [ChatController],
  providers: [ContactDetectionService, ConversationService, MessageService, ChatEventsPublisher, ChatGateway],
  exports: [ConversationService],
})
export class ChatModule {}
