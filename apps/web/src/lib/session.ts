import { apiFetch } from "./api-client";
import { useAuthStore } from "./auth-store";
import { disconnectChatSocket } from "./realtime";

/**
 * Ends the session on the server, then locally. The server call is
 * best-effort: an already-dead session must still be cleared here, otherwise
 * a user who cannot reach the API would stay stuck on a session that no
 * longer works. The socket is closed explicitly — one left open would keep
 * delivering the previous user's messages.
 */
export async function signOut(): Promise<void> {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST", auth: true });
  } finally {
    disconnectChatSocket();
    useAuthStore.getState().clearSession();
  }
}
