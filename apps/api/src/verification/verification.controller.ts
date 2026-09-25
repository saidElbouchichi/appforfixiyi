import {
  CreateVerificationCaseInputSchema,
  RequestDocumentUploadInputSchema,
  SubmitVerificationDecisionInputSchema,
  type CreateVerificationCaseInput,
  type RequestDocumentUploadInput,
  type RequestDocumentUploadOutput,
  type SubmitVerificationDecisionInput,
  type VerificationCase,
  type VerificationDecision,
  type VerificationDocument,
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
import { AUTHENTICATED_READ_LIMIT } from "../auth/rate-limit/read-budget.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { VerificationService } from "./verification.service.js";

const VERIFICATION_WRITE_LIMIT = {
  scope: "verification-write",
  limit: 20,
  windowSeconds: 60,
  key: "user",
} as const;

@ApiTags("verification")
@Controller("verification")
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post("cases")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(VERIFICATION_WRITE_LIMIT)
  createCase(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateVerificationCaseInputSchema))
    body: CreateVerificationCaseInput,
  ): Promise<VerificationCase> {
    return this.verification.getOrCreateCase(body.targetType, body.targetId, user.id);
  }

  @Get("cases/:id")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  getCase(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<VerificationCase> {
    return this.verification.getById(id, user.id, user.roles);
  }

  @Get("cases/:id/documents")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<VerificationDocument[]> {
    return this.verification.listDocuments(id, user.id, user.roles);
  }

  @Post("cases/:id/documents")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(VERIFICATION_WRITE_LIMIT)
  requestDocumentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RequestDocumentUploadInputSchema)) body: RequestDocumentUploadInput,
  ): Promise<RequestDocumentUploadOutput> {
    return this.verification.requestDocumentUpload(id, user.id, body);
  }

  @Post("documents/:documentId/confirm")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(VERIFICATION_WRITE_LIMIT)
  confirmDocumentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("documentId") documentId: string,
  ): Promise<VerificationDocument> {
    return this.verification.confirmDocumentUpload(documentId, user.id);
  }

  @Post("cases/:id/submit")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(VERIFICATION_WRITE_LIMIT)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<VerificationCase> {
    return this.verification.submit(id, user.id);
  }

  @Get("cases/:id/decisions")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  listDecisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<VerificationDecision[]> {
    return this.verification.listDecisions(id, user.id, user.roles);
  }

  @Post("cases/:id/decisions")
  @UseGuards(RolesGuard, CsrfGuard, RateLimitGuard)
  @RateLimit(VERIFICATION_WRITE_LIMIT)
  @Roles("VERIFICATION_AGENT", "ADMIN")
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SubmitVerificationDecisionInputSchema))
    body: SubmitVerificationDecisionInput,
  ): Promise<VerificationCase> {
    return this.verification.decide(id, user.id, body);
  }
}
