import { describe, expect, it } from "vitest";

import { CsrfService } from "./csrf.service.js";

describe("CsrfService", () => {
  it("generates a token that matches itself", () => {
    const service = new CsrfService();
    const token = service.generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(service.matches(token, token)).toBe(true);
  });

  it("rejects a mismatched header/cookie pair", () => {
    const service = new CsrfService();
    expect(service.matches(service.generateToken(), service.generateToken())).toBe(false);
  });

  it("rejects when either side is missing", () => {
    const service = new CsrfService();
    const token = service.generateToken();
    expect(service.matches(token, undefined)).toBe(false);
    expect(service.matches(undefined, token)).toBe(false);
    expect(service.matches(undefined, undefined)).toBe(false);
  });
});
