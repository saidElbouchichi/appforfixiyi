import { describe, expect, it } from "vitest";

import { LIST_PAGE_DEFAULT_LIMIT } from "./common.js";
import { UpdateServiceRequestInputSchema,
  RequestListQuerySchema,
} from "./request.js";

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

describe("RequestListQuerySchema (Decision 76)", () => {
  it("defaults to a bounded page rather than everything", () => {
    const query = RequestListQuerySchema.parse({});
    expect(query.limit).toBe(LIST_PAGE_DEFAULT_LIMIT);
    expect(query.before).toBeUndefined();
  });

  it("coerces the limit from the query string and caps it", () => {
    expect(RequestListQuerySchema.parse({ limit: "50" }).limit).toBe(50);
    expect(RequestListQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
    expect(RequestListQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("takes an id as the cursor — ids are UUIDv7, so they sort by creation time", () => {
    expect(RequestListQuerySchema.safeParse({ before: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab" }).success).toBe(true);
    expect(RequestListQuerySchema.safeParse({ before: "not-an-id" }).success).toBe(false);
  });
});
