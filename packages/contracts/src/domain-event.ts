import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

/** 02_SPEC_ENGINEERING.md #150 — every domain event carries these fields, regardless of payload. */
export const DomainEventSchema = z.object({
  eventId: IdSchema,
  eventType: z.string(),
  version: z.number().int().positive(),
  occurredAt: IsoDateTimeSchema,
  aggregateId: IdSchema,
  payload: z.unknown(),
  traceId: z.string(),
});
export type DomainEvent = z.infer<typeof DomainEventSchema>;

/** 01_SPEC_PRODUCT.md #149 — names of the domain events the MVP phases will emit. Extended as phases land. */
export const DomainEventTypeSchema = z.enum([
  "RequestCreated",
  "ProviderMatched",
  "OfferSubmitted",
  "OfferAccepted",
  "InterventionConfirmed",
  "ProviderStartedTrip",
  "ProviderArrived",
  "InterventionStarted",
  "InterventionCompleted",
]);
export type DomainEventType = z.infer<typeof DomainEventTypeSchema>;
