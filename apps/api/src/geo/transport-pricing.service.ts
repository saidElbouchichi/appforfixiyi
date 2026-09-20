import type { GeoPoint, TransportConfig, TransportQuote } from "@fixiyi/contracts";
import { Injectable } from "@nestjs/common";

import { ConfigurationService } from "../configuration/configuration.service.js";

import { GeoService } from "./geo.service.js";

/**
 * 01_SPEC_PRODUCT.md #18/#19 — travel is free inside the configured radius;
 * beyond it the engine computes a low, capped, administrable fee. The
 * provider never sets this price.
 *
 * Phase 5 only quotes: nothing is charged and no `Payment` is created
 * (Phase 9). The quote exists so the provider sees the trip's cost before
 * responding, and so Phase 7's offers can build on a price the system —
 * not the provider — decided.
 */
@Injectable()
export class TransportPricingService {
  constructor(
    private readonly configuration: ConfigurationService,
    private readonly geo: GeoService,
  ) {}

  async quote(from: GeoPoint, to: GeoPoint): Promise<TransportQuote> {
    const config = await this.configuration.getTransport();
    const distanceKm = this.geo.distanceKm(from, to);
    const travelTimeMinutes = await this.geo.travelTimeMinutes(from, to);

    return buildQuote(distanceKm, travelTimeMinutes, config);
  }

  /**
   * For callers that already hold a real distance and must NOT recompute it
   * from coordinates — e.g. quoting to a provider, who only ever sees the
   * approximate location and whose fee must not leak the exact one.
   */
  async quoteForDistanceKm(distanceKm: number): Promise<TransportQuote> {
    const config = await this.configuration.getTransport();
    return buildQuote(distanceKm, estimateTravelMinutes(distanceKm, config.averageSpeedKmh), config);
  }
}

export function estimateTravelMinutes(distanceKm: number, averageSpeedKmh: number): number {
  return Math.round((distanceKm / averageSpeedKmh) * 60);
}

/**
 * Pure so the pricing rule itself is unit-testable without Mongo or a map
 * provider — the part that must never silently drift is the arithmetic.
 */
export function buildQuote(distanceKm: number, travelTimeMinutes: number, config: TransportConfig): TransportQuote {
  const billableDistanceKm = Math.max(0, distanceKm - config.freeRadiusKm);
  const uncappedAmount = Math.round(billableDistanceKm * config.perKmAmountMinor);
  const amountMinor = Math.min(uncappedAmount, config.maxFeeAmountMinor);

  return {
    distanceKm,
    travelTimeMinutes,
    billableDistanceKm,
    amountMinor,
    currency: config.currency,
    isFree: amountMinor === 0,
  };
}
