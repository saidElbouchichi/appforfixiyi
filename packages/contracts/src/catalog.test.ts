import { describe, expect, it } from "vitest";

import { CATALOG_PARENT_LEVEL, CatalogNodeSchema, CatalogTreeNodeSchema, CreateCatalogNodeInputSchema } from "./catalog.js";

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
