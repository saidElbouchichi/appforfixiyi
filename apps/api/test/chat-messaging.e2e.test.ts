import "reflect-metadata";
import "./setup-env.js";

import {
  ConversationSchema,
  CreateUploadSessionOutputSchema,
  MediaSchema,
  MessagePageSchema,
  MessageSchema,
  ProblemDetailsSchema,
  ReceiptsEventSchema,
  type Message,
} from "@fixiyi/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MessageEntity } from "../src/chat/schemas/message.schema.js";
import { MediaService } from "../src/media/media.service.js";

import { ChatHarness, type Dispatch, type Party } from "./chat-test-harness.js";

/** A well-known, genuinely valid 1x1 PNG (same fixture as request.e2e.test.ts). */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAAAAAAABoTPPAAAAABJRU5ErkJggg==", "base64");

describe("Chat — messaging (e2e)", () => {
  const harness = new ChatHarness();

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

  async function sendText(party: Party, conversationId: string, body: string): Promise<Message> {
    const response = await harness.send(party, conversationId, { body });
    expect(response.status).toBe(201);
    return MessageSchema.parse(response.body);
  }

  function path(conversationId: string, suffix = ""): string {
    return `/api/v1/conversations/${conversationId}${suffix}`;
  }

  describe("sending", () => {
    it("is idempotent — resending the same clientMessageId returns the same message, stored once", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const clientMessageId = crypto.randomUUID();

      const first = await harness.send(dispatch.client, conversationId, { clientMessageId, body: "Bonjour" });
      const retry = await harness.send(dispatch.client, conversationId, { clientMessageId, body: "Bonjour" });
      expect(MessageSchema.parse(retry.body).id).toBe(MessageSchema.parse(first.body).id);

      const stored = await harness.model<MessageEntity>(MessageEntity.name).countDocuments({ conversationId });
      expect(stored).toBe(1);
    });

    it("gives every message a strictly increasing seq", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const seqs: number[] = [];
      for (const text of ["un", "deux", "trois"]) {
        seqs.push((await sendText(dispatch.client, conversationId, text)).seq);
      }
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(3);
    });

    it("refuses an empty message", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const response = await harness.send(dispatch.client, conversationId, { body: "   " });
      expect(response.status).toBe(400);
    });
  });

  describe("reading — cursor pagination and reconnect catch-up", () => {
    it("pages back through history with `before`, always in chronological order", async () => {
      const { dispatch, conversationId } = await conversationFor();
      for (const text of ["m1", "m2", "m3", "m4", "m5"]) await sendText(dispatch.client, conversationId, text);

      const latest = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, "/messages?limit=2")).set(...harness.bearer(dispatch.client.token))).body,
      );
      expect(latest.messages.map((message) => message.body)).toEqual(["m4", "m5"]);
      expect(latest.hasMore).toBe(true);

      const older = MessagePageSchema.parse(
        (
          await request(harness.server)
            .get(path(conversationId, `/messages?limit=2&before=${String(latest.messages[0]?.seq)}`))
            .set(...harness.bearer(dispatch.client.token))
        ).body,
      );
      expect(older.messages.map((message) => message.body)).toEqual(["m2", "m3"]);
    });

    it("returns exactly what was missed with `after` — the catch-up after a dropped connection", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const seen = await sendText(dispatch.provider, conversationId, "vu");
      await sendText(dispatch.provider, conversationId, "manque 1");
      await sendText(dispatch.provider, conversationId, "manque 2");

      const missed = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, `/messages?after=${String(seen.seq)}`)).set(...harness.bearer(dispatch.client.token))).body,
      );
      expect(missed.messages.map((message) => message.body)).toEqual(["manque 1", "manque 2"]);
      expect(missed.hasMore).toBe(false);
    });

    it("refuses both cursors at once", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const response = await request(harness.server).get(path(conversationId, "/messages?before=5&after=1")).set(...harness.bearer(dispatch.client.token));
      expect(response.status).toBe(400);
    });
  });

  describe("replies, reactions, edits, deletions", () => {
    it("shows a reply with an excerpt of the message it answers", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const question = await sendText(dispatch.client, conversationId, "Vous pouvez venir demain ?");
      const answer = MessageSchema.parse(
        (await harness.send(dispatch.provider, conversationId, { body: "Oui, vers 10h", replyToMessageId: question.id })).body,
      );
      expect(answer.replyTo).toEqual({ id: question.id, senderUserId: dispatch.client.userId, excerpt: "Vous pouvez venir demain ?", deleted: false });
    });

    it("refuses a reply to a message of another conversation", async () => {
      const first = await conversationFor();
      const second = await conversationFor();
      const elsewhere = await sendText(second.dispatch.client, second.conversationId, "ailleurs");

      const response = await harness.send(first.dispatch.client, first.conversationId, { body: "Re", replyToMessageId: elsewhere.id });
      expect(response.status).toBe(400);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("REPLY_TARGET_NOT_FOUND");
    });

    it("keeps one reaction per user — reacting again replaces it, and it can be removed", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const message = await sendText(dispatch.provider, conversationId, "Devis envoye");
      const reactionPath = path(conversationId, `/messages/${message.id}/reaction`);

      await request(harness.server).put(reactionPath).set(...harness.bearer(dispatch.client.token)).send({ emoji: "👍" });
      const replaced = MessageSchema.parse(
        (await request(harness.server).put(reactionPath).set(...harness.bearer(dispatch.client.token)).send({ emoji: "🙏" })).body,
      );
      expect(replaced.reactions).toEqual([{ userId: dispatch.client.userId, emoji: "🙏" }]);

      const removed = MessageSchema.parse((await request(harness.server).delete(reactionPath).set(...harness.bearer(dispatch.client.token))).body);
      expect(removed.reactions).toEqual([]);
      expect(removed.version).toBeGreaterThan(replaced.version);
    });

    it("lets only the sender edit, and only within the edit window", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const message = await sendText(dispatch.provider, conversationId, "Je passe a 9h");
      expect(message.editableUntil).not.toBeNull();

      const byOther = await request(harness.server)
        .patch(path(conversationId, `/messages/${message.id}`))
        .set(...harness.bearer(dispatch.client.token))
        .send({ body: "falsifie" });
      expect(byOther.status).toBe(403);

      // Age the message past the 15-minute window (native driver: `createdAt` is immutable through Mongoose).
      await harness.model<MessageEntity>(MessageEntity.name).collection.updateOne(
        { _id: message.id as never },
        { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } },
      );
      const late = await request(harness.server)
        .patch(path(conversationId, `/messages/${message.id}`))
        .set(...harness.bearer(dispatch.provider.token))
        .send({ body: "Je passe a 10h" });
      expect(late.status).toBe(409);
      expect(ProblemDetailsSchema.parse(late.body).code).toBe("MESSAGE_EDIT_WINDOW_CLOSED");
    });

    it("deletes softly: hidden from both sides, but kept in the database for disputes", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const message = await sendText(dispatch.client, conversationId, "Message a retirer");

      const deleted = await request(harness.server).delete(path(conversationId, `/messages/${message.id}`)).set(...harness.bearer(dispatch.client.token));
      expect(deleted.status).toBe(200);
      expect(MessageSchema.parse(deleted.body).body).toBeNull();

      const providerView = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, "/messages")).set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(providerView.messages[0]?.body).toBeNull();
      expect(providerView.messages[0]?.deletedAt).not.toBeNull();

      const stored = await harness.model<MessageEntity>(MessageEntity.name).findById(message.id).lean();
      expect(stored?.body).toBe("Message a retirer");
    });

    it("refuses deleting someone else's message", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const message = await sendText(dispatch.client, conversationId, "a moi");
      const response = await request(harness.server).delete(path(conversationId, `/messages/${message.id}`)).set(...harness.bearer(dispatch.provider.token));
      expect(response.status).toBe(403);
    });
  });

  describe("receipts — sent, delivered, read", () => {
    it("moves the sender's ticks from SENT to DELIVERED to READ, and clears the reader's unread count", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const message = await sendText(dispatch.provider, conversationId, "Devis: 450 DH");
      expect(message.deliveryStatus).toBe("SENT");

      const unread = ConversationSchema.parse((await request(harness.server).get(path(conversationId)).set(...harness.bearer(dispatch.client.token))).body);
      expect(unread.unreadCount).toBe(1);

      await request(harness.server).post(path(conversationId, "/receipts/delivered")).set(...harness.bearer(dispatch.client.token)).send({ upToSeq: message.seq });
      const delivered = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, "/messages")).set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(delivered.messages[0]?.deliveryStatus).toBe("DELIVERED");

      await request(harness.server).post(path(conversationId, "/receipts/read")).set(...harness.bearer(dispatch.client.token)).send({ upToSeq: message.seq });
      const read = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, "/messages")).set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(read.messages[0]?.deliveryStatus).toBe("READ");
      // A received message carries no ticks for its reader.
      const clientView = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, "/messages")).set(...harness.bearer(dispatch.client.token))).body,
      );
      expect(clientView.messages[0]?.deliveryStatus).toBeNull();

      const cleared = ConversationSchema.parse((await request(harness.server).get(path(conversationId)).set(...harness.bearer(dispatch.client.token))).body);
      expect(cleared.unreadCount).toBe(0);
    });

    it("never moves a watermark backwards, and never past the last message", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const message = await sendText(dispatch.provider, conversationId, "x");

      await request(harness.server).post(path(conversationId, "/receipts/read")).set(...harness.bearer(dispatch.client.token)).send({ upToSeq: message.seq });
      const backwards = ReceiptsEventSchema.parse(
        (await request(harness.server).post(path(conversationId, "/receipts/read")).set(...harness.bearer(dispatch.client.token)).send({ upToSeq: 0 })).body,
      );
      expect(backwards.readSeq).toBe(message.seq);

      const beyond = ReceiptsEventSchema.parse(
        (await request(harness.server).post(path(conversationId, "/receipts/read")).set(...harness.bearer(dispatch.client.token)).send({ upToSeq: 9999 })).body,
      );
      expect(beyond.readSeq).toBe(message.seq);
    });
  });

  describe("attachments", () => {
    async function uploadImage(party: Party, conversationId: string): Promise<string> {
      const session = CreateUploadSessionOutputSchema.parse(
        (
          await request(harness.server)
            .post(path(conversationId, "/attachments"))
            .set(...harness.bearer(party.token))
            .send({ fileName: "fuite.png", contentType: "image/png", sizeBytes: PNG.byteLength })
        ).body,
      );
      const put = await fetch(session.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: PNG });
      expect(put.status).toBe(200);
      const finalized = await request(harness.server)
        .post(path(conversationId, `/attachments/${session.mediaId}/finalize`))
        .set(...harness.bearer(party.token));
      expect(MediaSchema.parse(finalized.body).status).toBe("READY");
      return session.mediaId;
    }

    it("sends a photo through the real media pipeline and serves it back through a short-lived link", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const mediaId = await uploadImage(dispatch.client, conversationId);

      const message = MessageSchema.parse((await harness.send(dispatch.client, conversationId, { attachmentMediaIds: [mediaId] })).body);
      expect(message.attachments).toHaveLength(1);
      const attachment = message.attachments[0];
      expect(attachment).toMatchObject({ mediaId, kind: "IMAGE", width: 1, height: 1 });

      // The other participant can actually fetch the bytes.
      const providerView = MessagePageSchema.parse(
        (await request(harness.server).get(path(conversationId, "/messages")).set(...harness.bearer(dispatch.provider.token))).body,
      );
      const url = providerView.messages[0]?.attachments[0]?.url ?? "";
      const downloaded = await fetch(url);
      expect(downloaded.status).toBe(200);
      expect(Buffer.from(await downloaded.arrayBuffer()).equals(PNG)).toBe(true);
    });

    it("refuses attaching a file that is not the sender's own upload to this conversation", async () => {
      const { dispatch, conversationId } = await conversationFor();
      const clientsMedia = await uploadImage(dispatch.client, conversationId);

      const response = await harness.send(dispatch.provider, conversationId, { attachmentMediaIds: [clientsMedia] });
      expect(response.status).toBe(400);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("MEDIA_NOT_ATTACHABLE");
    });

    it("refuses finalising, through this conversation, the SAME user's file uploaded elsewhere", async () => {
      // The B7 gap found on requests: ownership was checked, but not that the
      // media belonged to the target in the URL. Here the user owns the media
      // AND is a participant — only the target check can refuse it.
      const { dispatch, conversationId } = await conversationFor();
      const elsewhere = await harness.app.get(MediaService).createUploadSession(dispatch.client.userId, {
        targetType: "REQUEST",
        targetId: dispatch.client.requestId,
        fileName: "a.png",
        contentType: "image/png",
        sizeBytes: PNG.byteLength,
      });

      const response = await request(harness.server)
        .post(path(conversationId, `/attachments/${elsewhere.mediaId}/finalize`))
        .set(...harness.bearer(dispatch.client.token));
      expect(response.status).toBe(400);
      expect(ProblemDetailsSchema.parse(response.body).code).toBe("MEDIA_NOT_IN_CONVERSATION");
    });
  });

  describe("search", () => {
    it("finds messages by text, case-insensitively, and treats the query as text, not as a regex", async () => {
      const { dispatch, conversationId } = await conversationFor();
      await sendText(dispatch.client, conversationId, "Le chauffe-eau fuit");
      await sendText(dispatch.client, conversationId, "Autre chose");

      const found = MessageSchema.array().parse(
        (await request(harness.server).get(path(conversationId, "/messages/search?q=CHAUFFE")).set(...harness.bearer(dispatch.provider.token))).body,
      );
      expect(found.map((message) => message.body)).toEqual(["Le chauffe-eau fuit"]);

      // A regex metacharacter must be matched literally — never compiled into a pattern.
      const literal = await request(harness.server).get(path(conversationId, "/messages/search?q=.*")).set(...harness.bearer(dispatch.provider.token));
      expect(literal.status).toBe(200);
      expect(MessageSchema.array().parse(literal.body)).toEqual([]);
    });
  });
});
