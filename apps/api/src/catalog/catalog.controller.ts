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

@ApiTags("catalog")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("tree")
  getTree(@Query("includeInactive") includeInactive?: string, @Query("rawDisplay") rawDisplay?: string): Promise<CatalogTreeNode[]> {
    return this.catalog.getTree(includeInactive === "true", rawDisplay === "true");
  }

  @Get("skills")
  listSkills(@Query("includeInactive") includeInactive?: string): Promise<CatalogNode[]> {
    return this.catalog.listByLevel("SKILL", undefined, includeInactive === "true");
  }

  @Get("nodes")
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
