import { describe, expect, it } from "vitest";

import { InvalidEnvironmentError, loadEnv } from "./load-env.js";

const validEnv = {
  APP_URL: "http://localhost:3000",
  API_URL: "http://localhost:4000",
  DATABASE_URL: "mongodb://localhost:27017/fixiyi",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a-secret-that-is-long-enough",
  JWT_REFRESH_SECRET: "another-secret-that-is-long-enough",
  OTP_SECRET: "a-third-secret-that-is-long-enough",
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
    expect(env.MIN_PROVIDER_AGE).toBe(18);
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

  it("rejects an OTP secret that is too short", () => {
    expect(() => loadEnv({ ...validEnv, OTP_SECRET: "short" })).toThrow(InvalidEnvironmentError);
  });

  describe("production secrets (audit 2026-09-21)", () => {
    const strong = {
      JWT_SECRET: "9f3c1a7e5b2d8f4a6c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d2f4a",
      JWT_REFRESH_SECRET: "1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d2f4a9f3c1a7e5b2d8f4a6c0e",
      OTP_SECRET: "a6c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d2f4a9f3c1a7e5b2d8f4",
    };
    const production = { ...validEnv, ...strong, NODE_ENV: "production" };

    it("accepts strong, distinct secrets", () => {
      expect(loadEnv(production).NODE_ENV).toBe("production");
    });

    it("refuses the public placeholder of .env.example in production", () => {
      expect(() => loadEnv({ ...production, JWT_SECRET: "CHANGE_ME_GENERATE_WITH_openssl_rand_hex_32" })).toThrow(/JWT_SECRET/);
    });

    it("refuses the test secrets of .env.test.example in production", () => {
      expect(() => loadEnv({ ...production, OTP_SECRET: "test_otp_secret_not_for_production_do_not_use" })).toThrow(/OTP_SECRET/);
    });

    it("refuses a secret shorter than 32 characters in production", () => {
      expect(() => loadEnv({ ...production, JWT_REFRESH_SECRET: "sixteen-chars-ok-in-dev" })).toThrow(/JWT_REFRESH_SECRET/);
    });

    it("refuses the same value for two secrets in production", () => {
      expect(() => loadEnv({ ...production, JWT_REFRESH_SECRET: strong.JWT_SECRET })).toThrow(/distinct/);
    });

    it("keeps development permissive: placeholders still boot locally", () => {
      const placeholder = "CHANGE_ME_GENERATE_WITH_openssl_rand_hex_32";
      expect(loadEnv({ ...validEnv, JWT_SECRET: placeholder, JWT_REFRESH_SECRET: placeholder, OTP_SECRET: placeholder }).NODE_ENV).toBe("development");
    });
  });

  it("coerces MIN_PROVIDER_AGE to a number", () => {
    const env = loadEnv({ ...validEnv, MIN_PROVIDER_AGE: "21" });
    expect(env.MIN_PROVIDER_AGE).toBe(21);
  });

  it("never invents a default for secrets or credentials (04_ENVIRONMENT.md)", () => {
    const { JWT_SECRET: _omit, ...withoutSecret } = validEnv;
    expect(() => loadEnv(withoutSecret)).toThrow();
  });
});
