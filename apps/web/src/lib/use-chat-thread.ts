"use client";

import {
  CHAT_CLIENT_EVENTS,
  CHAT_SERVER_EVENTS,
  MessageEventSchema,
  ReceiptsEventSchema,
  TypingEventSchema,
  type Conversation,
  type Message,
  type MessageDeliveryStatus,
  type ReactionEmoji,
  type ReceiptsEvent,
} from "@fixiyi/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "./api-client";
import * as chatApi from "./chat-api";
import { getChatSocket } from "./realtime";

/**
 * State and synchronisation of one conversation thread.
 *
 * The database is the source of truth (01_SPEC_PRODUCT.md #49); the socket
 * only tells this hook that something changed. Everything that can arrive
 * twice or out of order is made harmless:
 * - messages are keyed by id and a newer `version` wins, so a socket echo of
 *   a message this tab just sent, or a late event, never duplicates or
 *   reverts anything;
 * - after a reconnect the hook asks the API for everything `after` the last
 *   seq it holds (#50 — "evenements manquants").
 */

const TYPING_REFRESH_MS = 3_000;
const TYPING_IDLE_MS = 4_000;
/** If the "stopped typing" event is lost, the indicator must not stay on forever. */
const TYPING_DISPLAY_TIMEOUT_MS = 6_000;
const READ_DEBOUNCE_MS = 400;

type MessageMap = Map<string, Message>;

const STATUS_RANK: Record<MessageDeliveryStatus, number> = { SENT: 0, DELIVERED: 1, READ: 2 };

export function upsertMessages(current: MessageMap, incoming: Message[]): MessageMap {
  const next = new Map(current);
  for (const message of incoming) {
    const existing = next.get(message.id);
    if (!existing || message.version >= existing.version) {
      next.set(message.id, message);
    }
  }
  return next;
}

/**
 * The other side's receipt watermarks, applied to MY messages. Never
 * downgrades a tick: a late, older receipt event must not turn "read" back
 * into "delivered".
 */
export function applyReceipts(current: MessageMap, event: ReceiptsEvent, myUserId: string): MessageMap {
  if (event.userId === myUserId) {
    return current;
  }
  const next = new Map(current);
  for (const [id, message] of current) {
    if (message.senderUserId !== myUserId || message.deliveryStatus === null) continue;
    const reached: MessageDeliveryStatus | null =
      message.seq <= event.readSeq ? "READ" : message.seq <= event.deliveredSeq ? "DELIVERED" : null;
    if (reached && STATUS_RANK[reached] > STATUS_RANK[message.deliveryStatus]) {
      next.set(id, { ...message, deliveryStatus: reached });
    }
  }
  return next;
}

function maxSeq(messages: MessageMap): number {
  let highest = 0;
  for (const message of messages.values()) highest = Math.max(highest, message.seq);
  return highest;
}

export interface ChatThread {
  messages: Message[];
  hasOlder: boolean;
  loading: boolean;
  error: string | null;
  connected: boolean;
  counterpartTyping: boolean;
  loadOlder: () => Promise<void>;
  /** Re-runs the initial load: an error the reader cannot act on is a dead end (design phase 9). */
  reload: () => void;
  stopTyping: () => void;
  send: (input: { body: string; replyToMessageId?: string; files?: File[] }) => Promise<Message>;
  edit: (messageId: string, body: string) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  react: (messageId: string, emoji: ReactionEmoji | null) => Promise<void>;
  notifyTyping: () => void;
}

/**
 * Mount once per conversation (`key={conversation.id}`): state then resets
 * by remounting, the idiomatic React way, instead of the hook resetting
 * itself — which would mean setting state synchronously inside an effect.
 */
