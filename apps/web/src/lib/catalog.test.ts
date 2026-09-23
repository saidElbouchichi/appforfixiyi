import type { CatalogTreeNode } from "@fixiyi/contracts";
import { CATALOG_ICONS, TRADE_ACCENT_COLORS } from "@fixiyi/contracts";
import { colors } from "@fixiyi/design-tokens";
import { ICON_NAMES } from "@fixiyi/ui";
import { describe, expect, it } from "vitest";

import { ancestryOf, catalogNames, searchCatalog, tradeFill } from "./catalog";

let counter = 0;
function node(name: string, level: CatalogTreeNode["level"], children: CatalogTreeNode[] = []): CatalogTreeNode {
  counter += 1;
  return {
    id: `id-${counter.toString()}`,
    level,
    parentId: null,
    name,
    description: null,
    order: 0,
    active: true,
    requiredSkillIds: [],
    icon: null,
    accentColor: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    children,
  };
}

const tree: CatalogTreeNode[] = [
  node("Electricite", "DOMAIN", [
    node("Panne electrique", "CATEGORY", [node("Panne electrique", "SERVICE", [node("Diagnostic", "INTERVENTION_TYPE")])]),
    node("Installation electrique", "CATEGORY", [node("Installation de prise", "SERVICE")]),
  ]),
  node("Plomberie", "DOMAIN", [node("Fuite d'eau", "CATEGORY", [node("Reparation de fuite", "SERVICE")])]),
];

describe("searchCatalog", () => {
  it("returns nothing for a blank query rather than the whole catalogue", () => {
    expect(searchCatalog(tree, "   ")).toEqual([]);
  });

  it("finds a service by a fragment of its name", () => {
    const results = searchCatalog(tree, "prise");
    expect(results).toHaveLength(1);
    expect(results[0]?.node.name).toBe("Installation de prise");
  });

  /** The seeded catalogue is written without accents; a French speaker types them. */
  it("ignores accents and case on both sides", () => {
    expect(searchCatalog(tree, "ÉLECTRICITÉ").some((result) => result.node.name === "Electricite")).toBe(true);
    expect(searchCatalog(tree, "fuite").some((result) => result.node.name === "Fuite d'eau")).toBe(true);
  });

  /**
   * Two "Panne electrique" exist, one CATEGORY and one SERVICE. Without the
   * full path the results would be indistinguishable.
   */
  it("carries the full ancestry of each result", () => {
    const service = searchCatalog(tree, "panne").find((result) => result.node.level === "SERVICE");
    expect(service?.path).toEqual(["Electricite", "Panne electrique", "Panne electrique"]);
  });

  it("orders broader levels first, so a domain outranks a leaf", () => {
    const levels = searchCatalog(tree, "electric").map((result) => result.node.level);
    expect(levels[0]).toBe("DOMAIN");
  });

  it("can be narrowed to one domain", () => {
    const results = searchCatalog(tree, "e", { domainId: tree[1]?.id });
    expect(results.every((result) => result.path[0] === "Plomberie")).toBe(true);
  });
});

describe("catalogNames", () => {
  it("flattens every level into id -> name", () => {
    const names = catalogNames(tree);
    const electricite = tree[0];
    expect(names.get(electricite?.id ?? "")).toBe("Electricite");
    // Deepest level reached too, not just the roots.
    expect([...names.values()]).toContain("Diagnostic");
  });
});

describe("ancestryOf", () => {
  it("returns the domain -> category -> service chain the request form needs", () => {
    const service = searchCatalog(tree, "prise")[0]?.node;
    const chain = ancestryOf(tree, service?.id ?? "");
    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe(tree[0]?.id);
    expect(chain.at(-1)).toBe(service?.id);
  });

  it("returns nothing for an id the catalogue does not hold", () => {
    expect(ancestryOf(tree, "unknown")).toEqual([]);
  });
});

describe("tradeFill", () => {
  it("resolves a trade key to its measured token", () => {
    expect(tradeFill("plumber")).toBe(colors.trade.plumber);
  });

  it("returns null when a node inherits nothing — a neutral tile, not an invented colour", () => {
    expect(tradeFill(null)).toBeNull();
  });
});

/**
 * `@fixiyi/contracts` depends on zod alone, so it cannot import the icons or
 * the tokens to check itself. This is where the two ends meet: if an icon is
 * renamed in the Design System or a trade colour disappears, this fails
 * instead of shipping a tile that draws nothing.
 */
describe("catalogue display metadata matches the Design System", () => {
  it("offers only icons the Design System can draw", () => {
    expect(CATALOG_ICONS.filter((name) => !ICON_NAMES.includes(name))).toEqual([]);
  });

  it("offers only colours the trade palette defines", () => {
    const palette = Object.keys(colors.trade);
    expect(TRADE_ACCENT_COLORS.filter((name) => !palette.includes(name))).toEqual([]);
  });
});
