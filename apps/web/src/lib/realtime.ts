import { io, type Socket } from "socket.io-client";

import { refreshSession } from "./api-client";
import { useAuthStore } from "./auth-store";
import { API_URL } from "./config";

/** Mirrors the server's handshake refusal (`SOCKET_UNAUTHORIZED` in chat.gateway.ts). */
const UNAUTHORIZED = "UNAUTHORIZED";

let socket: Socket | null = null;
/** One refresh attempt per refusal; reset once a connection succeeds, so a dead session cannot loop. */
let refreshAttempted = false;

/**
 * The single chat socket of this tab.
 *
 * The socket only NOTIFIES (01_SPEC_PRODUCT.md #49); every write still goes
 * through `chat-api.ts`. Two details make it survive real life:
 *
 * - `auth` is a function, re-read on EVERY (re)connect, so a reconnect after
 *   the access token rotated sends the current token, not the one captured
 *   when the socket was first created.
 * - A handshake refused as UNAUTHORIZED (the token expired while the tab was
 *   asleep) triggers ONE refresh through the same single in-flight promise as
 *   HTTP (Decision 51), then a reconnect. A server refusal is final for
 *   socket.io — it will not retry on its own — so the reconnect is explicit.
 *   If the refresh fails too, the session is cleared and the page's existing
 *   guard sends the user to /login.
 */
export function getChatSocket(): Socket {
  if (socket) {
    return socket;
  }
  const created = io(API_URL, {
    transports: ["websocket"],
    auth: (callback) => {
      callback({ token: useAuthStore.getState().accessToken });
    },
  });

  created.on("connect", () => {
    refreshAttempted = false;
  });

  created.on("connect_error", (error) => {
    if (error.message !== UNAUTHORIZED || refreshAttempted) {
      return;
    }
    refreshAttempted = true;
    void refreshSession().then((refreshed) => {
      if (refreshed) {
        created.connect();
      } else {
        useAuthStore.getState().clearSession();
      }
    });
  });

  socket = created;
  return created;
}

/** On logout: a socket kept open would keep receiving the previous user's messages. */
export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
  refreshAttempted = false;
}
