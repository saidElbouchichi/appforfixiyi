import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { CompanyModule } from "../companies/company.module.js";
import { StorageModule } from "../infrastructure/storage/storage.module.js";
import { ProviderModule } from "../providers/provider.module.js";

import { VerificationCaseEntity, VerificationCaseEntitySchema } from "./schemas/verification-case.schema.js";
import { VerificationDecisionEntity, VerificationDecisionEntitySchema } from "./schemas/verification-decision.schema.js";
import { VerificationDocumentEntity, VerificationDocumentEntitySchema } from "./schemas/verification-document.schema.js";
import { VerificationController } from "./verification.controller.js";
import { VerificationService } from "./verification.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VerificationCaseEntity.name, schema: VerificationCaseEntitySchema },
      { name: VerificationDocumentEntity.name, schema: VerificationDocumentEntitySchema },
      { name: VerificationDecisionEntity.name, schema: VerificationDecisionEntitySchema },
    ]),
    AuthModule,
    ProviderModule,
    CompanyModule,
    StorageModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
