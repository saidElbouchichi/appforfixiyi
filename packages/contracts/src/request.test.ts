import { describe, expect, it } from "vitest";

import { UpdateServiceRequestInputSchema } from "./request.js";

describe("UpdateServiceRequestInputSchema", () => {
  it("accepts a partial update with only a description", () => {
    expect(UpdateServiceRequestInputSchema.safeParse({ description: "Prise de courant en panne" }).success).toBe(true);
  });

  it("accepts an empty object — every field is optional, the draft fills progressively", () => {
    expect(UpdateServiceRequestInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an empty description string", () => {
    expect(UpdateServiceRequestInputSchema.safeParse({ description: "" }).success).toBe(false);
  });

  it("rejects an invalid urgency value", () => {
    expect(UpdateServiceRequestInputSchema.safeParse({ urgency: "SOMEDAY" }).success).toBe(false);
  });
});
