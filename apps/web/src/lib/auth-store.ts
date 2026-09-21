import type { User } from "@fixiyi/contracts";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (session: { accessToken: string; refreshToken: string; user: User }) => void;
  /** Rotated pair from `POST /auth/refresh`, which returns tokens only — the signed-in user is unchanged and must be kept. */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
}

/**
 * Same Bearer-in-memory pattern as `apps/admin` (Decision 33) — `apps/web`
 * is just as cross-origin from `apps/api` (different ports) as the admin
 * back-office is, so the same CORS-avoiding trade-off applies here.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (session) => set(session),
      setTokens: (tokens) => set(tokens),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "fixiyi-web-auth" },
  ),
);

/**
 * Whether the persisted session has been read back from localStorage yet.
 *
 * Without this, an authenticated page renders once with `user === null`
 * (the server-rendered snapshot) and its redirect effect fires before
 * hydration completes — so refreshing any authenticated page bounced a
 * perfectly valid session back to /login. `useSyncExternalStore` rather
 * than `useState` + effect: no state is set during an effect, and the
 * server snapshot is explicit.
 */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}
