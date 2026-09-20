"use client";

import { CatalogTreeNodeSchema, type CatalogLevel, type CatalogTreeNode } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@fixiyi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";

import { ApiError, apiFetch } from "../../lib/api-client";
import { isAdminOrManager, useAuthHydrated, useAuthStore } from "../../lib/auth-store";

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
 * 06_SCOPE.md). Node creation uses a plain `window.prompt()` for the name
 * rather than a polished modal (Decision 34): genuinely calls the real API
 * with real validation, just unpolished UX. Editing description/order and
 * managing `requiredSkillIds` isn't exposed here yet (documented
 * limitation).
 */
export default function CatalogPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const treeQuery = useQuery({ queryKey: CATALOG_TREE_QUERY_KEY, queryFn: fetchTree, enabled: hydrated && user !== null });

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

  if (!hydrated || !user) {
    return null;
  }
  if (!isAdminOrManager(user)) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <ErrorState title="Acces refuse" message="Cet ecran est reserve aux roles ADMIN et MANAGER." />
      </main>
    );
  }

  const error = treeQuery.error ?? createMutation.error ?? toggleMutation.error;
  const busy = createMutation.isPending || toggleMutation.isPending;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Catalogue de services</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              createNode("DOMAIN", null);
            }}
            disabled={busy}
            testId="add-domain-button"
          >
            + Domaine
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              createNode("SKILL", null);
            }}
            disabled={busy}
            testId="add-skill-button"
          >
            + Competence
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorState
            message={error instanceof ApiError ? error.message : "Impossible de charger le catalogue."}
            onRetry={() => {
              void treeQuery.refetch();
            }}
          />
        </div>
      ) : null}

      <Card>
        {treeQuery.isPending ? (
          <Skeleton lines={6} label="Chargement du catalogue…" />
        ) : treeQuery.data && treeQuery.data.length > 0 ? (
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
          <EmptyState
            title="Catalogue vide"
            message="Commencez par creer un domaine de services."
            action={
              <Button
                onClick={() => {
                  createNode("DOMAIN", null);
                }}
              >
                Creer un domaine
              </Button>
            }
          />
        )}
      </Card>
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
    <li style={{ marginInlineStart: depth * 16 }}>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <Badge variant={node.active ? "info" : "warning"}>{node.level}</Badge>
        <span className={node.active ? "" : "text-[var(--fixiyi-color-neutral-400)] line-through"}>{node.name}</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            onToggleActive(node);
          }}
        >
          {node.active ? "Desactiver" : "Reactiver"}
        </Button>
        {childLevel ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              onAddChild(childLevel, node.id);
            }}
          >
            + {childLevel}
          </Button>
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
