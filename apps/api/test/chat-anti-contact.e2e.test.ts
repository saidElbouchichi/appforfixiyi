import "reflect-metadata";
import "./setup-env.js";

import {
  CONTACT_REDACTION_PLACEHOLDER as MASK,
  ConversationSchema,
  CreateUploadSessionOutputSchema,
  MessagePageSchema,
  MessageSchema,
  ProblemDetailsSchema,
  ProviderMatchSchema,
} from "@fixiyi/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConversationService } from "../src/chat/conversation.service.js";
import { MessageEntity } from "../src/chat/schemas/message.schema.js";
import { MediaEntity } from "../src/media/schemas/media.schema.js";

import { ChatHarness, type Dispatch } from "./chat-test-harness.js";

/**
 * PHASE 6 EXIT CRITERION (docs/IMPLEMENTATION_PLAN.md): "tests prouvant qu'un
 * numero de telephone est bloque/masque avant acceptation et visible apres".
 *
 * Checked at three levels, because each can fail independently: what the
 * API returns, what the other participant reads, and what is physically
 * written to MongoDB — a mask applied only on the way out would still leave
 * the number in the database for any later bug to leak.
 */
describe("Chat — access and anti-contact (e2e)", () => {
  const harness = new ChatHarness();
  const PHONE_TYPED = "06 12 34 56 78";

  beforeAll(async () => {
    await harness.start();
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  async function openAsProvider(dispatch: Dispatch): Promise<string> {
    const opened = await harness.openConversation(dispatch.provider, { requestId: dispatch.client.requestId });
    expect(opened.status).toBe(201);
    return ConversationSchema.parse(opened.body).id;
  }

  async function readAs(party: { token: string }, conversationId: string): Promise<ReturnType<typeof MessagePageSchema.parse>> {
    const response = await request(harness.server).get(`/api/v1/conversations/${conversationId}/messages`).set(...harness.bearer(party.token));
    expect(response.status).toBe(200);
    return MessagePageSchema.parse(response.body);
  }

  describe("who may talk", () => {
    it("lets a dispatched provider open the conversation, and counts that as viewing the dispatch", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);

      const conversation = ConversationSchema.parse(
        (await request(harness.server).get(`/api/v1/conversations/${conversationId}`).set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(conversation.myRole).toBe("PROVIDER");
      expect(conversation.canSend).toBe(true);

      // Only NOTIFIED candidacies expire — VIEWED keeps the conversation alive past the next batch.
      const mine = ProviderMatchSchema.array().parse(
        (await request(harness.server).get("/api/v1/matches/mine").set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(mine.find((match) => match.candidateId === dispatch.provider.candidateId)?.status).toBe("VIEWED");
    });

    it("returns the SAME conversation when the client opens it too — never a duplicate", async () => {
      const dispatch = await harness.dispatch();
      const fromProvider = await openAsProvider(dispatch);
      const fromClient = await harness.openConversation(dispatch.client, {
        requestId: dispatch.client.requestId,
        candidateId: dispatch.provider.candidateId,
      });
      expect(fromClient.status).toBe(201);
      expect(ConversationSchema.parse(fromClient.body).id).toBe(fromProvider);
    });

    it("makes the client name the dispatched provider it wants to write to", async () => {
      const dispatch = await harness.dispatch();
      const response = await harness.openConversation(dispatch.client, { requestId: dispatch.client.requestId });
      expect(response.status).toBe(400);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("CONVERSATION_CANDIDATE_REQUIRED");
    });

    it("refuses a provider the engine never dispatched to this request", async () => {
      const dispatch = await harness.dispatch();
      const outsider = await harness.undispatchedProvider();
      const response = await harness.openConversation(outsider, { requestId: dispatch.client.requestId });
      expect(response.status).toBe(403);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("CONVERSATION_NOT_DISPATCHED");
    });

    it("refuses a client pointing at a candidacy of ANOTHER request", async () => {
      const mine = await harness.dispatch();
      const theirs = await harness.dispatch();
      const response = await harness.openConversation(mine.client, { requestId: mine.client.requestId, candidateId: theirs.provider.candidateId });
      expect(response.status).toBe(403);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("CONVERSATION_NOT_DISPATCHED");
    });

    it("keeps a stranger out of the conversation, its messages and its search", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);
      const stranger = await harness.login();

      for (const path of ["", "/messages", "/messages/search?q=bonjour"]) {
        const response = await request(harness.server).get(`/api/v1/conversations/${conversationId}${path}`).set(...harness.bearer(stranger.token));
        expect(response.status, path).toBe(403);
      }
      const write = await harness.send(stranger, conversationId, { body: "intrusion" });
      expect(write.status).toBe(403);
    });

    it("closes the conversation once the provider declines the dispatch", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);

      const declined = await request(harness.server)
        .post(`/api/v1/matches/candidates/${dispatch.provider.candidateId}/decline`)
        .set(...harness.bearer(dispatch.provider.token))
        .send({});
      expect(declined.status).toBe(201);

      const attempt = await harness.send(dispatch.client, conversationId, { body: "Vous etes toujours disponible ?" });
      expect(attempt.status).toBe(409);
      expect(ProblemDetailsSchema.parse(attempt.body).code).toBe("CONVERSATION_CLOSED");

      const conversation = ConversationSchema.parse(
        (await request(harness.server).get(`/api/v1/conversations/${conversationId}`).set(...harness.bearer(dispatch.client.token))).body,
      );
      expect(conversation.canSend).toBe(false);
    });
  });

  describe("a phone number is masked BEFORE acceptance and visible AFTER — the exit criterion", () => {
    it("masks it in the sender's response, in what the other side reads, and in the database itself", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);

      const sent = await harness.send(dispatch.provider, conversationId, { body: `Appelez-moi au ${PHONE_TYPED} ce soir` });
      expect(sent.status).toBe(201);
      const message = MessageSchema.parse(sent.body);

      // 1. The sender is told, never masked silently.
      expect(message.body).toBe(`Appelez-moi au ${MASK} ce soir`);
      expect(message.redactions).toEqual([{ type: "PHONE" }]);

      // 2. The other participant reads the masked version.
      const clientView = await readAs(dispatch.client, conversationId);
      expect(clientView.messages.map((entry) => entry.body)).toEqual([`Appelez-moi au ${MASK} ce soir`]);

      // 3. The number never reached the database — nothing left for a later bug to leak.
      const stored = await harness.model<MessageEntity>(MessageEntity.name).findById(message.id).lean();
      expect(stored?.body).toBe(`Appelez-moi au ${MASK} ce soir`);
      expect(JSON.stringify(stored)).not.toMatch(/12\D?34\D?56\D?78/);
    });

    it("does not expose either side's phone number while protected", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);

      for (const party of [dispatch.client, dispatch.provider]) {
        const conversation = ConversationSchema.parse(
          (await request(harness.server).get(`/api/v1/conversations/${conversationId}`).set(...harness.bearer(party.token))).body,
        );
        expect(conversation.contactPolicy).toBe("PROTECTED");
        expect(conversation.counterpart.phone).toBeNull();
      }
    });

    it("after acceptance: shows each side the other's VERIFIED number and delivers new numbers verbatim", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);
      const beforeUnlock = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: `Mon numero ${PHONE_TYPED}` })).body);

      // Offer acceptance (Phase 7) will call exactly this; no HTTP route exposes it.
      await harness.app.get(ConversationService).unlockContact(dispatch.client.requestId, dispatch.provider.userId);

      const asClient = ConversationSchema.parse(
        (await request(harness.server).get(`/api/v1/conversations/${conversationId}`).set(...harness.bearer(dispatch.client.token))).body,
      );
      const asProvider = ConversationSchema.parse(
        (await request(harness.server).get(`/api/v1/conversations/${conversationId}`).set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(asClient.contactPolicy).toBe("UNLOCKED");
      expect(asClient.counterpart.phone).toBe(dispatch.provider.phone);
      expect(asProvider.counterpart.phone).toBe(dispatch.client.phone);

      const afterUnlock = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: `Mon numero ${PHONE_TYPED}` })).body);
      expect(afterUnlock.body).toBe(`Mon numero ${PHONE_TYPED}`);
      expect(afterUnlock.redactions).toEqual([]);

      // What was masked stays masked: the original was never stored, so there is nothing to reveal.
      const page = await readAs(dispatch.client, conversationId);
      expect(page.messages.find((entry) => entry.id === beforeUnlock.id)?.body).toBe(`Mon numero ${MASK}`);
    });

    it("keeps the first unlock time when unlocking twice", async () => {
      const dispatch = await harness.dispatch();
      await openAsProvider(dispatch);
      const conversations = harness.app.get(ConversationService);
      const first = await conversations.unlockContact(dispatch.client.requestId, dispatch.provider.userId);
      const second = await conversations.unlockContact(dispatch.client.requestId, dispatch.provider.userId);
      expect(second.contactUnlockedAt?.getTime()).toBe(first.contactUnlockedAt?.getTime());
    });

    it("exposes no HTTP route that unlocks contact details", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);
      for (const path of [`/api/v1/conversations/${conversationId}/unlock`, `/api/v1/conversations/${conversationId}/contact`]) {
        const response = await request(harness.server).post(path).set(...harness.bearer(dispatch.provider.token)).send({});
        expect(response.status, path).toBe(404);
      }
    });
  });

  describe("no way around the detector", () => {
    it("re-scans an edit — editing a clean message into a contact detail does not slip it through", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);
      const clean = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: "Bonjour" })).body);

      const edited = await request(harness.server)
        .patch(`/api/v1/conversations/${conversationId}/messages/${clean.id}`)
        .set(...harness.bearer(dispatch.provider.token))
        .send({ body: "Ecrivez-moi a ahmed.plombier@gmail.com" });
      expect(edited.status).toBe(200);
      const message = MessageSchema.parse(edited.body);
      expect(message.body).toBe(`Ecrivez-moi a ${MASK}`);
      expect(message.redactions).toEqual([{ type: "EMAIL" }]);
      expect(message.editedAt).not.toBeNull();
    });

    it("masks a contact detail hidden in an attachment's file name — before it is ever stored", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);

      const response = await request(harness.server)
        .post(`/api/v1/conversations/${conversationId}/attachments`)
        .set(...harness.bearer(dispatch.provider.token))
        .send({ fileName: "appelle 0612345678.png", contentType: "image/png", sizeBytes: 45 });
      expect(response.status).toBe(201);
      const session = CreateUploadSessionOutputSchema.parse(response.body);
      const body = response.body as { fileName: string; redactions: { type: string }[] };
      expect(body.fileName).toBe(`appelle ${MASK}.png`);
      expect(body.redactions).toEqual([{ type: "PHONE" }]);

      // Neither the stored name nor the object key derived from it carries the number.
      const stored = await harness.model<MediaEntity>(MediaEntity.name).findById(session.mediaId).lean();
      expect(stored?.fileName).not.toContain("0612345678");
      expect(session.objectKey).not.toContain("0612345678");
    });

    it("cannot resurface a masked number through search — the stored text is already masked", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);
      await harness.send(dispatch.provider, conversationId, { body: "Appelez 0612345678" });

      const found = await request(harness.server)
        .get(`/api/v1/conversations/${conversationId}/messages/search?q=0612345678`)
        .set(...harness.bearer(dispatch.client.token));
      expect(found.status).toBe(200);
      expect(MessageSchema.array().parse(found.body)).toEqual([]);
    });

    it("refuses a reaction outside the closed list — it would be a second text channel", async () => {
      const dispatch = await harness.dispatch();
      const conversationId = await openAsProvider(dispatch);
      const message = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: "Bonjour" })).body);

      const response = await request(harness.server)
        .put(`/api/v1/conversations/${conversationId}/messages/${message.id}/reaction`)
        .set(...harness.bearer(dispatch.client.token))
        .send({ emoji: "0612345678" });
      expect(response.status).toBe(400);
    });
  });
});
