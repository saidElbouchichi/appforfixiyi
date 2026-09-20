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

/** Thin fetch wrapper — Bearer-token auth (not cookies), so this cross-origin call to apps/api needs no CORS-credentials setup. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
  });

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const problem = data as { code?: string; title?: string } | undefined;
    throw new ApiError(problem?.title ?? `Request failed (${response.status.toString()})`, problem?.code ?? "UNKNOWN", response.status);
  }

  return data as T;
}
