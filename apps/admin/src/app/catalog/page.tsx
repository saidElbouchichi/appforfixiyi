"use client";

import { CatalogTreeNodeSchema, type CatalogLevel, type CatalogTreeNode } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Input, Modal, Skeleton } from "@fixiyi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

/** What the creation dialog is currently collecting a name for. */
interface PendingNode {
  level: CatalogLevel;
  parentId: string | null;
}

/**
 * Minimal back-office catalog screen (docs/phases/PHASE_3_PLAN.md exit
 * criterion) — not the full admin dashboard (that's Phase 12,
 * 06_SCOPE.md). Editing description/order and managing `requiredSkillIds`
 * isn't exposed here yet (documented limitation).
 *
 * Node creation used to call `window.prompt()` (Decision 34); it now uses
 * the design system's `Modal` + `Input` (Decision 47) — a native prompt is
 * unstyleable, untranslatable, blocks the event loop, is silently
 * suppressed by some browsers, and is unreachable for a screen-reader user
 * who never hears it announced.
 */
export default function CatalogPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const queryClient = useQueryClient();

  const [pendingNode, setPendingNode] = useState<PendingNode | null>(null);
  const [nodeName, setNodeName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const treeQuery = useQuery({ queryKey: CATALOG_TREE_QUERY_KEY, queryFn: fetchTree, enabled: hydrated && user !== null });

  const createMutation = useMutation({
    mutationFn: (input: { level: CatalogLevel; parentId: string | null; name: string }) =>
      apiFetch("/api/v1/catalog/nodes", { method: "POST", auth: true, body: input }),
    onSuccess: async () => {
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: CATALOG_TREE_QUERY_KEY });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (node: CatalogTreeNode) =>
      node.active
        ? apiFetch(`/api/v1/catalog/nodes/${node.id}`, { method: "DELETE", auth: true })
        : apiFetch(`/api/v1/catalog/nodes/${node.id}`, { method: "PATCH", auth: true, body: { active: true } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_TREE_QUERY_KEY }),
  });

  function openDialog(level: CatalogLevel, parentId: string | null): void {
    setPendingNode({ level, parentId });
    setNodeName("");
    setNameError(null);
  }

  function closeDialog(): void {
    setPendingNode(null);
    setNodeName("");
    setNameError(null);
  }

  function submitDialog(): void {
    if (!pendingNode) {
      return;
    }
    const name = nodeName.trim();
    if (!name) {
      setNameError("Donnez un nom au noeud.");
      return;
    }
    createMutation.mutate({ level: pendingNode.level, parentId: pendingNode.parentId, name });
  }

  if (!hydrated || !user) {
    return null;
  }
  if (!isAdminOrManager(user)) {
    return (
      <main className="fx-page fx-page--wide">
        <ErrorState title="Acces refuse" message="Cet ecran est reserve aux roles ADMIN et MANAGER." />
      </main>
    );
  }

  const error = treeQuery.error ?? createMutation.error ?? toggleMutation.error;
  const busy = createMutation.isPending || toggleMutation.isPending;

  return (
    <main className="fx-page fx-page--wide">
      <div className="fx-page__header">
        <h1 className="fx-page__title">Catalogue de services</h1>
        <div className="fx-row">
          <Button
            onClick={() => {
              openDialog("DOMAIN", null);
            }}
            disabled={busy}
            testId="add-domain-button"
          >
            <Icon name="add" size="sm" />
            Domaine
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              openDialog("SKILL", null);
            }}
            disabled={busy}
            testId="add-skill-button"
          >
            <Icon name="add" size="sm" />
            Competence
          </Button>
        </div>
      </div>

      {error ? (
        <div className="fx-animate-fade-in">
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
          <ul className="fx-animate-fade-in flex flex-col gap-1">
            {treeQuery.data.map((node) => (
              <TreeNodeRow
                key={node.id}
                node={node}
                onAddChild={openDialog}
                onToggleActive={(target) => {
                  toggleMutation.mutate(target);
                }}
                busy={busy}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Icon name="tools" size="xl" />}
            title="Catalogue vide"
            message="Commencez par creer un domaine de services."
            action={
              <Button
                onClick={() => {
                  openDialog("DOMAIN", null);
                }}
              >
                <Icon name="add" size="sm" />
                Creer un domaine
              </Button>
            }
          />
        )}
      </Card>

      <Modal
        open={pendingNode !== null}
        title={pendingNode === null ? "" : `Nouveau noeud (${pendingNode.level})`}
        onClose={closeDialog}
        testId="create-node-modal"
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Annuler
            </Button>
            <Button loading={createMutation.isPending} onClick={submitDialog} testId="create-node-submit">
              Creer
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitDialog();
          }}
        >
          <Input
            label="Nom"
            value={nodeName}
            onChange={(value) => {
              setNodeName(value);
              setNameError(null);
            }}
            error={nameError}
            placeholder="Electricite"
            required
            testId="create-node-name"
          />
        </form>
      </Modal>
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
      <div className="fx-row py-1">
        <Badge variant={node.active ? "info" : "warning"}>{node.level}</Badge>
        <span className={node.active ? "" : "text-[var(--fixiyi-color-text-subtle)] line-through"}>{node.name}</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            onToggleActive(node);
          }}
        >
          <Icon name={node.active ? "close" : "check"} size="sm" />
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
            <Icon name="add" size="sm" />
            {childLevel}
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
