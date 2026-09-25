import {
  CreateTargetMediaUploadSessionInputSchema,
  UpdateServiceRequestInputSchema,
  type CreateTargetMediaUploadSessionInput,
  type CreateUploadSessionOutput,
  type Media,
  type ServiceRequest,
  type UpdateServiceRequestInput,
  RequestListQuerySchema,
  type RequestListQuery,
  type ServiceRequestPage,
} from "@fixiyi/contracts";
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { RateLimit } from "../auth/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../auth/rate-limit/rate-limit.guard.js";
import { AUTHENTICATED_READ_LIMIT } from "../auth/rate-limit/read-budget.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { RequestService } from "./request.service.js";

/** Inspection finding B2 (2026-09-21), fixed in the audit: request routes had no rate limit. */
const REQUEST_WRITE_LIMIT = {
  scope: "request-write",
  limit: 30,
  windowSeconds: 60,
  key: "user",
} as const;
const REQUEST_UPLOAD_LIMIT = {
  scope: "request-upload",
  limit: 20,
  windowSeconds: 60,
  key: "user",
} as const;

/**
 * Media upload/finalize routes live here (not on a standalone media
 * controller) so ownership + editability of the parent request is
 * validated in one place (`RequestService`) before any pipeline step runs
 * — mirrors how `VerificationController` owns its document routes rather
 * than a separate `DocumentController`.
 */
@ApiTags("requests")
@Controller("requests")
@UseGuards(AuthGuard)
export class RequestController {
  constructor(private readonly requests: RequestService) {}

  @Post()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(REQUEST_WRITE_LIMIT)
  create(@CurrentUser() user: AuthenticatedUser): Promise<ServiceRequest> {
    return this.requests.create(user.id);
  }

  @Get("mine")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(RequestListQuerySchema)) query: RequestListQuery,
  ): Promise<ServiceRequestPage> {
    return this.requests.listMine(user.id, query);
  }

  @Get(":id")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ServiceRequest> {
    return this.requests.getById(id, user.id);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(REQUEST_WRITE_LIMIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateServiceRequestInputSchema)) body: UpdateServiceRequestInput,
  ): Promise<ServiceRequest> {
    return this.requests.update(id, user.id, body);
  }

  @Post(":id/media")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(REQUEST_UPLOAD_LIMIT)
  createMediaUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateTargetMediaUploadSessionInputSchema))
    body: CreateTargetMediaUploadSessionInput,
  ): Promise<CreateUploadSessionOutput> {
    return this.requests.createMediaUploadSession(id, user.id, body);
  }

  @Get(":id/media")
  @RateLimit(AUTHENTICATED_READ_LIMIT)
  @UseGuards(RateLimitGuard)
  listMedia(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<Media[]> {
    return this.requests.listMedia(id, user.id);
  }

  @Post(":id/media/:mediaId/finalize")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(REQUEST_UPLOAD_LIMIT)
  finalizeMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
  ): Promise<Media> {
    return this.requests.finalizeMedia(id, user.id, mediaId);
  }

  @Post(":id/submit")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(REQUEST_WRITE_LIMIT)
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ServiceRequest> {
    return this.requests.submit(id, user.id);
  }

  @Post(":id/cancel")
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit(REQUEST_WRITE_LIMIT)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ServiceRequest> {
    return this.requests.cancel(id, user.id);
  }
}
