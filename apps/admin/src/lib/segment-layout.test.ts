import { describe, expect, it } from "vitest";

import { pageTitle } from "./segment-layout";

describe("pageTitle (admin)", () => {
  it("names the page, then the back-office — never the public site's name", () => {
    expect(pageTitle("Catalogue")).toEqual({ absolute: "Catalogue — Fixiyi Admin" });
  });
});