export function useChatThread(conversation: Conversation | null, myUserId: string | null): ChatThread {
  const conversationId = conversation?.id ?? null;
  const [messages, setMessages] = useState<MessageMap>(() => new Map());
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [counterpartTyping, setCounterpartTyping] = useState(false);

  const messagesRef = useRef<MessageMap>(messages);
  const loadedRef = useRef(false);

  // Refs are written after render, never during it.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const merge = useCallback((incoming: Message[]) => {
    setMessages((current) => upsertMessages(current, incoming));
  }, []);

  // A failed first load must be retryable; bumping this re-runs the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  // ------------------------------------------------------------ initial page
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    chatApi
      .listMessages(conversationId)
      .then((page) => {
        if (cancelled) return;
        setMessages(upsertMessages(new Map(), page.messages));
        setHasOlder(page.hasMore);
        loadedRef.current = true;
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Impossible de charger la conversation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, reloadToken]);

  useRealtime(conversationId, myUserId, { merge, setMessages, setConnected, setCounterpartTyping, messagesRef, loadedRef });
  useReadReceipts(conversationId, myUserId, messages);
  const { notifyTyping, stopTyping } = useTypingEmitter(conversationId);

  const loadOlder = useCallback(async () => {
    if (!conversationId) return;
    const oldest = Math.min(...[...messagesRef.current.values()].map((message) => message.seq));
    const page = await chatApi.listMessages(conversationId, { before: oldest });
    merge(page.messages);
    setHasOlder(page.hasMore);
  }, [conversationId, merge]);

  const send = useCallback(
    async (input: { body: string; replyToMessageId?: string; files?: File[] }) => {
      if (!conversationId) throw new Error("no conversation");
      const attachmentMediaIds: string[] = [];
      for (const file of input.files ?? []) {
        attachmentMediaIds.push(await chatApi.uploadAttachment(conversationId, file));
      }
      const message = await chatApi.sendMessage(conversationId, {
        clientMessageId: crypto.randomUUID(),
        body: input.body,
        attachmentMediaIds,
        ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
      });
      merge([message]);
      stopTyping();
      return message;
    },
    [conversationId, merge, stopTyping],
  );

  const edit = useCallback(
    async (messageId: string, body: string) => {
      if (conversationId) merge([await chatApi.editMessage(conversationId, messageId, body)]);
    },
    [conversationId, merge],
  );

  const remove = useCallback(
    async (messageId: string) => {
      if (conversationId) merge([await chatApi.deleteMessage(conversationId, messageId)]);
    },
    [conversationId, merge],
  );

  const react = useCallback(
    async (messageId: string, emoji: ReactionEmoji | null) => {
      if (conversationId) merge([await chatApi.setReaction(conversationId, messageId, emoji)]);
    },
    [conversationId, merge],
  );

  const ordered = useMemo(() => [...messages.values()].sort((a, b) => a.seq - b.seq), [messages]);

  return { messages: ordered, hasOlder, loading, error, connected, counterpartTyping, loadOlder, reload, stopTyping, send, edit, remove, react, notifyTyping };
}

interface RealtimeHandles {
  merge: (incoming: Message[]) => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageMap>>;
  setConnected: (connected: boolean) => void;
  setCounterpartTyping: (typing: boolean) => void;
  messagesRef: React.RefObject<MessageMap>;
  loadedRef: React.RefObject<boolean>;
}

