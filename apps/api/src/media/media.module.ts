import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { StorageModule } from "../infrastructure/storage/storage.module.js";

import { MediaService } from "./media.service.js";
import { MediaEntity, MediaEntitySchema } from "./schemas/media.schema.js";

/** No controller — a reusable pipeline consumed by richer domain modules (currently `RequestModule`), same shape as `StorageService`. */
@Module({
  imports: [MongooseModule.forFeature([{ name: MediaEntity.name, schema: MediaEntitySchema }]), StorageModule],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
