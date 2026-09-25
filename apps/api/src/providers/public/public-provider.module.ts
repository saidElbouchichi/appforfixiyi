import { Module } from "@nestjs/common";

import { AuthModule } from "../../auth/auth.module.js";
import { VerificationModule } from "../../verification/verification.module.js";
import { ProviderModule } from "../provider.module.js";

import { PublicProviderController } from "./public-provider.controller.js";
import { PublicProviderService } from "./public-provider.service.js";

/** See `PublicProviderService`: a read model over two domains, so the import graph stays acyclic. */
@Module({
  // AuthModule for `RateLimitGuard` and its service (Decision 72) — the route stays unauthenticated.
  imports: [AuthModule, ProviderModule, VerificationModule],
  controllers: [PublicProviderController],
  providers: [PublicProviderService],
})
export class PublicProviderModule {}
