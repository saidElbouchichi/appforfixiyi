import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

/** 01_SPEC_PRODUCT.md #8 — Domain > Category > Service > InterventionType > Complexity, plus the flat Skill catalog. */
export const CatalogLevelSchema = z.enum(["DOMAIN", "CATEGORY", "SERVICE", "INTERVENTION_TYPE", "COMPLEXITY", "SKILL"]);
export type CatalogLevel = z.infer<typeof CatalogLevelSchema>;

/** Which level a given level's parent must be — DOMAIN and SKILL are roots (`null`). */
export const CATALOG_PARENT_LEVEL: Record<CatalogLevel, CatalogLevel | null> = {
  DOMAIN: null,
  CATEGORY: "DOMAIN",
  SERVICE: "CATEGORY",
  INTERVENTION_TYPE: "SERVICE",
  COMPLEXITY: "INTERVENTION_TYPE",
  SKILL: null,
};

/**
 * Display metadata for a catalogue node (Decision 62 / D3). Both lists are
 * CLOSED: a free string would let the back-office point at a glyph that does
 * not exist, and a free colour would escape the trade palette whose contrast
 * pairs were measured in phase 1 of the redesign.
 *
 * `apps/web` holds the test that fails if either list drifts from the Design
 * System — `@fixiyi/contracts` stays dependency-free (zod only), so it cannot
 * import the icons or the tokens itself.
 */
export const CATALOG_ICONS = [
  "bolt",
  "droplet",
  "snowflake",
  "key",
  "paint-roller",
  "hammer",
  "washing-machine",
  "smart-home",
  "monitor",
  "sparkles",
  "leaf",
  "wrench",
  "tools",
] as const;
export const CatalogIconSchema = z.enum(CATALOG_ICONS);
export type CatalogIcon = z.infer<typeof CatalogIconSchema>;

/** The trade colours of `@fixiyi/design-tokens` (`colors.trade`), by key. */
export const TRADE_ACCENT_COLORS = [
  "electrician",
  "plumber",
  "hvac",
  "locksmith",
  "painter",
  "carpenter",
  "appliance",
  "it",
  "cleaning",
  "gardening",
] as const;
export const CatalogAccentColorSchema = z.enum(TRADE_ACCENT_COLORS);
export type CatalogAccentColor = z.infer<typeof CatalogAccentColorSchema>;

/** One node of the catalog tree — same shape at every level (see Decision: 1 generic collection instead of 6). */
export const CatalogNodeSchema = z.object({
  id: IdSchema,
  level: CatalogLevelSchema,
  parentId: IdSchema.nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  order: z.number().int(),
  active: z.boolean(),
  /** Only meaningful when `level === "COMPLEXITY"` — the "RequiredSkill" relation from #8, as skill ids. */
  requiredSkillIds: z.array(IdSchema),
  /** Display metadata (Decision 62). `.default(null)` keeps every node stored before these fields existed valid. */
  icon: CatalogIconSchema.nullable().default(null),
  accentColor: CatalogAccentColorSchema.nullable().default(null),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CatalogNode = z.infer<typeof CatalogNodeSchema>;

export interface CatalogTreeNode extends CatalogNode {
  children: CatalogTreeNode[];
}
export const CatalogTreeNodeSchema: z.ZodType<CatalogTreeNode> = CatalogNodeSchema.extend({
  children: z.lazy(() => z.array(CatalogTreeNodeSchema)),
});

export const CreateCatalogNodeInputSchema = z.object({
  level: CatalogLevelSchema,
  parentId: IdSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  order: z.number().int().optional(),
  requiredSkillIds: z.array(IdSchema).optional(),
  icon: CatalogIconSchema.nullable().optional(),
  accentColor: CatalogAccentColorSchema.nullable().optional(),
});
export type CreateCatalogNodeInput = z.infer<typeof CreateCatalogNodeInputSchema>;

export const UpdateCatalogNodeInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
  requiredSkillIds: z.array(IdSchema).optional(),
  icon: CatalogIconSchema.nullable().optional(),
  accentColor: CatalogAccentColorSchema.nullable().optional(),
});
export type UpdateCatalogNodeInput = z.infer<typeof UpdateCatalogNodeInputSchema>;
