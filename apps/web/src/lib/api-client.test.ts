import type { User } from "@fixiyi/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, uploadFile } from "./api-client";
import { useAuthStore } from "./auth-store";
import { API_URL } from "./config";


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
 * The client side of sessions (B1, Decision 51), which no browser scenario
 * can pin down: two expired calls at the same instant, a refresh that dies,
 * a wrong OTP. `fetch` is replaced by a fake API that knows one valid token.
 */

const USER = { id: "u1", roles: ["CLIENT"] } as unknown as User;

interface Call {
  url: string;
  init: RequestInit;
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

/**
 * A fake API: `valid` is the only access token it accepts; `/auth/refresh` rotates to `fresh`.
 * `lateFor`: that path answers only after a refresh has had time to finish, like a slow screen call.
 */
function fakeApi(options: { refreshOk?: boolean; valid?: string; lateFor?: string } = {}): Call[] {
  const calls: Call[] = [];
  let valid = options.valid ?? "fresh";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/api/v1/auth/refresh")) {
      // One tick of latency, so that callers who hit a 401 together really overlap.
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (options.refreshOk === false) return json(401, { code: "INVALID_REFRESH", title: "Refresh refused" });
      valid = "fresh";
      return json(200, { accessToken: "fresh", refreshToken: "rotated", expiresIn: 900 });
    }
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    const accepted = auth === undefined || auth === `Bearer ${valid}`;
    if (options.lateFor !== undefined && url.endsWith(options.lateFor)) await new Promise((resolve) => setTimeout(resolve, 20));
    if (!accepted) return json(401, { code: "UNAUTHORIZED", title: "Invalid or expired access token" });
    return json(200, { ok: true });
  });
  return calls;
}

const refreshes = (calls: Call[]): number => calls.filter((call) => call.url.endsWith("/auth/refresh")).length;

beforeEach(() => {
  useAuthStore.getState().setSession({ accessToken: "stale", refreshToken: "r0", user: USER });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch — requests", () => {
  it("sends the bearer token on an authenticated call only", async () => {
    const calls = fakeApi({ valid: "stale" });
    await apiFetch("/api/v1/requests/mine", { auth: true });
    await apiFetch("/api/v1/catalog/tree");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer stale");
    expect((calls[1]?.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("declares a JSON body only when there is one — Fastify refuses an empty JSON body", async () => {
    const calls = fakeApi({ valid: "stale" });
    await apiFetch("/api/v1/requests", { method: "POST", auth: true });
    await apiFetch("/api/v1/requests", { method: "POST", auth: true, body: { a: 1 } });
    expect(calls[0]?.init.headers).not.toHaveProperty("Content-Type");
    expect(calls[0]?.init.body).toBeNull();
    expect(calls[1]?.init.headers).toHaveProperty("Content-Type", "application/json");
    expect(calls[1]?.init.body).toBe('{"a":1}');
  });

  it("turns a Problem Details answer into an ApiError that keeps its code, title and status", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(json(409, { code: "CONVERSATION_CLOSED", title: "This conversation no longer accepts messages." })));
    const error = await apiFetch("/api/v1/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "CONVERSATION_CLOSED", status: 409, message: "This conversation no longer accepts messages." });
  });
});

describe("apiFetch — an expired session", () => {
  it("refreshes, then replays the call with the new token, and keeps the signed-in user", async () => {
    const calls = fakeApi();
    await expect(apiFetch("/api/v1/requests/mine", { auth: true })).resolves.toEqual({ ok: true });
    expect(refreshes(calls)).toBe(1);
    expect((calls.at(-1)?.init.headers as Record<string, string>).Authorization).toBe("Bearer fresh");
    expect(useAuthStore.getState()).toMatchObject({ accessToken: "fresh", refreshToken: "rotated", user: USER });
  });

  it("sends ONE refresh for calls that expire together: a second would be seen as replay and revoke the session", async () => {
    const calls = fakeApi();
    const results = await Promise.all([1, 2, 3].map(() => apiFetch("/api/v1/requests/mine", { auth: true })));
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes(calls)).toBe(1);
  });

  it("replays without a second refresh when a 401 arrives after another call's refresh already rotated the token", async () => {
    // Design phase 15, seen in the Linux browser run (1 in 5): the slow call was sent with the old
    // token, its 401 came back once the shared refresh had finished, and it started a refresh of its own.
    const calls = fakeApi({ lateFor: "/api/v1/conversations" });
    const results = await Promise.all([apiFetch("/api/v1/requests/mine", { auth: true }), apiFetch("/api/v1/conversations", { auth: true })]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshes(calls)).toBe(1);
  });

  it("refreshes again on a later expiry: the shared refresh does not stick", async () => {
    const calls = fakeApi();
    await apiFetch("/api/v1/requests/mine", { auth: true });
    useAuthStore.getState().setTokens({ accessToken: "stale-again", refreshToken: "rotated" });
    await apiFetch("/api/v1/requests/mine", { auth: true });
    expect(refreshes(calls)).toBe(2);
  });

  it("clears a session whose refresh is refused, and reports the 401", async () => {
    fakeApi({ refreshOk: false });
    const error = await apiFetch("/api/v1/requests/mine", { auth: true }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 401 });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, refreshToken: null, user: null });
  });

  it("never touches the session on an unauthenticated 401, such as a wrong OTP", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      calls.push(url);
      return Promise.resolve(json(401, { code: "OTP_INVALID", title: "Invalid code" }));
    });
    await expect(apiFetch("/api/v1/auth/otp/verify", { method: "POST", body: { code: "000000" } })).rejects.toMatchObject({ code: "OTP_INVALID" });
    expect(calls).toEqual([`${API_URL}/api/v1/auth/otp/verify`]);
    expect(useAuthStore.getState().user).toEqual(USER);
  });
});

describe("uploadFile", () => {
  it("reports a refused upload instead of pretending it worked", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 403 })));
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    await expect(uploadFile("http://minio/presigned", file)).rejects.toMatchObject({ code: "UPLOAD_FAILED", status: 403 });
  });
});
