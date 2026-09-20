import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { SeedLockEntity, SeedLockEntitySchema } from "./seed-lock.schema.js";
import { SeedLockService } from "./seed-lock.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: SeedLockEntity.name, schema: SeedLockEntitySchema }])],
  providers: [SeedLockService],
  exports: [SeedLockService],
})
export class SeedLockModule {}
