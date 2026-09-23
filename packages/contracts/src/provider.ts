import { z } from "zod";

import { GeoPointSchema, IdSchema, IsoDateTimeSchema } from "./common.js";

/** 01_SPEC_PRODUCT.md #7 — progressive: Bricoleur -> Technicien -> Expert. */
export const ProviderTypeSchema = z.enum(["BRICOLEUR", "TECHNICIEN", "EXPERT"]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

/**
 * 01_SPEC_PRODUCT.md #16 — availability is distinct from GPS: a provider can
 * be AVAILABLE without streaming their position.
 */
export const ProviderAvailabilityStatusSchema = z.enum([
  "OFFLINE",
  "AVAILABLE",
  "BUSY",
  "ON_THE_WAY",
  "ARRIVED",
  "IN_SERVICE",
  "PAUSED",
]);
export type ProviderAvailabilityStatus = z.infer<typeof ProviderAvailabilityStatusSchema>;

/**
 * The subset a provider may set on themselves. `ON_THE_WAY`/`ARRIVED`/
 * `IN_SERVICE` are driven by an active intervention — #16 says the system
 * sets them automatically — and no `Intervention` exists before Phase 8, so
 * nothing may claim them today (Decision 42).
 */
export const PROVIDER_SELF_SETTABLE_STATUSES = ["OFFLINE", "AVAILABLE", "BUSY", "PAUSED"] as const;

export const UpdateProviderAvailabilityInputSchema = z.object({
  status: z.enum(PROVIDER_SELF_SETTABLE_STATUSES),
});
export type UpdateProviderAvailabilityInput = z.infer<typeof UpdateProviderAvailabilityInputSchema>;

/** 01_SPEC_PRODUCT.md #98 — `ProviderServiceArea`, embedded (see Decision). Not yet queried by proximity — Phase 5. */
export const ServiceAreaSchema = z.object({
  center: GeoPointSchema,
  radiusKm: z.number().positive().max(500),
});
export type ServiceArea = z.infer<typeof ServiceAreaSchema>;

/** 01_SPEC_PRODUCT.md #98 — `ProviderAvailability`, embedded (see Decision). */
export const AvailabilitySlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((slot) => slot.endMinute > slot.startMinute, { message: "endMinute must be after startMinute" });
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

/** 01_SPEC_PRODUCT.md #22 — trust must be multidimensional, never just a star rating. */
export const ProviderProfileSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  type: ProviderTypeSchema,
  availabilityStatus: ProviderAvailabilityStatusSchema,
  displayName: z.string().min(1),
  bio: z.string().nullable(),
  languages: z.array(z.string()),
  experienceYears: z.number().int().nonnegative().nullable(),
  skillIds: z.array(IdSchema),
  serviceIds: z.array(IdSchema),
  availability: z.array(AvailabilitySlotSchema),
  serviceAreas: z.array(ServiceAreaSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

export const CreateProviderProfileInputSchema = z.object({
  type: ProviderTypeSchema,
  displayName: z.string().min(1).max(120),
  bio: z.string().max(2000).nullable().optional(),
  languages: z.array(z.string()).optional(),
  experienceYears: z.number().int().nonnegative().nullable().optional(),
});
export type CreateProviderProfileInput = z.infer<typeof CreateProviderProfileInputSchema>;

export const UpdateProviderProfileInputSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).nullable().optional(),
  languages: z.array(z.string()).optional(),
  experienceYears: z.number().int().nonnegative().nullable().optional(),
  skillIds: z.array(IdSchema).optional(),
  serviceIds: z.array(IdSchema).optional(),
  availability: z.array(AvailabilitySlotSchema).optional(),
  serviceAreas: z.array(ServiceAreaSchema).optional(),
});
export type UpdateProviderProfileInput = z.infer<typeof UpdateProviderProfileInputSchema>;

/**
 * The public view's zone: the centre is APPROXIMATE (`approximateCoordinates()`
 * in `@fixiyi/shared-utils`), never the stored one. Deliberately not
 * `ServiceAreaSchema` — a different field name is what stops the exact centre
 * from being passed through by accident.
 */
export const PublicServiceZoneSchema = z
  .object({
    approximateCenter: GeoPointSchema,
    radiusKm: z.number().positive().max(500),
  })
  .strict();
export type PublicServiceZone = z.infer<typeof PublicServiceZoneSchema>;

/**
 * What `GET /providers/:id` returns to anyone (Decision 70). Same intent as
 * `ProviderMatchSchema` facing `MatchCandidateSchema`: a deliberately poorer
 * shape, not a filtered copy.
 *
 * Absent by design, and each for its own reason:
 * - `userId` — identifies the human behind the profile;
 * - `serviceAreas` — carries the EXACT centre that `serviceZones` blurs;
 * - phone, e-mail, exact address — released only after an offer is accepted,
 *   through `ConversationService.unlockContact`;
 * - rating, review count, intervention count — **no source exists** (D2,
 *   03_AGENT_PROTOCOL §2); inventing them is what this schema prevents.
 *
 * `.strict()` is the guard rail: re-widening the route fails the contract
 * tests instead of leaking quietly.
 */
export const PublicProviderProfileSchema = z
  .object({
    id: IdSchema,
    type: ProviderTypeSchema,
    displayName: z.string().min(1),
    bio: z.string().nullable(),
    languages: z.array(z.string()),
    experienceYears: z.number().int().nonnegative().nullable(),
    skillIds: z.array(IdSchema),
    serviceIds: z.array(IdSchema),
    availability: z.array(AvailabilitySlotSchema),
    availabilityStatus: ProviderAvailabilityStatusSchema,
    serviceZones: z.array(PublicServiceZoneSchema),
    /** Derived from an APPROVED `VerificationCase`. A bare boolean: nothing about the case itself leaves. */
    verified: z.boolean(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();
export type PublicProviderProfile = z.infer<typeof PublicProviderProfileSchema>;
