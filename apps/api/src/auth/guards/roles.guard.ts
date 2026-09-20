import type { UserRole } from "@fixiyi/contracts";
import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { ROLES_KEY } from "./roles.decorator.js";

/** Must run after `AuthGuard` (declaration order in `@UseGuards(AuthGuard, RolesGuard)`) — reads `request.user`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Handler AND class: `@Roles` on a controller gates every route in it.
    // Reading only the handler would silently ignore a class-level decorator
    // and leave such an endpoint open to any authenticated user.
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user;
    if (!user || !required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException("Insufficient role for this operation");
    }
    return true;
  }
}
