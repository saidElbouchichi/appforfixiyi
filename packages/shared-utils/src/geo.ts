/**
 * 01_SPEC_PRODUCT.md #17 — "Avant acceptation : localisation approximative.
 * Après confirmation : adresse exacte accessible au fournisseur autorisé."
 * Prepared in Phase 4 (a request stores the exact point) but **not yet
 * wired** to any read endpoint — no provider can view a request until
 * Phase 5 (Matching). Same status as `ResourceOwnerGuard` (Decision 20):
 * a real, tested, pure function waiting for its caller.
 *
 * Rounding to `precisionDecimals` degrees blurs the point to roughly
 * `111km / 10^precisionDecimals` at the equator — the default of 2 gives
 * ~1.1km, enough to hide a doorstep without hiding the neighbourhood.
 */
export function approximateCoordinates(
  point: { lat: number; lng: number },
  precisionDecimals = 2,
): { lat: number; lng: number } {
  const factor = 10 ** precisionDecimals;
  return {
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  };
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points (01_SPEC_PRODUCT.md #19,
 * `DistanceService`). Haversine rather than a routing API: it is exact for
 * "as the crow flies", deterministic, dependency-free and testable — road
 * distance needs a real routing provider, which this environment does not
 * have (`MAP_PROVIDER=dev`).
 */
export function haversineDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(fromLat) * Math.cos(toLat);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
