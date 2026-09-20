import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../auth-request.types.js";

/** Extracts the user `AuthGuard` attached to the request — only use on a route behind `@UseGuards(AuthGuard)`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  if (!request.user) {
    throw new Error("@CurrentUser() used on a route not protected by AuthGuard");
  }
  return request.user;
});
