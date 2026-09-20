import { describe, expect, it } from "vitest";

import { parseCookies, serializeCookie, serializeExpiredCookie } from "./cookie.util.js";

describe("serializeCookie", () => {
  it("includes every requested attribute", () => {
    const cookie = serializeCookie("fixiyi_at", "abc.def.ghi", {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/api/v1/auth",
      maxAgeSeconds: 900,
    });
    expect(cookie).toBe("fixiyi_at=abc.def.ghi; Path=/api/v1/auth; Max-Age=900; HttpOnly; Secure; SameSite=Lax");
  });

  it("omits attributes that weren't requested", () => {
    expect(serializeCookie("fixiyi_csrf", "token-value")).toBe("fixiyi_csrf=token-value");
  });

  it("URL-encodes the value", () => {
    expect(serializeCookie("name", "a value; with=chars")).toBe("name=a%20value%3B%20with%3Dchars");
  });
});

describe("serializeExpiredCookie", () => {
  it("sets Max-Age=0 while preserving the other attributes", () => {
    expect(serializeExpiredCookie("fixiyi_rt", { path: "/api/v1/auth", httpOnly: true })).toBe(
      "fixiyi_rt=; Path=/api/v1/auth; Max-Age=0; HttpOnly",
    );
  });
});

describe("parseCookies", () => {
  it("parses multiple cookies from a single header", () => {
    expect(parseCookies("fixiyi_at=abc; fixiyi_csrf=xyz")).toEqual({ fixiyi_at: "abc", fixiyi_csrf: "xyz" });
  });

  it("decodes URL-encoded values", () => {
    expect(parseCookies("name=a%20value")).toEqual({ name: "a value" });
  });

  it("returns an empty object for an undefined or empty header", () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });
});
