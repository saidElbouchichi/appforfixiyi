import { describe, expect, it } from "vitest";

import {
  CATALOG_ICONS,
  CATALOG_PARENT_LEVEL,
  CatalogNodeSchema,
  CatalogTreeNodeSchema,
  CreateCatalogNodeInputSchema,
  TRADE_ACCENT_COLORS,
  UpdateCatalogNodeInputSchema,
} from "./catalog.js";

const validNode = {
  id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ab",
  level: "DOMAIN",
  parentId: null,
  name: "Electricite",
  description: null,
  order: 0,
  active: true,
  requiredSkillIds: [],
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-20T10:00:00.000Z",
};

describe("CATALOG_PARENT_LEVEL", () => {
  it("matches the Domain > Category > Service > InterventionType > Complexity hierarchy (01_SPEC_PRODUCT.md #8)", () => {
    expect(CATALOG_PARENT_LEVEL.DOMAIN).toBeNull();
    expect(CATALOG_PARENT_LEVEL.CATEGORY).toBe("DOMAIN");
    expect(CATALOG_PARENT_LEVEL.SERVICE).toBe("CATEGORY");
    expect(CATALOG_PARENT_LEVEL.INTERVENTION_TYPE).toBe("SERVICE");
    expect(CATALOG_PARENT_LEVEL.COMPLEXITY).toBe("INTERVENTION_TYPE");
    expect(CATALOG_PARENT_LEVEL.SKILL).toBeNull();
  });
});

describe("CatalogNodeSchema", () => {
  it("parses a valid root node", () => {
    expect(CatalogNodeSchema.parse(validNode)).toMatchObject({ level: "DOMAIN", parentId: null });
  });

  it("rejects an unknown level", () => {
    expect(CatalogNodeSchema.safeParse({ ...validNode, level: "MADE_UP" }).success).toBe(false);
  });
});

describe("CatalogTreeNodeSchema", () => {
  it("parses a nested tree recursively", () => {
    const tree = {
      ...validNode,
      children: [{ ...validNode, id: "018f5b0a-6e2a-7c3d-9b1a-1234567890ac", level: "CATEGORY", parentId: validNode.id, children: [] }],
    };
    const result = CatalogTreeNodeSchema.parse(tree);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]?.level).toBe("CATEGORY");
  });
});

describe("CreateCatalogNodeInputSchema", () => {
  it("makes order optional (defaulted to 0 by the service, not the schema) and accepts an optional parentId", () => {
    const result = CreateCatalogNodeInputSchema.parse({ level: "DOMAIN", name: "Plomberie" });
    expect(result.order).toBeUndefined();
  });

  it("rejects an empty name", () => {
    expect(CreateCatalogNodeInputSchema.safeParse({ level: "DOMAIN", name: "" }).success).toBe(false);
  });
});

describe("catalog display metadata (Decision 62 / D3)", () => {
  it("keeps nodes stored before the fields existed valid, with null defaults", () => {
    const parsed = CatalogNodeSchema.parse(validNode);
    expect(parsed.icon).toBeNull();
    expect(parsed.accentColor).toBeNull();
  });

  it("accepts an icon and an accent colour from the closed lists", () => {
    const parsed = CatalogNodeSchema.parse({ ...validNode, icon: "bolt", accentColor: "electrician" });
    expect(parsed.icon).toBe("bolt");
    expect(parsed.accentColor).toBe("electrician");
  });

  /** Closed on purpose: a free string would let the back-office point at a glyph that does not exist. */
  it("rejects an icon outside the Design System list", () => {
    expect(CatalogNodeSchema.safeParse({ ...validNode, icon: "rocket" }).success).toBe(false);
  });

  /** Closed on purpose: the trade palette's contrast pairs were measured in phase 1 (D1/D3). */
  it("rejects a free colour", () => {
    expect(CatalogNodeSchema.safeParse({ ...validNode, accentColor: "#FF0000" }).success).toBe(false);
  });

  it("lets the back-office set and clear both fields", () => {
    expect(UpdateCatalogNodeInputSchema.safeParse({ icon: "droplet", accentColor: "plumber" }).success).toBe(true);
    expect(UpdateCatalogNodeInputSchema.safeParse({ icon: null, accentColor: null }).success).toBe(true);
    expect(UpdateCatalogNodeInputSchema.safeParse({ icon: "not-an-icon" }).success).toBe(false);
  });

  it("lets a node be created with them", () => {
    expect(CreateCatalogNodeInputSchema.safeParse({ level: "DOMAIN", name: "Electricite", icon: "bolt", accentColor: "electrician" }).success).toBe(true);
  });

  it("offers one icon per trade colour, so a tile is never colour-only", () => {
    expect(CATALOG_ICONS.length).toBeGreaterThanOrEqual(TRADE_ACCENT_COLORS.length);
  });
});
