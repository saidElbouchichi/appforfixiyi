import type { User } from "@fixiyi/contracts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (session: { accessToken: string; refreshToken: string; user: User }) => void;
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
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "fixiyi-web-auth" },
  ),
);
