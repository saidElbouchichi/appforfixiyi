import {
  CreateCatalogNodeInputSchema,
  UpdateCatalogNodeInputSchema,
  type CatalogLevel,
  type CatalogNode,
  type CatalogTreeNode,
  type CreateCatalogNodeInput,
  type UpdateCatalogNodeInput,
} from "@fixiyi/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { Roles } from "../auth/guards/roles.decorator.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { RateLimit } from "../auth/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../auth/rate-limit/rate-limit.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { CatalogService } from "./catalog.service.js";

const CATALOG_LEVELS = [
  "DOMAIN",
  "CATEGORY",
  "SERVICE",
  "INTERVENTION_TYPE",
  "COMPLEXITY",
  "SKILL",
];

/** Back-office catalogue edits: generous for an operator, bounded for a stolen token. */
const CATALOG_WRITE_LIMIT = {
  scope: "catalog-write",
  limit: 60,
  windowSeconds: 60,
  key: "user",
} as const;

/**
 * Decision 72 — the catalogue is reference data, not personal, and every
 * screen reads it (home grid, search, request form, name resolution). The
 * budget is wider than the personal-data one for that reason: it exists to
 * bound anonymous load, not to protect a secret.
 */
export const CATALOG_PUBLIC_READ_LIMIT = {
  scope: "catalog-public-read",
  limit: 600,
  windowSeconds: 600,
  key: "ip",
} as const;

@ApiTags("catalog")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("tree")
  @RateLimit(CATALOG_PUBLIC_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  getTree(@Query("includeInactive") includeInactive?: string, @Query("rawDisplay") rawDisplay?: string): Promise<CatalogTreeNode[]> {
    return this.catalog.getTree(includeInactive === "true", rawDisplay === "true");
  }

  @Get("skills")
  @RateLimit(CATALOG_PUBLIC_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  listSkills(@Query("includeInactive") includeInactive?: string): Promise<CatalogNode[]> {
    return this.catalog.listByLevel("SKILL", undefined, includeInactive === "true");
  }

  @Get("nodes")
  @RateLimit(CATALOG_PUBLIC_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  listByLevel(
    @Query("level") level: string,
    @Query("parentId") parentId?: string,
    @Query("includeInactive") includeInactive?: string,
  ): Promise<CatalogNode[]> {
    if (!CATALOG_LEVELS.includes(level)) {
      throw new BadRequestException(`level must be one of: ${CATALOG_LEVELS.join(", ")}`);
    }
    return this.catalog.listByLevel(level as CatalogLevel, parentId, includeInactive === "true");
  }

  @Post("nodes")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(CATALOG_WRITE_LIMIT)
  @Roles("ADMIN", "MANAGER")
  create(
    @Body(new ZodValidationPipe(CreateCatalogNodeInputSchema)) body: CreateCatalogNodeInput,
  ): Promise<CatalogNode> {
    return this.catalog.create(body);
  }

  @Patch("nodes/:id")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(CATALOG_WRITE_LIMIT)
  @Roles("ADMIN", "MANAGER")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCatalogNodeInputSchema)) body: UpdateCatalogNodeInput,
  ): Promise<CatalogNode> {
    return this.catalog.update(id, body);
  }

  @Delete("nodes/:id")
  @UseGuards(AuthGuard, RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(CATALOG_WRITE_LIMIT)
  @Roles("ADMIN", "MANAGER")
  async deactivate(@Param("id") id: string): Promise<{ success: true }> {
    await this.catalog.deactivate(id);
    return { success: true };
  }
}
