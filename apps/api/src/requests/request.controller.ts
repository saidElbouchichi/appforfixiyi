import {
  CreateTargetMediaUploadSessionInputSchema,
  UpdateServiceRequestInputSchema,
  type CreateTargetMediaUploadSessionInput,
  type CreateUploadSessionOutput,
  type Media,
  type ServiceRequest,
  type UpdateServiceRequestInput,
} from "@fixiyi/contracts";
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../auth/auth-request.types.js";
import { CsrfGuard } from "../auth/csrf/csrf.guard.js";
import { AuthGuard } from "../auth/guards/auth.guard.js";
import { CurrentUser } from "../auth/guards/current-user.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

import { RequestService } from "./request.service.js";

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
  @UseGuards(CsrfGuard)
  create(@CurrentUser() user: AuthenticatedUser): Promise<ServiceRequest> {
    return this.requests.create(user.id);
  }

  @Get("mine")
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<ServiceRequest[]> {
    return this.requests.listMine(user.id);
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ServiceRequest> {
    return this.requests.getById(id, user.id);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateServiceRequestInputSchema)) body: UpdateServiceRequestInput,
  ): Promise<ServiceRequest> {
    return this.requests.update(id, user.id, body);
  }

  @Post(":id/media")
  @UseGuards(CsrfGuard)
  createMediaUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateTargetMediaUploadSessionInputSchema)) body: CreateTargetMediaUploadSessionInput,
  ): Promise<CreateUploadSessionOutput> {
    return this.requests.createMediaUploadSession(id, user.id, body);
  }

  @Get(":id/media")
  listMedia(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<Media[]> {
    return this.requests.listMedia(id, user.id);
  }

  @Post(":id/media/:mediaId/finalize")
  @UseGuards(CsrfGuard)
  finalizeMedia(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("mediaId") mediaId: string): Promise<Media> {
    return this.requests.finalizeMedia(id, user.id, mediaId);
  }

  @Post(":id/submit")
  @UseGuards(CsrfGuard)
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ServiceRequest> {
    return this.requests.submit(id, user.id);
  }

  @Post(":id/cancel")
  @UseGuards(CsrfGuard)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ServiceRequest> {
    return this.requests.cancel(id, user.id);
  }
}
