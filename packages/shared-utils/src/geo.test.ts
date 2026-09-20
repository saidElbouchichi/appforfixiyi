import { describe, expect, it } from "vitest";

import { approximateCoordinates } from "./geo.js";

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