/** Socket subscriptions for one conversation, plus the catch-up after every reconnect. */
function useRealtime(conversationId: string | null, myUserId: string | null, handles: RealtimeHandles): void {
  const { merge, setMessages, setConnected, setCounterpartTyping, messagesRef, loadedRef } = handles;

  useEffect(() => {
    if (!conversationId || !myUserId) return;
    const socket = getChatSocket();
    let typingTimer: ReturnType<typeof setTimeout> | null = null;

    const onMessage = (payload: unknown): void => {
      const parsed = MessageEventSchema.safeParse(payload);
      if (!parsed.success || parsed.data.conversationId !== conversationId) return;
      merge([parsed.data.message]);
      // Their message arriving is the end of their typing — do not wait for the idle timeout
      // (found in the Playwright screenshots: "X ecrit…" lingered under X's own message).
      if (parsed.data.message.senderUserId !== myUserId) {
        if (typingTimer) clearTimeout(typingTimer);
        setCounterpartTyping(false);
      }
    };
    const onReceipts = (payload: unknown): void => {
      const parsed = ReceiptsEventSchema.safeParse(payload);
      if (parsed.success && parsed.data.conversationId === conversationId) {
        setMessages((current) => applyReceipts(current, parsed.data, myUserId));
      }
    };
    const onTyping = (payload: unknown): void => {
      const parsed = TypingEventSchema.safeParse(payload);
      if (!parsed.success || parsed.data.conversationId !== conversationId || parsed.data.userId === myUserId) return;
      setCounterpartTyping(parsed.data.isTyping);
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        setCounterpartTyping(false);
      }, TYPING_DISPLAY_TIMEOUT_MS);
    };
    const onConnect = (): void => {
      setConnected(true);
      // Catch up on anything missed while disconnected — from the database, not from the socket.
      if (!loadedRef.current) return;
      void catchUp(conversationId, maxSeq(messagesRef.current), merge);
    };
    const onDisconnect = (): void => {
      setConnected(false);
    };

    socket.on(CHAT_SERVER_EVENTS.messageCreated, onMessage);
    socket.on(CHAT_SERVER_EVENTS.messageUpdated, onMessage);
    socket.on(CHAT_SERVER_EVENTS.receiptsUpdated, onReceipts);
    socket.on(CHAT_SERVER_EVENTS.typing, onTyping);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);

    return () => {
      if (typingTimer) clearTimeout(typingTimer);
      socket.off(CHAT_SERVER_EVENTS.messageCreated, onMessage);
      socket.off(CHAT_SERVER_EVENTS.messageUpdated, onMessage);
      socket.off(CHAT_SERVER_EVENTS.receiptsUpdated, onReceipts);
      socket.off(CHAT_SERVER_EVENTS.typing, onTyping);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [conversationId, myUserId, merge, setMessages, setConnected, setCounterpartTyping, messagesRef, loadedRef]);
}

async function catchUp(conversationId: string, afterSeq: number, merge: (incoming: Message[]) => void): Promise<void> {
  let cursor = afterSeq;
  for (;;) {
    const page = await chatApi.listMessages(conversationId, { after: cursor });
    merge(page.messages);
    const last = page.messages[page.messages.length - 1];
    if (!page.hasMore || !last) return;
    cursor = last.seq;
  }
}

/**
 * Acknowledges the other side's messages: "read" while the thread is on
 * screen, "delivered" while the tab is in the background. Watermarks only
 * move forward on the server, so a repeated acknowledgement is harmless —
 * but it is still skipped here to avoid pointless requests.
 */
function useReadReceipts(conversationId: string | null, myUserId: string | null, messages: MessageMap): void {
  const acknowledgedRef = useRef({ read: 0, delivered: 0 });
  // Messages that arrived while the tab was hidden were only "delivered";
  // coming back to the tab must turn them into "read".
  const [visibilityTick, setVisibilityTick] = useState(0);

  useEffect(() => {
    const onVisibility = (): void => {
      setVisibilityTick((tick) => tick + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!conversationId || !myUserId) return;
    const theirs = [...messages.values()].filter((message) => message.senderUserId !== myUserId);
    const highest = Math.max(0, ...theirs.map((message) => message.seq));

    const timer = setTimeout(() => {
      const visible = document.visibilityState === "visible";
      if (visible && highest > acknowledgedRef.current.read) {
        acknowledgedRef.current = { read: highest, delivered: Math.max(highest, acknowledgedRef.current.delivered) };
        void chatApi.markRead(conversationId, highest);
      } else if (!visible && highest > acknowledgedRef.current.delivered) {
        acknowledgedRef.current = { ...acknowledgedRef.current, delivered: highest };
        void chatApi.markDelivered(conversationId, highest);
      }
    }, READ_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [conversationId, myUserId, messages, visibilityTick]);
}

/** Throttled "I am typing", with an automatic "stopped" after a pause. Never persisted anywhere. */
function useTypingEmitter(conversationId: string | null): { notifyTyping: () => void; stopTyping: () => void } {
  const lastSentRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    if (!conversationId || lastSentRef.current === 0) return;
    lastSentRef.current = 0;
    getChatSocket().emit(CHAT_CLIENT_EVENTS.typing, { conversationId, isTyping: false });
  }, [conversationId]);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const socket = getChatSocket();
    const now = Date.now();
    if (now - lastSentRef.current > TYPING_REFRESH_MS) {
      lastSentRef.current = now;
      socket.emit(CHAT_CLIENT_EVENTS.typing, { conversationId, isTyping: true });
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [conversationId, stopTyping]);

  return { notifyTyping, stopTyping };
}
