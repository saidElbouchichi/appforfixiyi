import { apiFetch } from "./api-client";
import { useAuthStore } from "./auth-store";

/**
 * Ends the session on the server, then locally. Best-effort on the server
 * call: an already-dead session must still be cleared here, or the admin
 * stays stuck on a session that no longer works. (`apps/web` has its own
 * copy — the two apps share no code outside packages, Decision 51.)
 */
export async function signOut(): Promise<void> {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST", auth: true });
  } finally {
    useAuthStore.getState().clearSession();
  }
}
