import type { UserRole } from "@fixiyi/contracts";
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/** Requires the authenticated user (via `AuthGuard`) to hold at least one of `roles` — enforced by `RolesGuard`. */
export const Roles = (...roles: UserRole[]): MethodDecorator => SetMetadata(ROLES_KEY, roles);
