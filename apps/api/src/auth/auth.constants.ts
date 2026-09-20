/**
 * Business-rule constants for the auth module (01_SPEC_PRODUCT.md #68-70,
 * 02_SPEC_ENGINEERING.md #152). Not deployment config, so not sourced from
 * env — only cross-environment secrets/URLs go through @fixiyi/config.
 */

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
export const OTP_REQUEST_COOLDOWN_SECONDS = 60;
export const OTP_MAX_REQUESTS_PER_PHONE_PER_HOUR = 5;
// A single public IP can legitimately front many users (NAT, corporate/campus
// wifi, carrier-grade NAT on mobile networks) — tight enough to stop OTP
// bombing, loose enough not to punish a busy shared connection.
export const OTP_MAX_REQUESTS_PER_IP_PER_HOUR = 60;

export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_VERIFICATION_TTL_SECONDS = 15 * 60;
export const EMAIL_MAX_VERIFY_ATTEMPTS = 5;
export const EMAIL_REQUEST_COOLDOWN_SECONDS = 60;
export const EMAIL_MAX_REQUESTS_PER_HOUR = 5;

export const AUTH_COOKIE_ACCESS = "fixiyi_at";
export const AUTH_COOKIE_REFRESH = "fixiyi_rt";
export const AUTH_COOKIE_CSRF = "fixiyi_csrf";
/** Scopes the refresh cookie to the routes that actually consume it (least exposure). */
export const AUTH_COOKIE_REFRESH_PATH = "/api/v1/auth";
