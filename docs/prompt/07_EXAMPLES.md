# EXEMPLES DE CONTRATS ET PATTERNS

## Offer (packages/contracts/src/offer.ts)

    import { z } from "zod";

    export const OfferStatusSchema = z.enum([
      "DRAFT","SUBMITTED","COUNTERED","ACCEPTED","REJECTED","EXPIRED","CANCELLED"
    ]);

    export const OfferSchema = z.object({
      id: z.string().uuid(),
      requestId: z.string().uuid(),
      providerId: z.string().uuid(),
      serviceAmount: z.number().int().nonnegative(),
      transportAmount: z.number().int().nonnegative(),
      materialsAmount: z.number().int().nonnegative(),
      totalAmount: z.number().int().nonnegative(),
      currency: z.string().length(3),
      estimatedDurationMinutes: z.number().int().positive(),
      proposedDate: z.string().datetime().optional(),
      inclusions: z.array(z.string()).default([]),
      exclusions: z.array(z.string()).default([]),
      conditions: z.string().optional(),
      validityUntil: z.string().datetime(),
      status: OfferStatusSchema,
      version: z.number().int().nonnegative(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    });

    export type Offer = z.infer<typeof OfferSchema>;

## WalletTransaction

    export const WalletTransactionSchema = z.object({
      id: z.string().uuid(),
      walletId: z.string().uuid(),
      type: z.enum(["TOPUP","COMMISSION","RESERVATION","RELEASE","REFUND","ADJUSTMENT"]),
      amountMinor: z.number().int(),
      currency: z.string().length(3),
      balanceAfterMinor: z.number().int().nonnegative(),
      idempotencyKey: z.string(),
      referenceType: z.string(),
      referenceId: z.string().uuid(),
      actorId: z.string().uuid(),
      reason: z.string().optional(),
      createdAt: z.string().datetime(),
    });

## Evenement de domaine

    export const DomainEventSchema = z.object({
      eventId: z.string().uuid(),
      eventType: z.string(),
      version: z.number().int().positive(),
      occurredAt: z.string().datetime(),
      aggregateId: z.string().uuid(),
      payload: z.unknown(),
      traceId: z.string(),
    });

## Idempotency
Toute mutation critique :
- Header Idempotency-Key requis
- Stockage en DB avec TTL 24h
- Rejeu retourne la meme reponse

## API Error Format (Problem Details)

    {
      "type": "https://fixiyi.app/errors/offer-already-accepted",
      "title": "Offer already accepted",
      "status": 409,
      "code": "OFFER_ALREADY_ACCEPTED",
      "detail": "This offer has already been accepted by another client.",
      "traceId": "01HXYZ..."
    }

## State Machine - Intervention

    const interventionTransitions = {
      CONFIRMED: ["ON_THE_WAY", "CANCELLED", "NO_SHOW"],
      ON_THE_WAY: ["ARRIVED", "CANCELLED"],
      ARRIVED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
      IN_PROGRESS: ["PAUSED", "COMPLETED", "DISPUTED"],
      PAUSED: ["IN_PROGRESS", "CANCELLED"],
      COMPLETED: ["DISPUTED"],
      CANCELLED: [],
      NO_SHOW: [],
      DISPUTED: [],
    };
