import { CatalogTreeNodeSchema, type CatalogTreeNode } from "@fixiyi/contracts";
import { z } from "zod";

import { apiFetch } from "./api-client";

const TreeListSchema = z.array(CatalogTreeNodeSchema);

export const CATALOG_TREE_KEY = ["catalog-tree"];

export async function fetchCatalogTree(): Promise<CatalogTreeNode[]> {
  return TreeListSchema.parse(await apiFetch("/api/v1/catalog/tree"));
}

/** Node id -> name, every level flattened: a request stores ids, a screen shows names. */
export function catalogNames(nodes: readonly CatalogTreeNode[]): Map<string, string> {
  const names = new Map<string, string>();
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    names.set(node.id, node.name);
    stack.push(...node.children);
  }
  return names;
}
