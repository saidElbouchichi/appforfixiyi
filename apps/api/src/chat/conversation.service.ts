import type { ChatParticipantRole, Conversation, OpenConversationInput } from "@fixiyi/contracts";
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { UserEntity } from "../auth/schemas/user.schema.js";
import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { candidacyKey, MatchingService, type Candidacy } from "../matching/matching.service.js";
import { ProviderService } from "../providers/provider.service.js";
import { RequestService, type RequestSummary } from "../requests/request.service.js";

import { ConversationEntity, type ConversationDocument } from "./schemas/conversation.schema.js";
import { MessageEntity } from "./schemas/message.schema.js";

export interface Participation {
  conversation: ConversationDocument;
  role: ChatParticipantRole;
}

/** The label shown for the client side: users carry no display name, and "Client" reads the same in fr and en. */
const CLIENT_DISPLAY_NAME = "Client";
const CLOSED_REQUEST_STATUSES = new Set(["CANCELLED", "EXPIRED"]);

export function roleOf(conversation: ConversationEntity, userId: string): ChatParticipantRole | null {
  if (conversation.clientUserId === userId) return "CLIENT";
  if (conversation.providerUserId === userId) return "PROVIDER";
  return null;
}

export function counterpartOf(conversation: ConversationEntity, role: ChatParticipantRole): string {
  return role === "CLIENT" ? conversation.providerUserId : conversation.clientUserId;
}

export function watermarksOf(conversation: ConversationEntity, role: ChatParticipantRole): { delivered: number; read: number } {
  return role === "CLIENT"
    ? { delivered: conversation.clientDeliveredSeq, read: conversation.clientReadSeq }
    : { delivered: conversation.providerDeliveredSeq, read: conversation.providerReadSeq };
}

/**
 * Whether a conversation still accepts new messages. A cancelled request
 * closes it. Otherwise, once contact is unlocked (an offer was accepted) it
 * stays open through the intervention; before that it lives exactly as long
 * as the provider's candidacy does — a provider who declined or lapsed is no
 * longer someone the client should be talking to about this request.
 */
