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
 * First real use of zustand since it was installed in Phase 1. Persisted to
 * localStorage so an admin doesn't get logged out on every page refresh —
 * an accepted trade-off for an internal back-office tool (01_SPEC_PRODUCT.md
 * doesn't require hardened token storage here the way Phase 13's mobile app
 * will need).
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
    { name: "fixiyi-admin-auth" },
  ),
);

export function isAdminOrManager(user: User | null): boolean {
  return user !== null && (user.roles.includes("ADMIN") || user.roles.includes("MANAGER") || user.roles.includes("SUPER_ADMIN"));
}
