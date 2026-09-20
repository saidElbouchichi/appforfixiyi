import { UpdateSystemConfigurationInputSchema, type SystemConfiguration, type UpdateSystemConfigurationInput } from "@fixiyi/contracts";
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { Roles } from "../auth/guards/roles.decorator.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { ConfigurationService } from "./configuration.service.js";

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
  get(): Promise<SystemConfiguration> {
    return this.configuration.get();
  }

  @Patch()
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateSystemConfigurationInputSchema)) body: UpdateSystemConfigurationInput,
  ): Promise<SystemConfiguration> {
    return this.configuration.update(body, user.id);
  }
}
