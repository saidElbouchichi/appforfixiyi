import { describe, expect, it } from "vitest";

import { RequestLocationInputSchema, RequestLocationSchema } from "./location.js";

describe("RequestLocationSchema", () => {
  it("accepts an exact GeoJSON point with a nullable address", () => {
    const result = RequestLocationSchema.safeParse({
      address: "12 rue des Fleurs, Casablanca",
      point: { type: "Point", coordinates: [-7.589843, 33.573109] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null address", () => {
    expect(RequestLocationSchema.safeParse({ address: null, point: { type: "Point", coordinates: [-7.6, 33.5] } }).success).toBe(true);
  });

  it("rejects an out-of-range coordinate", () => {
    expect(RequestLocationSchema.safeParse({ address: null, point: { type: "Point", coordinates: [200, 33.5] } }).success).toBe(false);
  });
});

describe("RequestLocationInputSchema", () => {
  it("makes address optional", () => {
    const result = RequestLocationInputSchema.parse({ point: { type: "Point", coordinates: [-7.6, 33.5] } });
    expect(result.address).toBeUndefined();
  });
});
