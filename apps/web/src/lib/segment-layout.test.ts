import { describe, expect, it } from "vitest";

import { pageTitle } from "./segment-layout";

describe("pageTitle", () => {
  it("names the page, then the site", () => {
    expect(pageTitle("Messages")).toEqual({ absolute: "Messages — Fixiyi" });
  });

  it("is absolute, so a parent segment's title cannot drop the site name", () => {
    expect(pageTitle("Nouvelle demande")).toHaveProperty("absolute");
  });
});
