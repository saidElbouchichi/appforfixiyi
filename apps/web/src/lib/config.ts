/** Browser-exposed API base URL — set `NEXT_PUBLIC_API_URL` in production; defaults to the local dev API. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
