import type { Message, ReceiptsEvent } from "@fixiyi/contracts";
import { describe, expect, it } from "vitest";

import { applyReceipts, upsertMessages } from "./use-chat-thread";

/**
 * The two pure rules that keep a live thread honest when the socket delivers
 * twice, late, or out of order (01_SPEC_PRODUCT.md #49, #50). The hook around
 * them is exercised end to end by `tests/browser/tests/chat.spec.ts`.
 */

const ME = "me";
const THEM = "them";

function message(overrides: Partial<Message> & Pick<Message, "id" | "seq">): Message {
  return {
    conversationId: "c1",
    senderUserId: ME,
    body: `message ${overrides.id}`,
    version: 1,
    deliveryStatus: "SENT",
    ...overrides,
  } as Message;
}

const map = (...messages: Message[]): Map<string, Message> => new Map(messages.map((m) => [m.id, m]));
const receipts = (overrides: Partial<ReceiptsEvent>): ReceiptsEvent =>
  ({ conversationId: "c1", userId: THEM, deliveredSeq: 0, readSeq: 0, ...overrides });

describe("upsertMessages", () => {
  it("adds a message it has never seen", () => {
    const next = upsertMessages(map(), [message({ id: "a", seq: 1 })]);
    expect([...next.keys()]).toEqual(["a"]);
  });

  it("never duplicates: the socket echo of a message this tab just sent replaces it", () => {
    const sent = message({ id: "a", seq: 1 });
    const next = upsertMessages(map(sent), [{ ...sent }]);
    expect(next.size).toBe(1);
  });

  it("lets a newer version win — an edit that arrives replaces the old text", () => {
    const next = upsertMessages(map(message({ id: "a", seq: 1, body: "old", version: 1 })), [message({ id: "a", seq: 1, body: "new", version: 2 })]);
    expect(next.get("a")?.body).toBe("new");
  });

  it("never reverts: a late event carrying an older version is ignored", () => {
    const next = upsertMessages(map(message({ id: "a", seq: 1, body: "edited", version: 2 })), [message({ id: "a", seq: 1, body: "original", version: 1 })]);
    expect(next.get("a")?.body).toBe("edited");
  });

  it("does not mutate the map it was given", () => {
    const current = map();
    upsertMessages(current, [message({ id: "a", seq: 1 })]);
    expect(current.size).toBe(0);
  });
});

describe("applyReceipts", () => {
  const mine = (id: string, seq: number, deliveryStatus: Message["deliveryStatus"] = "SENT"): Message => message({ id, seq, deliveryStatus });

  it("ticks my messages up to the other side's watermarks, the watermark message included", () => {
    const next = applyReceipts(map(mine("a", 1), mine("b", 2), mine("c", 3)), receipts({ deliveredSeq: 3, readSeq: 2 }), ME);
    expect([next.get("a"), next.get("b"), next.get("c")].map((m) => m?.deliveryStatus)).toEqual(["READ", "READ", "DELIVERED"]);
  });

  it("never downgrades a tick: a late 'delivered' does not turn 'read' back", () => {
    const next = applyReceipts(map(mine("a", 1, "READ")), receipts({ deliveredSeq: 1, readSeq: 0 }), ME);
    expect(next.get("a")?.deliveryStatus).toBe("READ");
  });

  it("ignores my own receipts: reading my screen does not mark my messages read", () => {
    const current = map(mine("a", 1));
    expect(applyReceipts(current, receipts({ userId: ME, deliveredSeq: 1, readSeq: 1 }), ME)).toBe(current);
  });

  it("leaves the other side's messages alone: receipts only tick mine", () => {
    const theirs = message({ id: "t", seq: 1, senderUserId: THEM, deliveryStatus: "SENT" });
    const next = applyReceipts(map(theirs), receipts({ deliveredSeq: 1, readSeq: 1 }), ME);
    expect(next.get("t")?.deliveryStatus).toBe("SENT");
  });

  it("leaves a message without a delivery status alone (a deleted one)", () => {
    const deleted = message({ id: "d", seq: 1, deliveryStatus: null });
    const next = applyReceipts(map(deleted), receipts({ deliveredSeq: 1, readSeq: 1 }), ME);
    expect(next.get("d")?.deliveryStatus).toBeNull();
  });
});
