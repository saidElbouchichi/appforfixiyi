import {
  CATALOG_PARENT_LEVEL,
  type CatalogLevel,
  type CatalogNode,
  type CatalogTreeNode,
  type CreateCatalogNodeInput,
  type UpdateCatalogNodeInput,
} from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";

import { CatalogNodeEntity, type CatalogNodeDocument } from "./schemas/catalog-node.schema.js";

/**
 * CRUD generique sur `catalog_nodes` (01_SPEC_PRODUCT.md #8) — valide les
 * regles de parente par niveau (`CATALOG_PARENT_LEVEL`) plutot que de
 * dupliquer un service quasi-identique par niveau.
 */
@Injectable()
export class CatalogService {
  constructor(@InjectModel(CatalogNodeEntity.name) private readonly model: Model<CatalogNodeEntity>) {}

  /** Nested tree for client-facing browsing (01_SPEC_PRODUCT.md #9 "Choisir un service") — excludes the flat SKILL catalog. */
  async getTree(includeInactive = false): Promise<CatalogTreeNode[]> {
    const filter: Record<string, unknown> = { level: { $ne: "SKILL" } };
    if (!includeInactive) {
      filter.active = true;
    }
    const nodes = await this.model.find(filter).sort({ order: 1, name: 1 });
    return buildTree(nodes.map(toCatalogNode));
  }

  async listByLevel(level: CatalogLevel, parentId: string | undefined, includeInactive: boolean): Promise<CatalogNode[]> {
    const filter: Record<string, unknown> = { level };
    if (parentId !== undefined) {
      filter.parentId = parentId;
    }
    if (!includeInactive) {
      filter.active = true;
    }
    const nodes = await this.model.find(filter).sort({ order: 1, name: 1 });
    return nodes.map(toCatalogNode);
  }

  async create(input: CreateCatalogNodeInput): Promise<CatalogNode> {
    const parentId = input.parentId ?? null;
    await this.assertValidParent(input.level, parentId);

    const requiredSkillIds = input.requiredSkillIds ?? [];
    await this.assertValidRequiredSkills(input.level, requiredSkillIds);

    const created = await this.model.create({
      _id: generateId(),
      level: input.level,
      parentId,
      name: input.name,
      description: input.description ?? null,
      order: input.order ?? 0,
      active: true,
      requiredSkillIds,
    });
    return toCatalogNode(created);
  }

  async update(id: string, input: UpdateCatalogNodeInput): Promise<CatalogNode> {
    const node = await this.model.findById(id);
    if (!node) {
      throw new NotFoundException("Catalog node not found");
    }

    if (input.requiredSkillIds) {
      await this.assertValidRequiredSkills(node.level, input.requiredSkillIds);
      node.requiredSkillIds = input.requiredSkillIds;
    }
    if (input.name !== undefined) node.name = input.name;
    if (input.description !== undefined) node.description = input.description;
    if (input.order !== undefined) node.order = input.order;
    if (input.active !== undefined) node.active = input.active;

    await node.save();
    return toCatalogNode(node);
  }

  /** Soft delete only — a hard delete would risk orphaning future references (offers/requests, Phase 4+) to this node's id. */
  async deactivate(id: string): Promise<void> {
    const node = await this.model.findById(id);
    if (!node) {
      throw new NotFoundException("Catalog node not found");
    }
    node.active = false;
    await node.save();
  }

  private async assertValidParent(level: CatalogLevel, parentId: string | null): Promise<void> {
    const expectedParentLevel = CATALOG_PARENT_LEVEL[level];

    if (expectedParentLevel === null) {
      if (parentId !== null) {
        throw new DomainHttpException(HttpStatus.BAD_REQUEST, "CATALOG_PARENT_NOT_ALLOWED", `A ${level} node cannot have a parent.`);
      }
      return;
    }

    if (!parentId) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "CATALOG_PARENT_REQUIRED",
        `A ${level} node requires a parentId referencing a ${expectedParentLevel} node.`,
      );
    }
    const parent = await this.model.findById(parentId);
    if (parent?.level !== expectedParentLevel) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "CATALOG_PARENT_INVALID",
        `parentId must reference an existing ${expectedParentLevel} node.`,
      );
    }
  }

  /** Reusable by other modules (e.g. ProviderService validating `skillIds`/`serviceIds`) — how many of `ids` are real, existing nodes of `level`. */
  async countExisting(ids: string[], level: CatalogLevel): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    return this.model.countDocuments({ _id: { $in: ids }, level });
  }

  /** Reusable by other modules (e.g. RequestService validating a service/interventionType/complexity parent chain) — `null`, not a throw, when absent. */
  async getById(id: string): Promise<CatalogNode | null> {
    const node = await this.model.findById(id);
    return node ? toCatalogNode(node) : null;
  }

  private async assertValidRequiredSkills(level: CatalogLevel, skillIds: string[]): Promise<void> {
    if (skillIds.length === 0) {
      return;
    }
    if (level !== "COMPLEXITY") {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "CATALOG_REQUIRED_SKILLS_NOT_ALLOWED",
        "requiredSkillIds only applies to COMPLEXITY nodes.",
      );
    }
    const count = await this.countExisting(skillIds, "SKILL");
    if (count !== new Set(skillIds).size) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "CATALOG_SKILL_INVALID", "requiredSkillIds must reference existing SKILL nodes.");
    }
  }
}

function toCatalogNode(doc: CatalogNodeDocument): CatalogNode {
  return {
    id: doc._id,
    level: doc.level,
    parentId: doc.parentId,
    name: doc.name,
    description: doc.description,
    order: doc.order,
    active: doc.active,
    requiredSkillIds: doc.requiredSkillIds,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function buildTree(nodes: CatalogNode[]): CatalogTreeNode[] {
  const byId = new Map<string, CatalogTreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }
  const roots: CatalogTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
