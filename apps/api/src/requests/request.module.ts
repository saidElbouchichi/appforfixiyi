import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { MediaModule } from "../media/media.module.js";

import { RequestController } from "./request.controller.js";
import { RequestService } from "./request.service.js";
import { ServiceRequestEntity, ServiceRequestEntitySchema } from "./schemas/service-request.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ServiceRequestEntity.name, schema: ServiceRequestEntitySchema }]),
    AuthModule,
    CatalogModule,
    MediaModule,
  ],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}
