import {
  CreateCompanyInputSchema,
  InviteCompanyMemberInputSchema,
  type Company,
  type CompanyMember,
  type CreateCompanyInput,
  type InviteCompanyMemberInput,
} from "@fixiyi/contracts";
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { CompanyService } from "./company.service.js";

@ApiTags("companies")
@Controller("companies")
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get("mine")
  @UseGuards(AuthGuard)
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<Company[]> {
    return this.companies.listMine(user.id);
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateCompanyInputSchema)) body: CreateCompanyInput,
  ): Promise<Company> {
    return this.companies.create(user.id, body);
  }

  @Get(":id")
  getById(@Param("id") id: string): Promise<Company> {
    return this.companies.getById(id);
  }

  @Get(":id/members")
  @UseGuards(AuthGuard)
  listMembers(@Param("id") id: string): Promise<CompanyMember[]> {
    return this.companies.listMembers(id);
  }

  @Post(":id/members")
  @UseGuards(AuthGuard, CsrfGuard)
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(InviteCompanyMemberInputSchema)) body: InviteCompanyMemberInput,
  ): Promise<CompanyMember> {
    return this.companies.invite(id, user.id, body);
  }

  @Post(":id/members/me/accept")
  @UseGuards(AuthGuard, CsrfGuard)
  acceptInvite(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<CompanyMember> {
    return this.companies.acceptInvite(id, user.id);
  }

  @Delete(":id/members/:memberId")
  @UseGuards(AuthGuard, CsrfGuard)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ): Promise<{ success: true }> {
    await this.companies.removeMember(id, user.id, memberId);
    return { success: true };
  }
}
