"use client";

import { CatalogTreeNodeSchema, type CatalogLevel, type CatalogTreeNode } from "@fixiyi/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";

import { ApiError, apiFetch } from "../../lib/api-client";
import { isAdminOrManager, useAuthStore } from "../../lib/auth-store";

/** Inverse of @fixiyi/contracts' `CATALOG_PARENT_LEVEL` — what a node of this level's children must be, if any. */
const CHILD_LEVEL: Record<CatalogLevel, CatalogLevel | null> = {
  DOMAIN: "CATEGORY",
  CATEGORY: "SERVICE",
  SERVICE: "INTERVENTION_TYPE",
  INTERVENTION_TYPE: "COMPLEXITY",
  COMPLEXITY: null,
  SKILL: null,
};

const TreeListSchema = z.array(CatalogTreeNodeSchema);
const CATALOG_TREE_QUERY_KEY = ["catalog-tree"];

async function fetchTree(): Promise<CatalogTreeNode[]> {
  return TreeListSchema.parse(await apiFetch("/api/v1/catalog/tree?includeInactive=true"));
}

/**
 * Minimal back-office catalog screen (docs/phases/PHASE_3_PLAN.md exit
 * criterion) — not the full admin dashboard (that's Phase 12,
 * 06_SCOPE.md). First real use of TanStack Query since it was wired in
 * Phase 1. Node creation uses a plain `window.prompt()` for the name
 * rather than a polished modal: genuinely calls the real API with real
 * validation, just unpolished UX, an accepted trade-off for "minimal".
 * Editing description/order and managing `requiredSkillIds` isn't exposed
 * here yet (documented limitation).
 */
export default function CatalogPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  const treeQuery = useQuery({ queryKey: CATALOG_TREE_QUERY_KEY, queryFn: fetchTree, enabled: user !== null });

  const createMutation = useMutation({
    mutationFn: (input: { level: CatalogLevel; parentId: string | null; name: string }) =>
      apiFetch("/api/v1/catalog/nodes", { method: "POST", auth: true, body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_TREE_QUERY_KEY }),
  });

  const toggleMutation = useMutation({
    mutationFn: (node: CatalogTreeNode) =>
      node.active
        ? apiFetch(`/api/v1/catalog/nodes/${node.id}`, { method: "DELETE", auth: true })
        : apiFetch(`/api/v1/catalog/nodes/${node.id}`, { method: "PATCH", auth: true, body: { active: true } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_TREE_QUERY_KEY }),
  });

  function createNode(level: CatalogLevel, parentId: string | null): void {
    const name = window.prompt(`Nom du nouveau noeud (${level})`);
    if (!name) {
      return;
    }
    createMutation.mutate({ level, parentId, name });
  }

  if (!user) {
    return null;
  }
  if (!isAdminOrManager(user)) {
    return (
      <main className="p-8">
        <p>Acces refuse — reserve aux roles ADMIN / MANAGER.</p>
      </main>
    );
  }

  const error = treeQuery.error ?? createMutation.error ?? toggleMutation.error;
  const busy = createMutation.isPending || toggleMutation.isPending;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Catalogue de services</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              createNode("DOMAIN", null);
            }}
            className="rounded bg-[var(--fixiyi-color-primary-600)] px-3 py-1.5 text-sm text-white"
          >
            + Domaine
          </button>
          <button
            onClick={() => {
              createNode("SKILL", null);
            }}
            className="rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-1.5 text-sm"
          >
            + Competence
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error instanceof ApiError ? error.message : "Une erreur est survenue."}</p> : null}

      {treeQuery.data ? (
        <ul className="flex flex-col gap-1">
          {treeQuery.data.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              onAddChild={createNode}
              onToggleActive={(target) => {
                toggleMutation.mutate(target);
              }}
              busy={busy}
            />
          ))}
        </ul>
      ) : (
        <p>Chargement...</p>
      )}
    </main>
  );
}

function TreeNodeRow({
  node,
  onAddChild,
  onToggleActive,
  busy,
  depth = 0,
}: {
  node: CatalogTreeNode;
  onAddChild: (level: CatalogLevel, parentId: string) => void;
  onToggleActive: (node: CatalogTreeNode) => void;
  busy: boolean;
  depth?: number;
}): React.JSX.Element {
  const childLevel = CHILD_LEVEL[node.level];
  return (
    <li style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 py-1">
        <span className="rounded bg-[var(--fixiyi-color-neutral-100)] px-2 py-0.5 text-xs uppercase text-[var(--fixiyi-color-neutral-600)]">
          {node.level}
        </span>
        <span className={node.active ? "" : "text-[var(--fixiyi-color-neutral-400)] line-through"}>{node.name}</span>
        <button
          disabled={busy}
          onClick={() => {
            onToggleActive(node);
          }}
          className="text-xs text-[var(--fixiyi-color-primary-600)] underline"
        >
          {node.active ? "Desactiver" : "Reactiver"}
        </button>
        {childLevel ? (
          <button
            disabled={busy}
            onClick={() => {
              onAddChild(childLevel, node.id);
            }}
            className="text-xs text-[var(--fixiyi-color-primary-600)] underline"
          >
            + {childLevel}
          </button>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <TreeNodeRow key={child.id} node={child} onAddChild={onAddChild} onToggleActive={onToggleActive} busy={busy} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
