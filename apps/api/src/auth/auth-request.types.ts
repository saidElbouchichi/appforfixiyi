import type { UserRole } from "@fixiyi/contracts";

/** Populated by `AuthGuard` — never trust these fields on a route not behind it. */
export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  roles: UserRole[];
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    /** Where `AuthGuard` found the access token — CsrfGuard only enforces the double-submit check for "cookie". */
    authTokenSource?: "header" | "cookie";
  }
}
