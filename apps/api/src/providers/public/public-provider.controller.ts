import type { PublicProviderProfile } from "@fixiyi/contracts";
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RateLimit } from "../../auth/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../../auth/rate-limit/rate-limit.guard.js";

import { PublicProviderService } from "./public-provider.service.js";

/**
 * Decision 72. Keyed by IP because there is no account to key it by, and
 * deliberately generous: behind a carrier-grade NAT a whole neighbourhood
 * shares one address, so a budget tight enough to stop a determined scraper
 * would lock out real users first.
 *
 * What it buys: it bounds scraping of profiles whose ids leaked, and the
 * unauthenticated load one client can put on the database. What it does NOT
 * need to buy is protection against blind enumeration — ids are UUIDv7
 * (74 random bits), so walking the id space is not a thing.
 */
export const PROVIDER_PUBLIC_READ_LIMIT = {
  scope: "provider-public-read",
  limit: 120,
  windowSeconds: 600,
  key: "ip",
} as const;

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
  @RateLimit(PROVIDER_PUBLIC_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  getById(@Param("id") id: string): Promise<PublicProviderProfile> {
    return this.publicProviders.getById(id);
  }
}
