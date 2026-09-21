import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CsrfGuard } from "./csrf/csrf.guard.js";
import { CsrfService } from "./csrf/csrf.service.js";
import { EmailModule } from "./email/email.module.js";
import { AuthGuard } from "./guards/auth.guard.js";
import { ResourceOwnerGuard } from "./guards/resource-owner.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { OtpService } from "./otp/otp.service.js";
import { RateLimitGuard } from "./rate-limit/rate-limit.guard.js";
import { RateLimitService } from "./rate-limit/rate-limit.service.js";
import { DeviceEntity, DeviceEntitySchema } from "./schemas/device.schema.js";
import { UserSessionEntity, UserSessionEntitySchema } from "./schemas/user-session.schema.js";
import { UserEntity, UserEntitySchema } from "./schemas/user.schema.js";
import { SessionService } from "./session/session.service.js";
import { SmsModule } from "./sms/sms.module.js";
import { TokenService } from "./token/token.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserEntity.name, schema: UserEntitySchema },
      { name: DeviceEntity.name, schema: DeviceEntitySchema },
      { name: UserSessionEntity.name, schema: UserSessionEntitySchema },
    ]),
    SmsModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    TokenService,
    CsrfService,
    RateLimitService,
    AuthGuard,
    RolesGuard,
    ResourceOwnerGuard,
    CsrfGuard,
    RateLimitGuard,
  ],
  // Guards are exported so other modules (catalog, providers, companies, verification, ...)
  // can protect their own routes with `@UseGuards(AuthGuard, RolesGuard, CsrfGuard)`. Their
  // own constructor dependencies must ALSO be exported — Nest resolves a guard referenced by
  // class in @UseGuards() against the *consuming* module's reachable providers, not just
  // AuthModule's (verified: omitting these throws "Nest can't resolve dependencies of the
  // AuthGuard ... TokenService ... is available in the CatalogModule module").
  exports: [AuthGuard, RolesGuard, ResourceOwnerGuard, CsrfGuard, RateLimitGuard, RateLimitService, TokenService, SessionService, CsrfService],
})
export class AuthModule {}
