import type { ExecutionContext } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { isResourceOwner, ResourceOwnerGuard } from "./resource-owner.guard.js";

describe("isResourceOwner", () => {
  it("matches equal ids", () => {
    expect(isResourceOwner("user-1", "user-1")).toBe(true);
  });

  it("rejects different ids or missing values", () => {
    expect(isResourceOwner("user-1", "user-2")).toBe(false);
    expect(isResourceOwner(undefined, "user-1")).toBe(false);
    expect(isResourceOwner("user-1", undefined)).toBe(false);
  });
});

describe("ResourceOwnerGuard", () => {
  it("allows any authenticated user when the route declares no @OwnedBy()", () => {
    const reflector = { get: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new ResourceOwnerGuard(reflector);
    const context = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: "user-1" }, params: {} }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows the owner and rejects everyone else", () => {
    const reflector = { get: vi.fn().mockReturnValue("ownerId") } as unknown as Reflector;
    const guard = new ResourceOwnerGuard(reflector);

    const ownerContext = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: "user-1" }, params: { ownerId: "user-1" } }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ownerContext)).toBe(true);

    const strangerContext = {
      getHandler: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: "user-2" }, params: { ownerId: "user-1" } }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(strangerContext)).toThrow();
  });
});
