import type { ExecutionContext } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { RolesGuard } from "./roles.guard.js";

const getAllAndOverride = vi.fn();

/** Mirrors Nest's real precedence: a method-level `@Roles` wins over a class-level one. */
function reflectorFor(handlerRoles: string[] | undefined, classRoles?: string[]): Reflector {
  getAllAndOverride.mockReturnValue(handlerRoles ?? classRoles);
  return { getAllAndOverride } as unknown as Reflector;
}

function contextFor(roles: string[] | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: roles ? { id: "u1", sessionId: "s1", roles } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows any authenticated user when the route declares no @Roles()", () => {
    const guard = new RolesGuard(reflectorFor(undefined));
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it("allows a user holding one of the required roles", () => {
    const guard = new RolesGuard(reflectorFor(["ADMIN", "SUPER_ADMIN"]));
    expect(guard.canActivate(contextFor(["CLIENT", "ADMIN"]))).toBe(true);
  });

  it("rejects a user missing every required role", () => {
    const guard = new RolesGuard(reflectorFor(["ADMIN"]));
    expect(() => guard.canActivate(contextFor(["CLIENT"]))).toThrow();
  });

  it("rejects when there is no authenticated user at all", () => {
    const guard = new RolesGuard(reflectorFor(["ADMIN"]));
    expect(() => guard.canActivate(contextFor(undefined))).toThrow();
  });

  it("enforces a class-level @Roles() when the handler declares none", () => {
    // Regression guard: reading only `getHandler()` used to ignore a controller-level
    // @Roles() silently, leaving such an endpoint open to any authenticated user.
    const guard = new RolesGuard(reflectorFor(undefined, ["ADMIN"]));
    expect(() => guard.canActivate(contextFor(["CLIENT"]))).toThrow();
    expect(guard.canActivate(contextFor(["ADMIN"]))).toBe(true);
  });

  it("asks the reflector for both the handler and the class", () => {
    getAllAndOverride.mockClear();
    new RolesGuard(reflectorFor(["ADMIN"])).canActivate(contextFor(["ADMIN"]));

    expect(getAllAndOverride.mock.calls[0]?.[1]).toHaveLength(2);
  });
});
