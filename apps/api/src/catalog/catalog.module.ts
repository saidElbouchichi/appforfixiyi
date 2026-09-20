import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { SeedLockModule } from "../common/seed/seed-lock.module.js";

import { CatalogController } from "./catalog.controller.js";
import { CatalogSeedService } from "./catalog.seed.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogNodeEntity, CatalogNodeEntitySchema } from "./schemas/catalog-node.schema.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: CatalogNodeEntity.name, schema: CatalogNodeEntitySchema }]), AuthModule, SeedLockModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogSeedService],
  exports: [CatalogService],
})
export class CatalogModule {}
