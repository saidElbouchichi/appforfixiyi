import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { SeedLockModule } from "../common/seed/seed-lock.module.js";

import { ConfigurationController } from "./configuration.controller.js";
import { ConfigurationService } from "./configuration.service.js";
import { SystemConfigurationEntity, SystemConfigurationEntitySchema } from "./schemas/system-configuration.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SystemConfigurationEntity.name, schema: SystemConfigurationEntitySchema }]),
    AuthModule,
    SeedLockModule,
  ],
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
