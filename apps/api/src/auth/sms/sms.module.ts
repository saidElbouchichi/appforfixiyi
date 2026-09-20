import type { Env } from "@fixiyi/config";
import { Module } from "@nestjs/common";

import { ENV } from "../../infrastructure/env.token.js";

import { DevSmsProvider } from "./dev-sms.provider.js";
import { SMS_PROVIDER, type SmsProvider } from "./sms-provider.interface.js";

/**
 * `SMS_PROVIDER=dev`/`fake` (see `.env.example`/`.env.test.example`) selects the
 * dev adapter. Any other value fails fast at bootstrap: no real gateway adapter
 * exists yet (Phase 2 scope) — never silently fall back to a fake send in a
 * configuration that claims to be real (03_AGENT_PROTOCOL.md #2).
 */
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): SmsProvider => {
        if (env.SMS_PROVIDER === "dev" || env.SMS_PROVIDER === "fake") {
          return new DevSmsProvider();
        }
        throw new Error(`Unsupported SMS_PROVIDER "${env.SMS_PROVIDER}" — no real adapter implemented yet.`);
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
