"use client";

import { CHAT_SERVER_EVENTS } from "@fixiyi/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { CONVERSATIONS_KEY } from "../lib/chat-api";
import { getChatSocket } from "../lib/realtime";

/**
 * Keeps the unread badge honest without polling: the socket already notifies
 * this tab when a message arrives or when receipts move (01_SPEC_PRODUCT.md
 * #49 — the socket notifies, HTTP is the source of truth), so each event just
 * invalidates the conversations query and the count is re-read from the API.
 */
export function useUnreadRefresh(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const socket = getChatSocket();
    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    };

    socket.on(CHAT_SERVER_EVENTS.messageCreated, invalidate);
    socket.on(CHAT_SERVER_EVENTS.receiptsUpdated, invalidate);
    return () => {
      socket.off(CHAT_SERVER_EVENTS.messageCreated, invalidate);
      socket.off(CHAT_SERVER_EVENTS.receiptsUpdated, invalidate);
    };
  }, [enabled, queryClient]);
}
