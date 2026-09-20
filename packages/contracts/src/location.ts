import { z } from "zod";

import { GeoPointSchema } from "./common.js";

/**
 * 01_SPEC_PRODUCT.md #17-19 — the client sets a location per request (not
 * just a profile-level address, since a request may be for a different
 * address than the client's own). Stores the **exact** point; approximating
 * it for a non-owner reader is a Phase 5+ concern (no provider can view a
 * request yet) — see `approximateCoordinates()` in `@fixiyi/shared-utils`,
 * prepared but not wired here, same status as `ResourceOwnerGuard`.
 */
export const RequestLocationSchema = z.object({
  address: z.string().max(500).nullable(),
  point: GeoPointSchema,
});
export type RequestLocation = z.infer<typeof RequestLocationSchema>;

export const RequestLocationInputSchema = z.object({
  address: z.string().max(500).nullable().optional(),
  point: GeoPointSchema,
});
export type RequestLocationInput = z.infer<typeof RequestLocationInputSchema>;
