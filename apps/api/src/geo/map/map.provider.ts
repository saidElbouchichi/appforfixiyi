import type { GeoPoint } from "@fixiyi/contracts";

export interface RouteEstimate {
  distanceKm: number;
  durationMinutes: number;
}

/**
 * 01_SPEC_PRODUCT.md #20 — abstraction over the mapping provider so the
 * engine never depends on one vendor.
 *
 * Only the two operations Phase 5 actually consumes are declared.
 * `displayMap()` from the spec sketch is a frontend concern, not a backend
 * port, and `geocode`/`reverseGeocode` have no caller yet (the client sends
 * coordinates and a free-text address directly) — declaring methods nothing
 * implements or calls would be decorative (03_AGENT_PROTOCOL.md #2). They
 * get added when a real caller appears.
 */
export interface MapProvider {
  readonly name: string;
  estimateRoute(from: GeoPoint, to: GeoPoint): Promise<RouteEstimate>;
}

export const MAP_PROVIDER = Symbol("MAP_PROVIDER");
