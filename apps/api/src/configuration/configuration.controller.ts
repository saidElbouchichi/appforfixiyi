import {
  UpdateSystemConfigurationInputSchema,
  type SystemConfiguration,
  type UpdateSystemConfigurationInput,
} from "@fixiyi/contracts";
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
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

import { ConfigurationService } from "./configuration.service.js";

const CONFIGURATION_WRITE_LIMIT = {
  scope: "configuration-write",
  limit: 20,
  windowSeconds: 60,
  key: "user",
} as const;

/**
 * Administrable, not public: these weights and thresholds describe how the
 * marketplace ranks providers, so they are readable and writable by
 * ADMIN/MANAGER only. The matching engine reads them through the service,
 * never through HTTP. No admin screen yet — the dashboard is Phase 12
 * (06_SCOPE.md).
 */
@ApiTags("configuration")
@Controller("configuration")
@UseGuards(AuthGuard, RolesGuard)
@Roles("ADMIN", "MANAGER")
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  get(): Promise<SystemConfiguration> {
    return this.configuration.get();
  }

  @Patch()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(CONFIGURATION_WRITE_LIMIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateSystemConfigurationInputSchema))
    body: UpdateSystemConfigurationInput,
  ): Promise<SystemConfiguration> {
    return this.configuration.update(body, user.id);
  }
}
