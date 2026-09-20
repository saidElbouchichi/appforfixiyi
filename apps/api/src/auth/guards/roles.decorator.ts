import type { UserRole } from "@fixiyi/contracts";
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Requires the authenticated user (via `AuthGuard`) to hold at least one of
 * `roles` — enforced by `RolesGuard`. Usable on a method or on a whole
 * controller; a method-level decorator overrides the class-level one.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
