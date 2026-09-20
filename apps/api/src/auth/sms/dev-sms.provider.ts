import { Injectable, Logger } from "@nestjs/common";

import type { SmsProvider } from "./sms-provider.interface.js";

/**
 * Dev-mode adapter — never sends a real SMS (01_SPEC_PRODUCT.md #118).
 * Never logs the message body: it may contain the OTP code, and OTPs must
 * never be logged (02_SPEC_ENGINEERING.md #178). The dev-mode convenience of
 * exposing the code to a developer happens one layer up, in `OtpService`
 * (only outside production, only via the API response, never via a logger).
 */
@Injectable()
export class DevSmsProvider implements SmsProvider {
  private readonly logger = new Logger(DevSmsProvider.name);

  send(phone: string, _message: string): Promise<void> {
    this.logger.log(`[dev-sms] OTP requested for ${redactPhone(phone)}`);
    return Promise.resolve();
  }
}

/** Keeps the country-code prefix and last 2 digits visible for debugging, masks the rest. */
function redactPhone(phone: string): string {
  if (phone.length <= 6) {
    return phone;
  }
  const prefix = phone.slice(0, 4);
  const suffix = phone.slice(-2);
  return `${prefix}${"*".repeat(phone.length - prefix.length - suffix.length)}${suffix}`;
}
