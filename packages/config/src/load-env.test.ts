import { describe, expect, it } from "vitest";

import { InvalidEnvironmentError, loadEnv } from "./load-env.js";

const validEnv = {
  APP_URL: "http://localhost:3000",
  API_URL: "http://localhost:4000",
  DATABASE_URL: "mongodb://localhost:27017/fixiyi",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a-secret-that-is-long-enough",
  JWT_REFRESH_SECRET: "another-secret-that-is-long-enough",
  STORAGE_ENDPOINT: "http://localhost:9000",
  STORAGE_BUCKET: "fixiyi-dev",
  STORAGE_ACCESS_KEY: "minioadmin",
  STORAGE_SECRET: "minioadmin",
};

describe("loadEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    const env = loadEnv(validEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.API_VERSION).toBe("v1");
    expect(env.FF_AI_ENABLED).toBe(true);
    expect(env.FF_ONLINE_PAYMENT_ENABLED).toBe(false);
  });

  it("coerces feature flag strings to real booleans, not truthy strings", () => {
    const env = loadEnv({ ...validEnv, FF_ONLINE_PAYMENT_ENABLED: "true" });
    expect(env.FF_ONLINE_PAYMENT_ENABLED).toBe(true);
    const envFalse = loadEnv({ ...validEnv, FF_AI_ENABLED: "false" });
    expect(envFalse.FF_AI_ENABLED).toBe(false);
  });

  it("throws InvalidEnvironmentError with a readable report when required vars are missing", () => {
    expect(() => loadEnv({})).toThrow(InvalidEnvironmentError);
  });

  it("rejects a JWT secret that is too short", () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: "short" })).toThrow(InvalidEnvironmentError);
  });

  it("never invents a default for secrets or credentials (04_ENVIRONMENT.md)", () => {
    const { JWT_SECRET: _omit, ...withoutSecret } = validEnv;
    expect(() => loadEnv(withoutSecret)).toThrow();
  });
});
