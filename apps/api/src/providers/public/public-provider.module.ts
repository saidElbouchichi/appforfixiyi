import { Module } from "@nestjs/common";

import { VerificationModule } from "../../verification/verification.module.js";
import { ProviderModule } from "../provider.module.js";

import { PublicProviderController } from "./public-provider.controller.js";
import { PublicProviderService } from "./public-provider.service.js";

/** See `PublicProviderService`: a read model over two domains, so the import graph stays acyclic. */
@Module({
  imports: [ProviderModule, VerificationModule],
  controllers: [PublicProviderController],
  providers: [PublicProviderService],
})
export class PublicProviderModule {}
