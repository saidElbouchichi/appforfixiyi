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
