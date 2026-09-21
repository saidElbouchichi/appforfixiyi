import { AuthTokensSchema } from "@fixiyi/contracts";

import { useAuthStore } from "./auth-store";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

function buildRequest(options: RequestOptions): RequestInit {
  const headers: Record<string, string> = {};
  // Fastify's JSON body parser rejects a request that declares Content-Type: application/json but sends no body (e.g. POST /requests, which takes none) — only set it when there's an actual body.
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
  };
}

/**
 * At most one refresh in flight, shared by every caller that hits a 401 at
 * the same moment.
 *
 * This is not an optimisation, it is the whole point: the refresh token
 * rotates, and `SessionService` treats a second presentation of an already
 * rotated token as replay — it revokes the entire session. A screen like
 * /requests/new fires several authenticated calls on mount, so N parallel
 * refreshes would log the user out rather than keep them signed in. Every
 * concurrent caller therefore awaits the same promise and then retries with
 * whatever token that one refresh produced.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      return false;
    }
    // Tokens only — /auth/refresh does not return the user, so the signed-in
    // user in the store must be preserved (hence `setTokens`, not `setSession`).
    const tokens = AuthTokensSchema.parse(await response.json());
    setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    return true;
  } catch {
    // A network failure or a malformed payload is not a valid session either.
    return false;
  }
}

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Thin fetch wrapper — Bearer-token auth (not cookies), so this cross-origin call to apps/api needs no CORS-credentials setup. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await fetch(`${API_URL}${path}`, buildRequest(options));

  // The access token lives 15 minutes; the refresh token lives 30 days. Without
  // this branch every authenticated screen broke 15 minutes after login with
  // "Invalid or expired access token", and the dead session stayed in
  // localStorage forever because nothing ever cleared it.
  if (response.status === 401 && options.auth === true) {
    if (await refreshSession()) {
      // Rebuilt, not reused: buildRequest reads the token that refresh just stored.
      response = await fetch(`${API_URL}${path}`, buildRequest(options));
    } else {
      // Clearing the session is enough to get the user out: every authenticated
      // page already redirects to /login when `user` becomes null, so no hard
      // `window.location` navigation is needed (and none would be SSR-safe here).
      useAuthStore.getState().clearSession();
    }
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const problem = data as { code?: string; title?: string } | undefined;
    throw new ApiError(problem?.title ?? `Request failed (${response.status.toString()})`, problem?.code ?? "UNKNOWN", response.status);
  }

  return data as T;
}

/** A presigned upload URL is not `apps/api` — it must be PUT with no Authorization/JSON headers attached. */
export async function uploadFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!response.ok) {
    throw new ApiError(`Upload failed (${response.status.toString()})`, "UPLOAD_FAILED", response.status);
  }
}
