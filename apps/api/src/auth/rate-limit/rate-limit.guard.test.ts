import type { ExecutionContext } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { RateLimitGuard } from "./rate-limit.guard.js";
import type { RateLimitService } from "./rate-limit.service.js";

function createContext(options: { metadata?: unknown; headerSpy?: (name: string, value: string) => void }): ExecutionContext {
  const request = { ip: "203.0.113.1" };
  const reply = { header: options.headerSpy ?? vi.fn() };
  return {
    getHandler: () => (() => undefined) as unknown as () => void,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  } as unknown as ExecutionContext;
}

describe("RateLimitGuard", () => {
  it("passes through untouched when the route has no @RateLimit metadata", async () => {
    const reflector = { get: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const consume = vi.fn();
    const guard = new RateLimitGuard(reflector, { consume } as unknown as RateLimitService);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(consume).not.toHaveBeenCalled();
  });

  it("allows the request when under the limit", async () => {
    const reflector = {
      get: vi.fn().mockReturnValue({ scope: "otp-request", limit: 5, windowSeconds: 3600 }),
    } as unknown as Reflector;
    const consume = vi.fn().mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    const guard = new RateLimitGuard(reflector, { consume } as unknown as RateLimitService);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(consume).toHaveBeenCalledWith("otp-request:ip:203.0.113.1", 5, 3600);
  });

  it("throws a 429 DomainHttpException and sets Retry-After once the limit is exceeded", async () => {
    const reflector = {
      get: vi.fn().mockReturnValue({ scope: "otp-request", limit: 5, windowSeconds: 3600 }),
    } as unknown as Reflector;
    const rateLimit = {
      consume: vi.fn().mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 42 }),
    } as unknown as RateLimitService;
    const guard = new RateLimitGuard(reflector, rateLimit);
    const headerSpy = vi.fn();

    await expect(guard.canActivate(createContext({ headerSpy }))).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(headerSpy).toHaveBeenCalledWith("Retry-After", "42");
  });
});
