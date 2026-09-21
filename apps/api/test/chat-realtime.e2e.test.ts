import "reflect-metadata";
import "./setup-env.js";

import {
  CHAT_CLIENT_EVENTS,
  CHAT_SERVER_EVENTS,
  CONTACT_REDACTION_PLACEHOLDER as MASK,
  ConversationSchema,
  MessageEventSchema,
  MessageSchema,
  ReceiptsEventSchema,
  TypingEventSchema,
} from "@fixiyi/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ChatGateway, SOCKET_UNAUTHORIZED } from "../src/chat/chat.gateway.js";

import { ChatHarness, eventsDuring, nextEvent, type Dispatch } from "./chat-test-harness.js";

/**
 * Real socket.io clients against the real app, through the real Redis
 * adapter (`configureRealtime`). The point being proven is 01_SPEC_PRODUCT.md
 * #49: the socket carries notifications of what the database stored — it
 * authenticates like the HTTP API, delivers each side its own view, and
 * reaches nobody else.
 */
describe("Chat — realtime (e2e)", () => {
  const harness = new ChatHarness();
  /** Long enough for an event that WOULD arrive to arrive, on loopback. */
  const SILENCE_MS = 600;

  beforeAll(async () => {
    await harness.start();
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  async function conversationFor(): Promise<{ dispatch: Dispatch; conversationId: string }> {
    const dispatch = await harness.dispatch();
    const opened = await harness.openConversation(dispatch.provider, { requestId: dispatch.client.requestId });
    expect(opened.status).toBe(201);
    return { dispatch, conversationId: ConversationSchema.parse(opened.body).id };
  }

  describe("handshake authentication — same rules as the HTTP API", () => {
    it("refuses a socket without a token", async () => {
      await expect(harness.connect(null)).rejects.toThrow(SOCKET_UNAUTHORIZED);
    });

    it("refuses a socket with a forged token", async () => {
      await expect(harness.connect("not.a.jwt")).rejects.toThrow(SOCKET_UNAUTHORIZED);
    });

    it("refuses a socket whose session was logged out", async () => {
      const party = await harness.login();
      await request(harness.server).post("/api/v1/auth/logout").set(...harness.bearer(party.token));
      await expect(harness.connect(party.token)).rejects.toThrow(SOCKET_UNAUTHORIZED);
    });

    it("disconnects a live socket once its session is revoked (remote logout)", async () => {
      const party = await harness.login();
      const socket = await harness.connect(party.token);
      const disconnected = nextEvent<string>(socket, "disconnect");

      await request(harness.server).post("/api/v1/auth/logout").set(...harness.bearer(party.token));
      // The sweep runs on a timer in production; triggered directly here.
      await harness.app.get(ChatGateway).sweepRevokedSessions();

      await expect(disconnected).resolves.toBeTruthy();
    });
  });

  describe("delivery", () => {
    it("pushes a stored message to the other side, live, masked, with the receiver's own view", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const clientSocket = await harness.connect(dispatch.client.token);
      const providerSocket = await harness.connect(dispatch.provider.token);
      const toClient = nextEvent(clientSocket, CHAT_SERVER_EVENTS.messageCreated);
      const toProvider = nextEvent(providerSocket, CHAT_SERVER_EVENTS.messageCreated);

      await harness.send(dispatch.provider, conversationId, { body: "Appelez-moi au 0612345678" });

      const received = MessageEventSchema.parse(await toClient);
      expect(received.conversationId).toBe(conversationId);
      // The socket never carries more than the database holds.
      expect(received.message.body).toBe(`Appelez-moi au ${MASK}`);
      // Viewer-relative: the receiver gets no delivery ticks...
      expect(received.message.deliveryStatus).toBeNull();
      // ...the sender's own copy (other tabs) does.
      expect(MessageEventSchema.parse(await toProvider).message.deliveryStatus).toBe("SENT");
    });

    it("reaches nobody outside the conversation", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const outsider = await harness.login();
      const outsiderSocket = await harness.connect(outsider.token);

      const [leaked] = await Promise.all([
        eventsDuring(outsiderSocket, CHAT_SERVER_EVENTS.messageCreated, SILENCE_MS),
        harness.send(dispatch.client, conversationId, { body: "prive" }),
      ]);
      expect(leaked).toEqual([]);
    });

    it("pushes edits and deletions as updates carrying a higher version", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const clientSocket = await harness.connect(dispatch.client.token);
      const original = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: "Je passe a 9h" })).body);

      const update = nextEvent(clientSocket, CHAT_SERVER_EVENTS.messageUpdated);
      await request(harness.server)
        .patch(`/api/v1/conversations/${conversationId}/messages/${original.id}`)
        .set(...harness.bearer(dispatch.provider.token))
        .send({ body: "Je passe a 10h" });

      const updated = MessageEventSchema.parse(await update).message;
      expect(updated.body).toBe("Je passe a 10h");
      // A client keeps the highest version, so a late duplicate of the original can never overwrite the edit.
      expect(updated.version).toBeGreaterThan(original.version);
    });

    it("pushes read receipts to the sender", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const providerSocket = await harness.connect(dispatch.provider.token);
      const message = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: "Devis: 450 DH" })).body);

      const receipt = nextEvent(providerSocket, CHAT_SERVER_EVENTS.receiptsUpdated);
      await request(harness.server)
        .post(`/api/v1/conversations/${conversationId}/receipts/read`)
        .set(...harness.bearer(dispatch.client.token))
        .send({ upToSeq: message.seq });

      expect(ReceiptsEventSchema.parse(await receipt)).toMatchObject({ conversationId, userId: dispatch.client.userId, readSeq: message.seq });
    });

    it("does not re-announce a receipt that moved nothing — no event storm from repeated acknowledgements", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const providerSocket = await harness.connect(dispatch.provider.token);
      const message = MessageSchema.parse((await harness.send(dispatch.provider, conversationId, { body: "x" })).body);
      const ack = (): Promise<unknown> =>
        request(harness.server)
          .post(`/api/v1/conversations/${conversationId}/receipts/read`)
          .set(...harness.bearer(dispatch.client.token))
          .send({ upToSeq: message.seq });

      await ack();
      const [repeats] = await Promise.all([eventsDuring(providerSocket, CHAT_SERVER_EVENTS.receiptsUpdated, SILENCE_MS), ack(), ack()]);
      expect(repeats).toEqual([]);
    });
  });

  describe("typing — ephemeral, and only to the other participant", () => {
    it("relays typing to the other participant", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const clientSocket = await harness.connect(dispatch.client.token);
      const providerSocket = await harness.connect(dispatch.provider.token);

      const typing = nextEvent(providerSocket, CHAT_SERVER_EVENTS.typing);
      clientSocket.emit(CHAT_CLIENT_EVENTS.typing, { conversationId, isTyping: true });

      expect(TypingEventSchema.parse(await typing)).toEqual({ conversationId, isTyping: true, userId: dispatch.client.userId });
    });

    it("ignores typing from someone who is not a participant", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const providerSocket = await harness.connect(dispatch.provider.token);
      const outsider = await harness.login();
      const outsiderSocket = await harness.connect(outsider.token);

      const [received] = await Promise.all([
        eventsDuring(providerSocket, CHAT_SERVER_EVENTS.typing, SILENCE_MS),
        Promise.resolve(outsiderSocket.emit(CHAT_CLIENT_EVENTS.typing, { conversationId, isTyping: true })),
      ]);
      expect(received).toEqual([]);
    });

    it("drops a malformed typing event instead of crashing the socket", async () => {
      const { dispatch } = await conversationFor();
      const socket = await harness.connect(dispatch.client.token);
      socket.emit(CHAT_CLIENT_EVENTS.typing, { conversationId: "not-an-id", isTyping: "yes" });
      await new Promise((resolve) => setTimeout(resolve, SILENCE_MS));
      expect(socket.connected).toBe(true);
    });
  });
});
