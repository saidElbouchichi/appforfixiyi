import { PublicProviderProfileSchema, type PublicProviderProfile } from "@fixiyi/contracts";

import { apiFetch } from "./api-client";

export const publicProviderKey = (id: string): string[] => ["public-provider", id];

/** Public route: no `auth: true` — a visitor may read a provider's public profile (Decision 70). */
export async function fetchPublicProvider(id: string): Promise<PublicProviderProfile> {
  return PublicProviderProfileSchema.parse(await apiFetch(`/api/v1/providers/${id}`));
}
