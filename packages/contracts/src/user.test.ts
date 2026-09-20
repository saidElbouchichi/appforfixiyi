import { describe, expect, it } from "vitest";

import { UserRoleSchema, UserSchema } from "./user.js";

const validUser = {
  id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
  phone: "+212612345678",
  phoneVerifiedAt: "2026-09-20T10:00:00.000Z",
  email: null,
  emailVerifiedAt: null,
  dateOfBirth: null,
  roles: ["CLIENT"],
  status: "ACTIVE",
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-20T10:00:00.000Z",
};

describe("UserRoleSchema", () => {
  it("accepts every documented role (01_SPEC_PRODUCT.md #66)", () => {
    const roles = [
      "CLIENT",
      "PROVIDER",
      "COMPANY_MEMBER",
      "SUPPORT",
      "VERIFICATION_AGENT",
      "MODERATOR",
      "DISPUTE_AGENT",
      "FINANCE_AGENT",
      "MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ];
    for (const role of roles) {
      expect(UserRoleSchema.safeParse(role).success).toBe(true);
    }
  });

  it("rejects an undocumented role", () => {
    expect(UserRoleSchema.safeParse("MADE_UP_ROLE").success).toBe(false);
  });
});

describe("UserSchema", () => {
  it("parses a valid user with nullable phone/email verification fields", () => {
    expect(UserSchema.parse(validUser)).toMatchObject({ phone: "+212612345678" });
  });

  it("requires at least one role", () => {
    expect(UserSchema.safeParse({ ...validUser, roles: [] }).success).toBe(false);
  });

  it("rejects a malformed phone", () => {
    expect(UserSchema.safeParse({ ...validUser, phone: "0612345678" }).success).toBe(false);
  });
});
