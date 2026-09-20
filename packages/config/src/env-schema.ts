import { z } from "zod";

/**
 * All application configuration must be administrable / validated, never
 * assumed (01_SPEC_PRODUCT.md #97). Booting with an invalid environment
 * must fail fast and loud rather than run with silently wrong defaults.
 */
const booleanFlag = (defaultValue: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("Fixiyi"),
  APP_URL: z.url(),
  API_URL: z.url(),
  API_VERSION: z.string().min(1).default("v1"),

  DATABASE_URL: z.url(),
  DATABASE_TEST_URL: z.url().optional(),

  REDIS_URL: z.url(),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_TTL: z.string().min(1).default("30d"),
  OTP_SECRET: z.string().min(16, "OTP_SECRET must be at least 16 characters"),
  MIN_PROVIDER_AGE: z.coerce.number().int().min(0).default(18),

  SMS_PROVIDER: z.string().min(1).default("dev"),
  SMS_PROVIDER_KEY: z.string().default(""),
  SMS_PROVIDER_SENDER: z.string().default(""),

  EMAIL_PROVIDER: z.string().min(1).default("dev"),
  EMAIL_PROVIDER_KEY: z.string().default(""),
  EMAIL_PROVIDER_FROM: z.email().default("noreply@fixiyi.local"),

  STORAGE_PROVIDER: z.string().min(1).default("minio"),
  STORAGE_ENDPOINT: z.url(),
  /** Only needed when STORAGE_ENDPOINT is an internal/service-network hostname (e.g. Docker's `http://minio:9000`) that an external browser can't resolve — presigned URLs must be signed against a client-reachable host instead. Defaults to STORAGE_ENDPOINT (the common case: both are already the same public host). */
  STORAGE_PUBLIC_ENDPOINT: z.url().optional(),
  STORAGE_REGION: z.string().min(1).default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET: z.string().min(1),

  AI_PROVIDER: z.string().min(1).default("dev"),
  AI_PROVIDER_KEY: z.string().default(""),
  AI_MODEL_DEFAULT: z.string().default(""),

  PAYMENT_PROVIDER: z.string().min(1).default("sandbox"),
  PAYMENT_PROVIDER_KEY: z.string().default(""),

  MAP_PROVIDER: z.string().min(1).default("dev"),
  MAP_PROVIDER_KEY: z.string().default(""),

  FF_AI_ENABLED: booleanFlag("true"),
  FF_ONLINE_PAYMENT_ENABLED: booleanFlag("false"),
  FF_MOBILE_ENABLED: booleanFlag("false"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),
  OTEL_ENABLED: booleanFlag("false"),
});

export type Env = z.infer<typeof EnvSchema>;
