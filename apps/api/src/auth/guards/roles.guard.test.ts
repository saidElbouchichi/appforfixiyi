import type { ExecutionContext } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { RolesGuard } from "./roles.guard.js";

describe("RolesGuard", () => {
  it("allows any authenticated user when the route declares no @Roles()", () => {
    const reflector = { get: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows a user holding one of the required roles", () => {
    const reflector = { get: vi.fn().mockReturnValue(["ADMIN", "SUPER_ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: "u1", sessionId: "s1", roles: ["CLIENT", "ADMIN"] } }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a user missing every required role", () => {
    const reflector = { get: vi.fn().mockReturnValue(["ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: "u1", sessionId: "s1", roles: ["CLIENT"] } }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow();
  });

  it("rejects when there is no authenticated user at all", () => {
    const reflector = { get: vi.fn().mockReturnValue(["ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow();
  });
});
