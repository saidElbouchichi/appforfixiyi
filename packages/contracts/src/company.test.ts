import { describe, expect, it } from "vitest";

import { CreateCompanyInputSchema, InviteCompanyMemberInputSchema } from "./company.js";

describe("CreateCompanyInputSchema", () => {
  it("accepts a minimal valid company", () => {
    expect(CreateCompanyInputSchema.safeParse({ name: "Fixiyi Electricite SARL" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(CreateCompanyInputSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("InviteCompanyMemberInputSchema", () => {
  it("accepts MEMBER/TECHNICIAN but not OWNER", () => {
    expect(InviteCompanyMemberInputSchema.safeParse({ phone: "+212612345678", role: "MEMBER" }).success).toBe(true);
    expect(InviteCompanyMemberInputSchema.safeParse({ phone: "+212612345678", role: "TECHNICIAN" }).success).toBe(true);
    expect(InviteCompanyMemberInputSchema.safeParse({ phone: "+212612345678", role: "OWNER" }).success).toBe(false);
  });

  it("rejects a malformed phone", () => {
    expect(InviteCompanyMemberInputSchema.safeParse({ phone: "0612345678", role: "MEMBER" }).success).toBe(false);
  });
});
