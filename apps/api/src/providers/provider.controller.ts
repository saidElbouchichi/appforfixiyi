import {
  CreateProviderProfileInputSchema,
  UpdateProviderAvailabilityInputSchema,
  UpdateProviderProfileInputSchema,
  type CreateProviderProfileInput,
  type ProviderProfile,
  type UpdateProviderAvailabilityInput,
  type UpdateProviderProfileInput,
} from "@fixiyi/contracts";
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { Roles } from "../auth/guards/roles.decorator.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { RateLimit } from "../auth/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../auth/rate-limit/rate-limit.guard.js";
import { AUTHENTICATED_READ_LIMIT } from "../auth/rate-limit/read-budget.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { ProviderService } from "./provider.service.js";

const PROVIDER_WRITE_LIMIT = {
  scope: "provider-write",
  limit: 30,
  windowSeconds: 60,
  key: "user",
} as const;

@ApiTags("providers")
@Controller("providers")
export class ProviderController {
  constructor(private readonly providers: ProviderService) {}

  @Get("me")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(AuthGuard, RateLimitGuard)
  async getMine(@CurrentUser() user: AuthenticatedUser): Promise<ProviderProfile> {
    const profile = await this.providers.getByUserId(user.id);
    if (!profile) {
      throw new NotFoundException("No provider profile yet — POST /providers/me to create one");
    }
    return profile;
  }

  @Post("me")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(PROVIDER_WRITE_LIMIT)
  @Roles("PROVIDER")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateProviderProfileInputSchema)) body: CreateProviderProfileInput,
  ): Promise<ProviderProfile> {
    return this.providers.create(user.id, body);
  }

  @Patch("me")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(PROVIDER_WRITE_LIMIT)
  @Roles("PROVIDER")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProviderProfileInputSchema)) body: UpdateProviderProfileInput,
  ): Promise<ProviderProfile> {
    return this.providers.update(user.id, body);
  }

  /** 01_SPEC_PRODUCT.md #16 — the provider drives their own work status; the matching engine only reads it. */
  @Patch("me/availability")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(PROVIDER_WRITE_LIMIT)
  @Roles("PROVIDER")
  updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProviderAvailabilityInputSchema))
    body: UpdateProviderAvailabilityInput,
  ): Promise<ProviderProfile> {
    return this.providers.updateAvailability(user.id, body);
  }
}
