import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";

import { ProviderController } from "./provider.controller.js";
import { ProviderService } from "./provider.service.js";
import { ProviderProfileEntity, ProviderProfileEntitySchema } from "./schemas/provider-profile.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProviderProfileEntity.name, schema: ProviderProfileEntitySchema }]),
    AuthModule,
    CatalogModule,
  ],
  controllers: [ProviderController],
  providers: [ProviderService],
  exports: [ProviderService],
})
export class ProviderModule {}
