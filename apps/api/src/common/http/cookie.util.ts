/**
 * Hand-rolled cookie parse/serialize — no `@fastify/cookie` dependency needed
 * for a handful of first-party cookies. Fastify natively appends (rather than
 * overwrites) repeated `reply.header("set-cookie", ...)` calls (verified in
 * `fastify/lib/reply.js`), so setting is a plain header call; reading just
 * splits the `Cookie` request header.
 */

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
  maxAgeSeconds?: number;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAgeSeconds !== undefined) parts.push(`Max-Age=${options.maxAgeSeconds.toString()}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

/** A `Max-Age=0` cookie in the past, clearing it client-side — same attributes must be echoed for the browser to match it. */
export function serializeExpiredCookie(name: string, options: Pick<CookieOptions, "path" | "secure" | "sameSite" | "httpOnly"> = {}): string {
  return serializeCookie(name, "", { ...options, maxAgeSeconds: 0 });
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  }
  return cookies;
}
