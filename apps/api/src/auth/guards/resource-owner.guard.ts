import { ForbiddenException, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

export const RESOURCE_OWNER_PARAM_KEY = "resourceOwnerParam";

/** Marks which route param carries the resource's owner id, for `ResourceOwnerGuard`. */
export const OwnedBy = (paramName: string): MethodDecorator => SetMetadata(RESOURCE_OWNER_PARAM_KEY, paramName);

/** True when `actorId` is defined and matches `ownerId` exactly. */
export function isResourceOwner(actorId: string | undefined, ownerId: string | undefined): boolean {
  return actorId !== undefined && ownerId !== undefined && actorId === ownerId;
}

/**
 * Base ABAC primitive (01_SPEC_PRODUCT.md #67 — roles alone aren't enough;
 * ownership must also be checked). **Not applied to any route yet**: no
 * owned resource (Request/Offer/Intervention) exists before Phase 4+. Same
 * "prepared, not yet exercised" status as `ZodValidationPipe` (Decision 6) —
 * a real, tested guard with zero current consumers, not a fake check.
 *
 * Usage once a resource exists: `@UseGuards(AuthGuard, ResourceOwnerGuard)`
 * + `@OwnedBy("requestId")` on a route whose param of that name IS the
 * resource's owner id (e.g. pre-resolved by a pipe, or the resource id
 * itself for aggregates keyed by owner).
 */
@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramName = this.reflector.get<string | undefined>(RESOURCE_OWNER_PARAM_KEY, context.getHandler());
    if (!paramName) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest<{ Params: Record<string, string> }>>();
    if (!isResourceOwner(request.user?.id, request.params[paramName])) {
      throw new ForbiddenException("Not the owner of this resource");
    }
    return true;
  }
}
