import { describe, expect, it } from "vitest";

import { generateId, isValidId, isValidUuidV7 } from "./id.js";

describe("id", () => {
  it("generates syntactically valid, unique UUIDv7 ids", () => {
    const a = generateId();
    const b = generateId();
    expect(isValidId(a)).toBe(true);
    expect(isValidUuidV7(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("generates time-ordered ids (monotonic string sort for ids created in sequence)", () => {
    const ids = Array.from({ length: 5 }, () => generateId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it("rejects invalid ids", () => {
    expect(isValidId("not-a-uuid")).toBe(false);
    expect(isValidUuidV7("11111111-1111-4111-8111-111111111111")).toBe(false); // v4, not v7
  });
});
