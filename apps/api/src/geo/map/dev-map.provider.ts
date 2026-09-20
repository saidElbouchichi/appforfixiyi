import type { GeoPoint } from "@fixiyi/contracts";
import { haversineDistanceKm } from "@fixiyi/shared-utils";
import { Injectable } from "@nestjs/common";

import type { ConfigurationService } from "../../configuration/configuration.service.js";

import type { MapProvider, RouteEstimate } from "./map.provider.js";

/**
 * Dev-mode adapter — no routing API is provisioned in this environment
 * (`MAP_PROVIDER=dev`, no key). It does NOT pretend to compute a road
 * route: it returns the real great-circle distance and derives a duration
 * from the administrable `averageSpeedKmh`. Honest and deterministic, but a
 * straight-line estimate — a real provider will return road distance and
 * live traffic, which will change both numbers (documented limitation).
 */
@Injectable()
export class DevMapProvider implements MapProvider {
  readonly name = "dev";

  constructor(private readonly configuration: ConfigurationService) {}

  async estimateRoute(from: GeoPoint, to: GeoPoint): Promise<RouteEstimate> {
    const { averageSpeedKmh } = await this.configuration.getTransport();
    const distanceKm = haversineDistanceKm(toLatLng(from), toLatLng(to));

    return {
      distanceKm,
      durationMinutes: Math.round((distanceKm / averageSpeedKmh) * 60),
    };
  }
}

function toLatLng(point: GeoPoint): { lat: number; lng: number } {
  return { lng: point.coordinates[0], lat: point.coordinates[1] };
}
