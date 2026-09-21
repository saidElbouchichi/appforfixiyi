import {
  DeclineMatchInputSchema,
  ExpandRadiusInputSchema,
  StartMatchInputSchema,
  type DeclineMatchInput,
  type ExpandRadiusInput,
  type Match,
  type MatchCandidate,
  type ProviderMatch,
  type StartMatchInput,
} from "@fixiyi/contracts";
import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { Roles } from "../auth/guards/roles.decorator.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { RateLimit } from "../auth/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../auth/rate-limit/rate-limit.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { MatchingService } from "./matching.service.js";

/** A dispatch queries providers and schedules jobs: the costliest client action. */
const DISPATCH_LIMIT = {
  scope: "matching-dispatch",
  limit: 10,
  windowSeconds: 60,
  key: "user",
} as const;
const CANDIDATE_LIMIT = {
  scope: "matching-candidate",
  limit: 60,
  windowSeconds: 60,
  key: "user",
} as const;

/**
 * Two audiences, deliberately split into two route groups with two
 * different DTOs: the client sees who was contacted and why (scores), the
 * provider sees only their own dispatch and only an approximate location
 * (01_SPEC_PRODUCT.md #17).
 */
@ApiTags("matching")
@Controller()
@UseGuards(AuthGuard)
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post("requests/:id/match")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(DISPATCH_LIMIT)
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(StartMatchInputSchema)) body: StartMatchInput,
  ): Promise<Match> {
    return this.matching.start(id, user.id, body);
  }

  @Get("requests/:id/match")
  getByRequest(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<Match> {
    return this.matching.getByRequest(id, user.id);
  }

  @Get("requests/:id/match/candidates")
  listCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<MatchCandidate[]> {
    return this.matching.listCandidates(id, user.id);
  }

  @Post("requests/:id/match/expand-radius")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(DISPATCH_LIMIT)
  expandRadius(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ExpandRadiusInputSchema)) body: ExpandRadiusInput,
  ): Promise<Match> {
    return this.matching.expandRadius(id, user.id, body);
  }

  @Get("matches/mine")
  @UseGuards(RolesGuard)
  @Roles("PROVIDER")
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<ProviderMatch[]> {
    return this.matching.listForProvider(user.id);
  }

  @Post("matches/candidates/:candidateId/view")
  @UseGuards(RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(CANDIDATE_LIMIT)
  @Roles("PROVIDER")
  markViewed(
    @CurrentUser() user: AuthenticatedUser,
    @Param("candidateId") candidateId: string,
  ): Promise<ProviderMatch> {
    return this.matching.markViewed(candidateId, user.id);
  }

  @Post("matches/candidates/:candidateId/decline")
  @UseGuards(RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(CANDIDATE_LIMIT)
  @Roles("PROVIDER")
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("candidateId") candidateId: string,
    @Body(new ZodValidationPipe(DeclineMatchInputSchema)) body: DeclineMatchInput,
  ): Promise<{ success: true }> {
    return this.matching.decline(candidateId, user.id, body);
  }
}
