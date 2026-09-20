import { describe, expect, it } from "vitest";

import { approximateCoordinates, haversineDistanceKm } from "./geo.js";

describe("approximateCoordinates", () => {
  it("rounds to 2 decimals by default (~1.1km precision)", () => {
    expect(approximateCoordinates({ lat: 33.573109, lng: -7.589843 })).toEqual({ lat: 33.57, lng: -7.59 });
  });

  it("supports a coarser precision", () => {
    expect(approximateCoordinates({ lat: 33.573109, lng: -7.589843 }, 1)).toEqual({ lat: 33.6, lng: -7.6 });
  });

  it("never returns the exact original point for a non-round coordinate", () => {
    const approx = approximateCoordinates({ lat: 33.573109, lng: -7.589843 });
    expect(approx.lat).not.toBe(33.573109);
    expect(approx.lng).not.toBe(-7.589843);
  });
});

describe("haversineDistanceKm", () => {
  it("is zero between a point and itself", () => {
    expect(haversineDistanceKm({ lat: 33.5731, lng: -7.5898 }, { lat: 33.5731, lng: -7.5898 })).toBe(0);
  });

  it("matches the known Casablanca -> Rabat distance (~87 km as the crow flies)", () => {
    const distance = haversineDistanceKm({ lat: 33.573109, lng: -7.589843 }, { lat: 34.020882, lng: -6.841650 });
    expect(distance).toBeGreaterThan(84);
    expect(distance).toBeLessThan(90);
  });

  it("is symmetric", () => {
    const casablanca = { lat: 33.573109, lng: -7.589843 };
    const marrakech = { lat: 31.629472, lng: -7.981084 };
    expect(haversineDistanceKm(casablanca, marrakech)).toBeCloseTo(haversineDistanceKm(marrakech, casablanca), 9);
  });

  it("approximates 111 km per degree of latitude", () => {
    const distance = haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("handles antipodal points without NaN from floating-point drift", () => {
    const distance = haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isNaN(distance)).toBe(false);
    expect(distance).toBeCloseTo(Math.PI * 6371, 0);
  });
});
