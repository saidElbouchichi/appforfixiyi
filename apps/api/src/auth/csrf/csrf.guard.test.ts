import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { CsrfGuard } from "./csrf.guard.js";
import { CsrfService } from "./csrf.service.js";

function createContext(request: { authTokenSource?: "header" | "cookie"; headers: Record<string, string | undefined> }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("CsrfGuard", () => {
  it("passes through when the caller authenticated via Authorization header", () => {
    const guard = new CsrfGuard(new CsrfService());
    const context = createContext({ authTokenSource: "header", headers: {} });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows a cookie-authenticated request whose x-csrf-token matches the cookie", () => {
    const csrf = new CsrfService();
    const guard = new CsrfGuard(csrf);
    const token = csrf.generateToken();
    const context = createContext({
      authTokenSource: "cookie",
      headers: { cookie: `fixiyi_csrf=${token}`, "x-csrf-token": token },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a cookie-authenticated request with a mismatched or missing csrf header", () => {
    const csrf = new CsrfService();
    const guard = new CsrfGuard(csrf);
    const token = csrf.generateToken();

    const mismatched = createContext({
      authTokenSource: "cookie",
      headers: { cookie: `fixiyi_csrf=${token}`, "x-csrf-token": csrf.generateToken() },
    });
    expect(() => guard.canActivate(mismatched)).toThrow();

    const missingHeader = createContext({ authTokenSource: "cookie", headers: { cookie: `fixiyi_csrf=${token}` } });
    expect(() => guard.canActivate(missingHeader)).toThrow();
  });
});
