import { CatalogTreeNodeSchema, type CatalogTreeNode } from "@fixiyi/contracts";
import { colors } from "@fixiyi/design-tokens";
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

/** Levels the search offers, broadest first — the order results are ranked in. */
const SEARCHABLE_LEVELS: CatalogTreeNode["level"][] = ["DOMAIN", "CATEGORY", "SERVICE", "INTERVENTION_TYPE", "COMPLEXITY"];

export interface CatalogSearchResult {
  node: CatalogTreeNode;
  /** Names from the domain down to the node itself — two nodes can share a name. */
  path: string[];
}

/** Accents off, case off: the seeded catalogue is written "Electricite", people type "électricité". */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Name search over the tree already in cache — no API call, so no request per
 * keystroke. A blank query returns nothing rather than the whole catalogue:
 * the grid on the home page is where browsing belongs.
 */
export function searchCatalog(
  nodes: readonly CatalogTreeNode[],
  query: string,
  options: { domainId?: string | undefined } = {},
): CatalogSearchResult[] {
  const needle = normalise(query.trim());
  if (!needle) return [];

  const results: CatalogSearchResult[] = [];
  const walk = (node: CatalogTreeNode, path: string[]): void => {
    const here = [...path, node.name];
    if (normalise(node.name).includes(needle)) {
      results.push({ node, path: here });
    }
    for (const child of node.children) walk(child, here);
  };
  for (const root of nodes) {
    if (options.domainId === undefined || root.id === options.domainId) walk(root, []);
  }

  return results.sort((a, b) => SEARCHABLE_LEVELS.indexOf(a.node.level) - SEARCHABLE_LEVELS.indexOf(b.node.level));
}

/**
 * The fill colour of a tile, or `null` when the node inherits nothing — a
 * neutral tile then, never a colour picked to fill the gap (D2/D3).
 */
export function tradeFill(accentColor: CatalogTreeNode["accentColor"]): string | null {
  return accentColor === null ? null : colors.trade[accentColor];
}

/**
 * The chain of ids from the domain down to `nodeId`, or `[]` when the node is
 * not in the tree. The request form asks for domain, category and service
 * separately, so arriving with a service id means resolving its ancestors.
 */
export function ancestryOf(nodes: readonly CatalogTreeNode[], nodeId: string): string[] {
  const walk = (node: CatalogTreeNode, trail: string[]): string[] | null => {
    const here = [...trail, node.id];
    if (node.id === nodeId) return here;
    for (const child of node.children) {
      const found = walk(child, here);
      if (found) return found;
    }
    return null;
  };
  for (const root of nodes) {
    const found = walk(root, []);
    if (found) return found;
  }
  return [];
}
