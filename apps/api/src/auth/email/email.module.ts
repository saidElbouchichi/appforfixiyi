import type { Env } from "@fixiyi/config";
import { Module } from "@nestjs/common";

import { ENV } from "../../infrastructure/env.token.js";

import { DevEmailProvider } from "./dev-email.provider.js";
import { EMAIL_PROVIDER, type EmailProvider } from "./email-provider.interface.js";

/** Same fail-fast-on-unknown-provider policy as `SmsModule` — see its comment. */
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): EmailProvider => {
        if (env.EMAIL_PROVIDER === "dev" || env.EMAIL_PROVIDER === "fake") {
          return new DevEmailProvider();
        }
        throw new Error(`Unsupported EMAIL_PROVIDER "${env.EMAIL_PROVIDER}" — no real adapter implemented yet.`);
      },
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
