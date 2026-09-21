import type { Env } from "@fixiyi/config";
import { sign } from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { TokenService } from "./token.service.js";

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    JWT_SECRET: "access-secret-long-enough",
    JWT_REFRESH_SECRET: "refresh-secret-long-enough",
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "30d",
    ...overrides,
  } as unknown as Env;
}

describe("TokenService", () => {
  it("signs and verifies a round-tripping access token", () => {
    const service = new TokenService(createEnv());
    const { token, expiresAtSeconds } = service.signAccessToken({ sub: "user-1", sid: "session-1", roles: ["CLIENT"] });

    expect(expiresAtSeconds).toBeGreaterThan(Date.now() / 1000);
    const claims = service.verifyAccessToken(token);
    expect(claims).toMatchObject({ sub: "user-1", sid: "session-1", roles: ["CLIENT"] });
  });

  it("signs and verifies a round-tripping refresh token carrying the token version", () => {
    const service = new TokenService(createEnv());
    const { token } = service.signRefreshToken({ sub: "user-1", sid: "session-1", rtv: 3 });
    const claims = service.verifyRefreshToken(token);
    expect(claims).toMatchObject({ sub: "user-1", sid: "session-1", rtv: 3 });
  });

  it("rejects a refresh token verified against the access secret (key separation)", () => {
    const service = new TokenService(createEnv());
    const { token } = service.signRefreshToken({ sub: "user-1", sid: "session-1", rtv: 0 });
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("rejects a token signed with a different secret", () => {
    const service = new TokenService(createEnv());
    const otherService = new TokenService(createEnv({ JWT_SECRET: "a-completely-different-secret" }));
    const { token } = otherService.signAccessToken({ sub: "user-1", sid: "session-1", roles: ["CLIENT"] });
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("remainingSeconds reports the time left on a freshly-signed token", () => {
    const service = new TokenService(createEnv({ JWT_ACCESS_TTL: "1h" }));
    const { token } = service.signAccessToken({ sub: "user-1", sid: "session-1", roles: ["CLIENT"] });
    const remaining = service.remainingSeconds(token);
    expect(remaining).toBeGreaterThan(3595);
    expect(remaining).toBeLessThanOrEqual(3600);
  });

  it("accepts only the algorithm it signs with (HS256), even with the right secret (audit 2026-09-21)", () => {
    const service = new TokenService(createEnv());
    const other = sign({ sub: "user-1", sid: "session-1", roles: ["ADMIN"] }, "access-secret-long-enough", { algorithm: "HS512" });
    expect(() => service.verifyAccessToken(other)).toThrow();
  });

  it("rejects an expired token", () => {
    // A negative TTL back-dates `exp` well into the past — avoids a millisecond-scale race
    // between signing and verifying that a near-zero positive TTL would risk.
    const service = new TokenService(createEnv({ JWT_ACCESS_TTL: "-10s" }));
    const { token } = service.signAccessToken({ sub: "user-1", sid: "session-1", roles: ["CLIENT"] });
    expect(() => service.verifyAccessToken(token)).toThrow(/jwt expired/);
  });
});
