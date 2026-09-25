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

/**
 * Keys the schema accepts although nothing reads them yet, each waiting for
 * the phase that will (Decision 73). `env-usage.test.ts` fails when a key is
 * neither read nor listed here — and fails again when a listed key finally
 * becomes used and is not removed from the list.
 *
 * Everything that did NOT earn a place here was removed instead: a
 * credential for a provider that does not exist, or a switch that switches
 * nothing, reads as configuration and is not. `STORAGE_PROVIDER=fake` was
 * exactly that, and it hid a missing MinIO from CI.
 */
export const RESERVED_ENV_KEYS: readonly string[] = [
  /** Phase 4 of the product spec's data plan — no separate test database is wired yet. */
  "DATABASE_TEST_URL",
  /**
   * AI features — no AI service exists, and its flag gates nothing yet
   * either. The audit of 2026-09-23 first counted both flags as "used"; they
   * are not read anywhere outside this package, which is why this list is a
   * test and not a note.
   */
  "AI_PROVIDER",
  "AI_MODEL_DEFAULT",
  "FF_AI_ENABLED",
  /** Online payment, Phase 9. */
  "PAYMENT_PROVIDER",
  "FF_ONLINE_PAYMENT_ENABLED",
  /** Mobile app, Phase 13 (Decision 12). */
  "FF_MOBILE_ENABLED",
];

const SIGNING_SECRETS = ["JWT_SECRET", "JWT_REFRESH_SECRET", "OTP_SECRET"] as const;

/** Markers of the public example values shipped in `.env.example` / `.env.test.example`. */
const PUBLIC_SECRET_MARKERS = ["CHANGE_ME", "not_for_production"];

const PRODUCTION_SECRET_MIN_LENGTH = 32;

const BaseEnvSchema = z.object({
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

  EMAIL_PROVIDER: z.string().min(1).default("dev"),

  /** Selects the object-storage adapter. Only `minio` exists; `StorageModule` throws on anything else (Decision 73). */
  STORAGE_PROVIDER: z.string().min(1).default("minio"),
  STORAGE_ENDPOINT: z.url(),
  /** Only needed when STORAGE_ENDPOINT is an internal/service-network hostname (e.g. Docker's `http://minio:9000`) that an external browser can't resolve — presigned URLs must be signed against a client-reachable host instead. Defaults to STORAGE_ENDPOINT (the common case: both are already the same public host). */
  STORAGE_PUBLIC_ENDPOINT: z.url().optional(),
  STORAGE_REGION: z.string().min(1).default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET: z.string().min(1),

  /** Reserved — no AI service exists yet (see RESERVED_ENV_KEYS). */
  AI_PROVIDER: z.string().min(1).default("dev"),
  /** Reserved — see RESERVED_ENV_KEYS. */
  AI_MODEL_DEFAULT: z.string().default(""),

  /** Reserved — payments are a later phase (see RESERVED_ENV_KEYS). */
  PAYMENT_PROVIDER: z.string().min(1).default("sandbox"),

  MAP_PROVIDER: z.string().min(1).default("dev"),

  /** Reserved — see RESERVED_ENV_KEYS. */
  FF_AI_ENABLED: booleanFlag("true"),
  /** Reserved — see RESERVED_ENV_KEYS. */
  FF_ONLINE_PAYMENT_ENABLED: booleanFlag("false"),
  /** Reserved — the mobile app is a later phase (see RESERVED_ENV_KEYS). */
  FF_MOBILE_ENABLED: booleanFlag("false"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),
});

/**
 * In production, a signing secret must be private and strong: anyone who
 * knows the value committed in `.env.example` could forge access tokens for
 * any user or role (audit 2026-09-21). Development stays permissive, so the
 * example file still boots a local stack.
 */
export const EnvSchema = BaseEnvSchema.superRefine((env, context) => {
  if (env.NODE_ENV !== "production") {
    return;
  }
  for (const name of SIGNING_SECRETS) {
    const value = env[name];
    if (PUBLIC_SECRET_MARKERS.some((marker) => value.includes(marker))) {
      context.addIssue({
        code: "custom",
        path: [name],
        message: `${name} is a public example value; generate one with \`openssl rand -hex 32\``,
      });
    } else if (value.length < PRODUCTION_SECRET_MIN_LENGTH) {
      context.addIssue({
        code: "custom",
        path: [name],
        message: `${name} must be at least ${PRODUCTION_SECRET_MIN_LENGTH.toString()} characters in production`,
      });
    }
  }
  if (new Set(SIGNING_SECRETS.map((name) => env[name])).size !== SIGNING_SECRETS.length) {
    context.addIssue({
      code: "custom",
      path: ["JWT_REFRESH_SECRET"],
      message: "JWT_SECRET, JWT_REFRESH_SECRET and OTP_SECRET must be distinct in production",
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;
