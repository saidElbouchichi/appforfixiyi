import type { GeoPoint } from "@fixiyi/contracts";
import { haversineDistanceKm } from "@fixiyi/shared-utils";
import { Inject, Injectable } from "@nestjs/common";

import { MAP_PROVIDER, type MapProvider } from "./map/map.provider.js";

/**
 * 01_SPEC_PRODUCT.md #19 — `GeoService`/`DistanceService`/
 * `TravelTimeService`. Kept as one service rather than three classes that
 * would each hold a single function: the three responsibilities are
 * distance, travel time and point conversion over the same two
 * coordinates. `TransportPricingService` IS separate, because it owns
 * money and configurable pricing rules.
 */
@Injectable()
export class GeoService {
  constructor(@Inject(MAP_PROVIDER) private readonly map: MapProvider) {}

  /** Straight-line distance — no network call, used for every candidate in a batch. */
  distanceKm(from: GeoPoint, to: GeoPoint): number {
    return haversineDistanceKm(toLatLng(from), toLatLng(to));
  }

  /** Travel time goes through the `MapProvider` port, so a real routing API can replace the estimate without touching callers. */
  async travelTimeMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    return (await this.map.estimateRoute(from, to)).durationMinutes;
  }

  static toGeoPoint(lat: number, lng: number): GeoPoint {
    return { type: "Point", coordinates: [lng, lat] };
  }
}

function toLatLng(point: GeoPoint): { lat: number; lng: number } {
  return { lng: point.coordinates[0], lat: point.coordinates[1] };
}
