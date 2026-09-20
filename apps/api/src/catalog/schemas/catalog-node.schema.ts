import type { CatalogLevel } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/**
 * 01_SPEC_PRODUCT.md #8 / 02_SPEC_ENGINEERING.md #98 — one collection for the
 * whole catalog (Domain/Category/Service/InterventionType/Complexity/Skill):
 * every level shares the exact same shape (name/description/order/active/
 * parent) — see PHASE_3_PLAN.md for why this replaces 6 near-identical
 * collections.
 */
@Schema({ collection: "catalog_nodes", timestamps: true, versionKey: false })
export class CatalogNodeEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true })
  level!: CatalogLevel;

  /** `null` for DOMAIN and SKILL (both roots) — see `CATALOG_PARENT_LEVEL` in @fixiyi/contracts. */
  @Prop({ type: String, default: null })
  parentId!: string | null;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: Number, required: true, default: 0 })
  order!: number;

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  /** Only meaningful when `level === "COMPLEXITY"` — the "RequiredSkill" relation, as SKILL node ids. */
  @Prop({ type: [String], required: true, default: [] })
  requiredSkillIds!: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type CatalogNodeDocument = HydratedDocument<CatalogNodeEntity>;
export const CatalogNodeEntitySchema = SchemaFactory.createForClass(CatalogNodeEntity);
// A parent can't have two children of the same name at the same level (also catches duplicate top-level domains/skills, parentId null).
CatalogNodeEntitySchema.index({ level: 1, parentId: 1, name: 1 }, { unique: true });
CatalogNodeEntitySchema.index({ parentId: 1 });
