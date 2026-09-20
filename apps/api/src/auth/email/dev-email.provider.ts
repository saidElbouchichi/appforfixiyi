import { Injectable, Logger } from "@nestjs/common";

import type { EmailProvider } from "./email-provider.interface.js";

/**
 * Dev-mode adapter — never sends a real email (01_SPEC_PRODUCT.md #118).
 * Never logs the body: it may contain the verification code, and
 * verification codes must never be logged (02_SPEC_ENGINEERING.md #178).
 */
@Injectable()
export class DevEmailProvider implements EmailProvider {
  private readonly logger = new Logger(DevEmailProvider.name);

  send(to: string, subject: string, _body: string): Promise<void> {
    this.logger.log(`[dev-email] "${subject}" requested for ${redactEmail(to)}`);
    return Promise.resolve();
  }
}

/** Keeps the domain visible for debugging, masks the local part. */
function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "***";
  }
  return `${local.slice(0, 1)}***@${domain}`;
}
