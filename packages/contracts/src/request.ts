import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";
import { RequestLocationInputSchema, RequestLocationSchema } from "./location.js";

/** 01_SPEC_PRODUCT.md #10 worked example only shows "Normale" — no scheduling/appointment concept exists yet (Phase 33 territory), so this stays binary. */
export const RequestUrgencySchema = z.enum(["NORMAL", "URGENT"]);
export type RequestUrgency = z.infer<typeof RequestUrgencySchema>;

/**
 * Narrowed scope for Phase 4 (validated with the product owner before
 * implementation — Decision 35): `DRAFT -> REQUESTED` is the only automatic
 * transition this phase drives. `MATCHING` is a valid, tested state but
 * nothing in Phase 4 transitions into it — that's Phase 5 (the matching
 * engine)'s job once it exists. `CANCELLED` is available any time before
 * `MATCHING`. `EXPIRED` is defined but has no automatic trigger yet (would
 * need a scheduled job — out of scope, documented limitation).
 */
export const RequestStatusSchema = z.enum(["DRAFT", "REQUESTED", "MATCHING", "CANCELLED", "EXPIRED"]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const ServiceRequestSchema = z.object({
  id: IdSchema,
  clientUserId: IdSchema,
  serviceId: IdSchema.nullable(),
  interventionTypeId: IdSchema.nullable(),
  complexityId: IdSchema.nullable(),
  description: z.string().nullable(),
  urgency: RequestUrgencySchema.nullable(),
  location: RequestLocationSchema.nullable(),
  mediaIds: z.array(IdSchema),
  status: RequestStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;

/** Every field optional — a client fills the draft progressively (01_SPEC_PRODUCT.md #10), `submit()` enforces completeness. */
export const UpdateServiceRequestInputSchema = z.object({
  serviceId: IdSchema.optional(),
  interventionTypeId: IdSchema.optional(),
  complexityId: IdSchema.optional(),
  description: z.string().min(1).max(5000).optional(),
  urgency: RequestUrgencySchema.optional(),
  location: RequestLocationInputSchema.optional(),
});
export type UpdateServiceRequestInput = z.infer<typeof UpdateServiceRequestInputSchema>;
