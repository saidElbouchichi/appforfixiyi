import type { User } from "@fixiyi/contracts";
import { describe, expect, it } from "vitest";

import { startRouteFor } from "./start-route";

const user = (roles: string[]): User => ({ id: "u", roles }) as unknown as User;

describe("startRouteFor (Decision 65)", () => {
  it("sends a provider to the requests dispatched to them", () => {
    expect(startRouteFor(user(["CLIENT", "PROVIDER"]))).toBe("/provider/requests");
  });

  it("sends a client to the request form", () => {
    expect(startRouteFor(user(["CLIENT"]))).toBe("/requests/new");
  });

  it("sends nobody-signed-in to the login", () => {
    expect(startRouteFor(null)).toBe("/login");
  });
});
