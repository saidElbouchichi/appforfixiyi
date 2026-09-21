import { describe, expect, it } from "vitest";

import {
  ALLOWED_REACTIONS,
  CONTACT_REDACTION_PLACEHOLDER,
  EditMessageInputSchema,
  MESSAGE_ATTACHMENTS_MAX,
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_PAGE_DEFAULT_LIMIT,
  MESSAGE_PAGE_MAX_LIMIT,
  MarkReceiptInputSchema,
  MessageListQuerySchema,
  MessageSearchQuerySchema,
  OpenConversationInputSchema,
  SendMessageInputSchema,
  SetReactionInputSchema,
  TypingInputSchema,
} from "./chat.js";

const ID = "01a0c2be-1595-7115-b394-827a2409f08b";
const OTHER_ID = "01a0c2be-19c1-75b7-bb2e-94a265cd2c15";

describe("SendMessageInputSchema", () => {
  it("accepts a text message with its idempotency key", () => {
    expect(SendMessageInputSchema.safeParse({ clientMessageId: ID, body: "Bonjour" }).success).toBe(true);
  });

  it("requires the idempotency key — without it a retried send would duplicate the message", () => {
    expect(SendMessageInputSchema.safeParse({ body: "Bonjour" }).success).toBe(false);
  });

  it("accepts an attachment-only message", () => {
    expect(SendMessageInputSchema.safeParse({ clientMessageId: ID, attachmentMediaIds: [OTHER_ID] }).success).toBe(true);
  });

  it("rejects a message with neither text nor attachment", () => {
    expect(SendMessageInputSchema.safeParse({ clientMessageId: ID, body: "   " }).success).toBe(false);
  });

  it("caps the body length", () => {
    const tooLong = "a".repeat(MESSAGE_BODY_MAX_LENGTH + 1);
    expect(SendMessageInputSchema.safeParse({ clientMessageId: ID, body: tooLong }).success).toBe(false);
  });

  it("caps the number of attachments", () => {
    const ids = Array.from({ length: MESSAGE_ATTACHMENTS_MAX + 1 }, () => ID);
    expect(SendMessageInputSchema.safeParse({ clientMessageId: ID, body: "x", attachmentMediaIds: ids }).success).toBe(false);
  });

  it("accepts a reply target", () => {
    expect(SendMessageInputSchema.safeParse({ clientMessageId: ID, body: "Oui", replyToMessageId: OTHER_ID }).success).toBe(true);
  });
});

describe("EditMessageInputSchema", () => {
  it("rejects an edit that would empty the message — deleting is a separate, controlled action", () => {
    expect(EditMessageInputSchema.safeParse({ body: "   " }).success).toBe(false);
  });
});

describe("SetReactionInputSchema", () => {
  it("accepts every emoji of the closed list", () => {
    for (const emoji of ALLOWED_REACTIONS) {
      expect(SetReactionInputSchema.safeParse({ emoji }).success).toBe(true);
    }
  });

  it("rejects anything outside the list — a free-form reaction would be a text channel around the contact detector", () => {
    for (const emoji of ["🔥", "0612345678", "call me", "wa.me/212612345678"]) {
      expect(SetReactionInputSchema.safeParse({ emoji }).success, emoji).toBe(false);
    }
  });
});

describe("MessageListQuerySchema", () => {
  it("defaults the page size", () => {
    expect(MessageListQuerySchema.parse({}).limit).toBe(MESSAGE_PAGE_DEFAULT_LIMIT);
  });

  it("coerces query-string numbers", () => {
    expect(MessageListQuerySchema.parse({ after: "12", limit: "20" })).toMatchObject({ after: 12, limit: 20 });
  });

  it("caps the page size", () => {
    expect(MessageListQuerySchema.safeParse({ limit: MESSAGE_PAGE_MAX_LIMIT + 1 }).success).toBe(false);
  });

  it("refuses both cursors at once — the direction would be ambiguous", () => {
    expect(MessageListQuerySchema.safeParse({ before: 10, after: 2 }).success).toBe(false);
  });

  it("accepts after=0, the catch-up of a client that has seen nothing yet", () => {
    expect(MessageListQuerySchema.safeParse({ after: 0 }).success).toBe(true);
  });
});

describe("other chat inputs", () => {
  it("lets a provider open a conversation without naming anyone", () => {
    expect(OpenConversationInputSchema.safeParse({ requestId: ID }).success).toBe(true);
  });

  it("rejects a negative receipt watermark", () => {
    expect(MarkReceiptInputSchema.safeParse({ upToSeq: -1 }).success).toBe(false);
  });

  it("rejects a one-character search, which would match nearly everything", () => {
    expect(MessageSearchQuerySchema.safeParse({ q: "a" }).success).toBe(false);
  });

  it("validates the typing event", () => {
    expect(TypingInputSchema.safeParse({ conversationId: ID, isTyping: true }).success).toBe(true);
    expect(TypingInputSchema.safeParse({ conversationId: "not-an-id", isTyping: true }).success).toBe(false);
  });

  it("uses a language-neutral redaction placeholder", () => {
    expect(CONTACT_REDACTION_PLACEHOLDER).not.toMatch(/[a-z]/i);
  });
});
