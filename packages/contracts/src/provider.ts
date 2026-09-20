import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

/** 01_SPEC_PRODUCT.md #7 — progressive: Bricoleur -> Technicien -> Expert. */
export const ProviderTypeSchema = z.enum(["BRICOLEUR", "TECHNICIEN", "EXPERT"]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const GeoPointSchema = z.object({
  type: z.literal("Point"),
  /** [longitude, latitude] — GeoJSON order, not [lat, lng]. */
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

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
