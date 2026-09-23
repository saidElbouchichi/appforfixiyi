import { describe, expect, it } from "vitest";

import {
  AvailabilitySlotSchema,
  CreateProviderProfileInputSchema,
  PublicProviderProfileSchema,
  PublicServiceZoneSchema,
  ServiceAreaSchema,
} from "./provider.js";

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

const validPublicProfile = {
  id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
  type: "TECHNICIEN",
  displayName: "Karim E.",
  bio: null,
  languages: ["fr", "ar"],
  experienceYears: 6,
  skillIds: [],
  serviceIds: [],
  availability: [],
  availabilityStatus: "AVAILABLE",
  serviceZones: [{ approximateCenter: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: 15 }],
  verified: true,
  createdAt: "2026-09-20T10:00:00.000Z",
};

describe("PublicProviderProfileSchema (Decision 70)", () => {
  it("parses the public view of a provider", () => {
    expect(PublicProviderProfileSchema.safeParse(validPublicProfile).success).toBe(true);
  });

  /**
   * The point of this suite: the schema is the guard rail. If someone ever
   * hands the full `ProviderProfile` to the public route again, these fail —
   * `userId` identifies the human behind the profile, `serviceAreas` carries
   * the EXACT centre the approximate zone exists to hide.
   */
  it.each(["userId", "serviceAreas", "phone", "email", "updatedAt"])("rejects a leaked %s", (key) => {
    expect(PublicProviderProfileSchema.safeParse({ ...validPublicProfile, [key]: "anything" }).success).toBe(false);
  });

  it("rejects the full ProviderProfile wholesale", () => {
    const full = {
      ...validPublicProfile,
      userId: "018f5b0a-6e2a-7c3d-9b1a-000000000001",
      serviceAreas: [{ center: { type: "Point", coordinates: [-7.6123456, 33.5123456] }, radiusKm: 15 }],
      updatedAt: "2026-09-20T10:00:00.000Z",
    };
    expect(PublicProviderProfileSchema.safeParse(full).success).toBe(false);
  });

  it("requires the verified badge to be a boolean, never a case or a date", () => {
    expect(PublicProviderProfileSchema.safeParse({ ...validPublicProfile, verified: "APPROVED" }).success).toBe(false);
  });

  it("carries no rating, review count or intervention count — none of them exist (D2)", () => {
    const shape = Object.keys(PublicProviderProfileSchema.shape);
    expect(shape).not.toContain("rating");
    expect(shape).not.toContain("reviewCount");
    expect(shape).not.toContain("interventionCount");
  });
});

describe("PublicServiceZoneSchema", () => {
  it("accepts an approximate centre and a radius", () => {
    expect(PublicServiceZoneSchema.safeParse({ approximateCenter: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: 15 }).success).toBe(true);
  });

  it("rejects the exact-centre shape of ServiceArea", () => {
    expect(PublicServiceZoneSchema.safeParse({ center: { type: "Point", coordinates: [-7.6, 33.5] }, radiusKm: 15 }).success).toBe(false);
  });
});
