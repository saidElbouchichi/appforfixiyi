import {
  CreateProviderProfileInputSchema,
  UpdateProviderProfileInputSchema,
  type CreateProviderProfileInput,
  type ProviderProfile,
  type UpdateProviderProfileInput,
} from "@fixiyi/contracts";
import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { Roles } from "../auth/guards/roles.decorator.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { ProviderService } from "./provider.service.js";

@ApiTags("providers")
@Controller("providers")
export class ProviderController {
  constructor(private readonly providers: ProviderService) {}

  @Get("me")
  @UseGuards(AuthGuard)
  async getMine(@CurrentUser() user: AuthenticatedUser): Promise<ProviderProfile> {
    const profile = await this.providers.getByUserId(user.id);
    if (!profile) {
      throw new NotFoundException("No provider profile yet — POST /providers/me to create one");
    }
    return profile;
  }

  @Post("me")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard)
  @Roles("PROVIDER")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateProviderProfileInputSchema)) body: CreateProviderProfileInput,
  ): Promise<ProviderProfile> {
    return this.providers.create(user.id, body);
  }

  @Patch("me")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard)
  @Roles("PROVIDER")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProviderProfileInputSchema)) body: UpdateProviderProfileInput,
  ): Promise<ProviderProfile> {
    return this.providers.update(user.id, body);
  }

  @Get(":id")
  getById(@Param("id") id: string): Promise<ProviderProfile> {
    return this.providers.getById(id);
  }
}