function computeCanSend(conversation: ConversationEntity, request: RequestSummary | undefined, candidacy: Candidacy | undefined): boolean {
  if (!request || CLOSED_REQUEST_STATUSES.has(request.status)) return false;
  if (conversation.contactPolicy === "UNLOCKED") return true;
  return candidacy?.live ?? false;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(ConversationEntity.name) private readonly model: Model<ConversationEntity>,
    @InjectModel(MessageEntity.name) private readonly messageModel: Model<MessageEntity>,
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserEntity>,
    private readonly requests: RequestService,
    private readonly providers: ProviderService,
    private readonly matching: MatchingService,
  ) {}

  /**
   * Opens (or returns) the conversation between a request's client and one
   * provider the engine actually dispatched to. Idempotent: two clicks, two
   * tabs, or both sides opening at once all land on the same conversation.
   */
  async open(userId: string, input: OpenConversationInput): Promise<Conversation> {
    const request = (await this.requests.findSummaries([input.requestId])).get(input.requestId);
    if (!request) {
      throw new NotFoundException("Request not found");
    }
    const isClient = request.clientUserId === userId;
    const providerUserId = this.resolveProviderUserId(userId, isClient, input);

    const candidacy = await this.matching.findCandidacy(request.id, providerUserId);
    if (!candidacy) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, "CONVERSATION_NOT_DISPATCHED", "This provider was not contacted for this request.");
    }
    if (!isClient) {
      await this.matching.markCandidacyViewed(candidacy.candidateId);
    }

    const existing = await this.model.findOne({ requestId: request.id, providerUserId });
    if (existing) {
      return this.viewFor(existing, userId);
    }
    if (CLOSED_REQUEST_STATUSES.has(request.status) || !candidacy.live) {
      throw new DomainHttpException(HttpStatus.CONFLICT, "CONVERSATION_CLOSED", "This request or dispatch is no longer open.");
    }

    const created = await this.createOnce(request, providerUserId, candidacy);
    return this.viewFor(created, userId);
  }

  async listMine(userId: string): Promise<Conversation[]> {
    const docs = await this.model
      .find({ $or: [{ clientUserId: userId }, { providerUserId: userId }] })
      .sort({ lastMessageAt: -1, createdAt: -1 });
    return this.toViews(docs, userId);
  }

  async getForParticipant(conversationId: string, userId: string): Promise<Conversation> {
    const { conversation } = await this.requireParticipant(conversationId, userId);
    return this.viewFor(conversation, userId);
  }

  async requireParticipant(conversationId: string, userId: string): Promise<Participation> {
    const conversation = await this.model.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    const role = roleOf(conversation, userId);
    if (!role) {
      throw new ForbiddenException("You are not a participant in this conversation.");
    }
    return { conversation, role };
  }

  async assertCanSend(conversation: ConversationDocument): Promise<void> {
    const [requests, candidacy] = await Promise.all([
      this.requests.findSummaries([conversation.requestId]),
      this.matching.findCandidacy(conversation.requestId, conversation.providerUserId),
    ]);
    if (!computeCanSend(conversation, requests.get(conversation.requestId), candidacy ?? undefined)) {
      throw new DomainHttpException(HttpStatus.CONFLICT, "CONVERSATION_CLOSED", "This conversation no longer accepts messages.");
    }
  }

  /**
   * The ONLY way contact details become visible (01_SPEC_PRODUCT.md #27).
   * Called when an offer is accepted — Phase 7's `OfferAccepted`. Never
   * exposed over HTTP: a route a user could call would let a provider switch
   * the protection off for themselves.
   *
   * Creates the conversation if the parties never chatted before the offer:
   * after acceptance they need a channel whether or not they used one before.
   * Idempotent: unlocking twice keeps the first unlock time.
   */
  async unlockContact(requestId: string, providerUserId: string): Promise<ConversationDocument> {
    const request = (await this.requests.findSummaries([requestId])).get(requestId);
    const candidacy = await this.matching.findCandidacy(requestId, providerUserId);
    if (!request || !candidacy) {
      throw new NotFoundException("No dispatch of this provider on this request.");
    }
    const conversation = (await this.model.findOne({ requestId, providerUserId })) ?? (await this.createOnce(request, providerUserId, candidacy));
    const unlocked = await this.model.findOneAndUpdate(
      { _id: conversation._id, contactPolicy: "PROTECTED" },
      { $set: { contactPolicy: "UNLOCKED", contactUnlockedAt: new Date() } },
      { new: true },
    );
    return unlocked ?? conversation;
  }

  /**
   * Reserves the next seq and stamps the activity time in one atomic update,
   * so two concurrent sends can never be given the same number.
   */
  async allocateSeq(conversationId: string, at: Date): Promise<ConversationDocument> {
    const updated = await this.model.findOneAndUpdate(
      { _id: conversationId },
      { $inc: { lastMessageSeq: 1 }, $set: { lastMessageAt: at } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException("Conversation not found");
    }
    return updated;
  }

  /**
   * Moves a participant's receipt watermarks forward — never back (`$max`),
   * so an out-of-order or repeated acknowledgement is harmless. Clamped to
   * the last allocated seq: nobody can acknowledge a message that does not
   * exist yet. Reading implies having received, so `read` also lifts
   * `delivered`.
   */
  async advanceWatermarks(
    conversation: ConversationDocument,
    role: ChatParticipantRole,
    upTo: { delivered: number; read?: number },
  ): Promise<ConversationDocument> {
    const prefix = role === "CLIENT" ? "client" : "provider";
    const read = upTo.read === undefined ? undefined : Math.min(upTo.read, conversation.lastMessageSeq);
    const delivered = Math.min(Math.max(upTo.delivered, read ?? 0), conversation.lastMessageSeq);
    const update: Record<string, number> = { [`${prefix}DeliveredSeq`]: delivered };
    if (read !== undefined) {
      update[`${prefix}ReadSeq`] = read;
    }
    const updated = await this.model.findOneAndUpdate({ _id: conversation._id }, { $max: update }, { new: true });
    if (!updated) {
      throw new NotFoundException("Conversation not found");
    }
    return updated;
  }

  async viewFor(conversation: ConversationDocument, userId: string): Promise<Conversation> {
    const [view] = await this.toViews([conversation], userId);
    if (!view) {
      throw new ForbiddenException("You are not a participant in this conversation.");
    }
    return view;
  }

  private resolveProviderUserId(userId: string, isClient: boolean, input: OpenConversationInput): string {
    if (isClient) {
      if (!input.providerUserId) {
        throw new DomainHttpException(HttpStatus.BAD_REQUEST, "CONVERSATION_PROVIDER_REQUIRED", "Name the provider you want to write to.");
      }
      return input.providerUserId;
    }
    // A provider opens the conversation about its own dispatch — it cannot open one on someone else's behalf.
    if (input.providerUserId && input.providerUserId !== userId) {
      throw new ForbiddenException("A provider can only open its own conversation.");
    }
    return userId;
  }

  /** Create, or — if a concurrent open won the unique index race — return the winner's. */
  private async createOnce(request: RequestSummary, providerUserId: string, candidacy: Candidacy): Promise<ConversationDocument> {
    try {
      return await this.model.create({
        requestId: request.id,
        clientUserId: request.clientUserId,
        providerUserId,
        providerId: candidacy.providerId,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const winner = await this.model.findOne({ requestId: request.id, providerUserId });
      if (!winner) throw error;
      return winner;
    }
  }

  /** Every lookup batched: five queries for any number of conversations, never one per conversation. */
  private async toViews(conversations: ConversationDocument[], viewerId: string): Promise<Conversation[]> {
    const participations = conversations
      .map((conversation) => ({ conversation, role: roleOf(conversation, viewerId) }))
      .filter((entry): entry is Participation => entry.role !== null);
    if (participations.length === 0) {
      return [];
    }

    const [requests, profiles, users, candidacies, unread] = await Promise.all([
      this.requests.findSummaries(participations.map(({ conversation }) => conversation.requestId)),
      this.providers.findManyByIds(participations.map(({ conversation }) => conversation.providerId)),
      this.findUsers(participations.map(({ conversation, role }) => counterpartOf(conversation, role))),
      this.matching.findCandidacies(
        participations.map(({ conversation }) => ({ requestId: conversation.requestId, providerUserId: conversation.providerUserId })),
      ),
      this.countUnread(participations, viewerId),
    ]);

    return participations.map(({ conversation, role }) => {
      const counterpartId = counterpartOf(conversation, role);
      const counterpart = users.get(counterpartId);
      const unlocked = conversation.contactPolicy === "UNLOCKED";
      return {
        id: conversation._id,
        requestId: conversation.requestId,
        clientUserId: conversation.clientUserId,
        providerUserId: conversation.providerUserId,
        providerId: conversation.providerId,
        myRole: role,
        counterpart: {
          userId: counterpartId,
          role: role === "CLIENT" ? "PROVIDER" : "CLIENT",
          displayName: role === "CLIENT" ? (profiles.get(conversation.providerId)?.displayName ?? "—") : CLIENT_DISPLAY_NAME,
          // "Le numero autorise" (#27): the VERIFIED account phone, and only once unlocked.
          phone: unlocked && counterpart?.phoneVerifiedAt ? counterpart.phone : null,
        },
        contactPolicy: conversation.contactPolicy,
        contactUnlockedAt: conversation.contactUnlockedAt?.toISOString() ?? null,
        canSend: computeCanSend(
          conversation,
          requests.get(conversation.requestId),
          candidacies.get(candidacyKey(conversation.requestId, conversation.providerUserId)),
        ),
        lastMessageSeq: conversation.lastMessageSeq,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        unreadCount: unread.get(conversation._id) ?? 0,
        createdAt: conversation.createdAt.toISOString(),
      };
    });
  }

  private async findUsers(ids: string[]): Promise<Map<string, UserEntity>> {
    const docs = await this.userModel.find({ _id: { $in: [...new Set(ids)] } }).select("_id phone phoneVerifiedAt");
    return new Map(docs.map((doc) => [doc._id, doc]));
  }

  /** Messages from the other side past my read watermark — one aggregation for every conversation. */
  private async countUnread(participations: Participation[], viewerId: string): Promise<Map<string, number>> {
    const rows = await this.messageModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          $or: participations.map(({ conversation, role }) => ({
            conversationId: conversation._id,
            seq: { $gt: watermarksOf(conversation, role).read },
          })),
          senderUserId: { $ne: viewerId },
          deletedAt: null,
        },
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id, row.count]));
  }
}
