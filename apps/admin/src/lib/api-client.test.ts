import type { User } from "@fixiyi/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api-client";
import { useAuthStore } from "./auth-store";


// The auth store persists to localStorage, which Node lacks: give it an in-memory one
// before the store is created, or every write logs "storage unavailable".
vi.hoisted(() => {
  const items = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => { items.clear(); },
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  };
});

/**
 * The back-office's copy of the session client (Decision 51: the two apps
 * share no code outside packages). Same rules, same risk: two refreshes in
 * parallel and the refresh-token replay detection revokes the session.
 */

const USER = { id: "admin", roles: ["ADMIN"] } as unknown as User;

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

function fakeApi(options: { refreshOk?: boolean } = {}): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    urls.push(url);
    if (url.endsWith("/api/v1/auth/refresh")) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return options.refreshOk === false ? json(401, { code: "INVALID_REFRESH" }) : json(200, { accessToken: "fresh", refreshToken: "rotated", expiresIn: 900 });
    }
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    return auth === "Bearer fresh" ? json(200, { ok: true }) : json(401, { code: "UNAUTHORIZED", title: "Invalid or expired access token" });
  });
  return urls;
}

const refreshes = (urls: string[]): number => urls.filter((url) => url.endsWith("/auth/refresh")).length;

beforeEach(() => {
  useAuthStore.getState().setSession({ accessToken: "stale", refreshToken: "r0", user: USER });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin apiFetch — an expired session", () => {
  it("sends ONE refresh for calls that expire together, then replays them all", async () => {
    const urls = fakeApi();
    const results = await Promise.all([1, 2, 3].map(() => apiFetch("/api/v1/catalog/nodes", { auth: true })));
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes(urls)).toBe(1);
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("refreshes again on a later expiry", async () => {
    const urls = fakeApi();
    await apiFetch("/api/v1/catalog/nodes", { auth: true });
    useAuthStore.getState().setTokens({ accessToken: "stale-again", refreshToken: "rotated" });
    await apiFetch("/api/v1/catalog/nodes", { auth: true });
    expect(refreshes(urls)).toBe(2);
  });

  it("clears a session whose refresh is refused", async () => {
    fakeApi({ refreshOk: false });
    await expect(apiFetch("/api/v1/catalog/nodes", { auth: true })).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, refreshToken: null, user: null });
  });
});
