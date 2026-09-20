import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module.js";
import { UserEntity, UserEntitySchema } from "../auth/schemas/user.schema.js";

import { CompanyController } from "./company.controller.js";
import { CompanyService } from "./company.service.js";
import { CompanyMemberEntity, CompanyMemberEntitySchema } from "./schemas/company-member.schema.js";
import { CompanyEntity, CompanyEntitySchema } from "./schemas/company.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyEntity.name, schema: CompanyEntitySchema },
      { name: CompanyMemberEntity.name, schema: CompanyMemberEntitySchema },
      { name: UserEntity.name, schema: UserEntitySchema },
    ]),
    AuthModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
