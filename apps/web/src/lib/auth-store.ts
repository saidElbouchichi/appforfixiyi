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
 * Same Bearer pattern as `apps/admin` (Decisions 33/38): `apps/web` is just
 * as cross-origin from `apps/api` (different ports), so cookies are avoided.
 * NOT in memory only: `persist` writes BOTH tokens to localStorage, which an
 * injected script could read. Accepted for an internal back-office (33);
 * for this public app the audit of 2026-09-21 flags it — decision pending
 * (httpOnly refresh cookie vs. memory-only tokens), see docs/DECISIONS.md.
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
