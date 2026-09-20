import { describe, expect, it } from "vitest";

import { AvailabilitySlotSchema, CreateProviderProfileInputSchema, ServiceAreaSchema } from "./provider.js";

describe("ServiceAreaSchema", () => {
  it("accepts a valid GeoJSON center + radius", () => {
    const result = ServiceAreaSchema.safeParse({ center: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: 15 });
    expect(result.success).toBe(true);
  });

  it("rejects coordinates out of range", () => {
    expect(ServiceAreaSchema.safeParse({ center: { type: "Point", coordinates: [200, 33.5] }, radiusKm: 15 }).success).toBe(false);
  });

  it("rejects a negative radius", () => {
    expect(ServiceAreaSchema.safeParse({ center: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: -1 }).success).toBe(false);
  });
});

describe("AvailabilitySlotSchema", () => {
  it("accepts a valid slot", () => {
    expect(AvailabilitySlotSchema.safeParse({ dayOfWeek: 1, startMinute: 480, endMinute: 1020 }).success).toBe(true);
  });

  it("rejects endMinute before startMinute", () => {
    expect(AvailabilitySlotSchema.safeParse({ dayOfWeek: 1, startMinute: 1020, endMinute: 480 }).success).toBe(false);
  });

  it("rejects an out-of-range dayOfWeek", () => {
    expect(AvailabilitySlotSchema.safeParse({ dayOfWeek: 7, startMinute: 0, endMinute: 60 }).success).toBe(false);
  });
});

describe("CreateProviderProfileInputSchema", () => {
  it("makes languages optional (defaulted to [] by the service, not the schema)", () => {
    const result = CreateProviderProfileInputSchema.parse({ type: "BRICOLEUR", displayName: "Karim E." });
    expect(result.languages).toBeUndefined();
  });
});
