import type { PublicProviderProfile } from "@fixiyi/contracts";
import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { PublicProviderService } from "./public-provider.service.js";

/**
 * `GET /providers/:id` — public, and deliberately poorer than
 * `GET /providers/me` (Decision 70). Fastify matches the static `me` of
 * `ProviderController` before this parameter, whatever the registration
 * order.
 */
@ApiTags("providers")
@Controller("providers")
export class PublicProviderController {
  constructor(private readonly publicProviders: PublicProviderService) {}

  @Get(":id")
  getById(@Param("id") id: string): Promise<PublicProviderProfile> {
    return this.publicProviders.getById(id);
  }
}
