"use client";

import type { CatalogTreeNode } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Icon, SearchBar, Select, Skeleton } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { ApiError } from "../../lib/api-client";
import { CATALOG_TREE_KEY, fetchCatalogTree, searchCatalog } from "../../lib/catalog";

/** Only a SERVICE can start a request: that is the level the form asks for. */
const REQUESTABLE_LEVEL = "SERVICE";

const LEVEL_LABEL: Record<CatalogTreeNode["level"], string> = {
  DOMAIN: "Domaine",
  CATEGORY: "Categorie",
  SERVICE: "Service",
  INTERVENTION_TYPE: "Type d'intervention",
  COMPLEXITY: "Complexite",
  SKILL: "Competence",
};

function SearchResults(): React.JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [domainId, setDomainId] = useState(params.get("domain") ?? "");

  const treeQuery = useQuery({ queryKey: CATALOG_TREE_KEY, queryFn: fetchCatalogTree });
  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const results = useMemo(
    () => searchCatalog(tree, query, domainId ? { domainId } : {}),
    [tree, query, domainId],
  );

  const domain = tree.find((node) => node.id === domainId);

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Rechercher un service</h1>

      <SearchBar
        label="Rechercher un service"
        value={query}
        onChange={setQuery}
        placeholder="Panne electrique, fuite d'eau…"
        testId="services-search"
      />

      {tree.length > 0 ? (
        <Select
          label="Domaine"
          value={domainId}
          onChange={setDomainId}
          placeholder="Tous les domaines"
          testId="services-domain-filter"
          options={tree.map((node) => ({ value: node.id, label: node.name }))}
        />
      ) : null}

      {treeQuery.isPending ? (
        <Card>
          <Skeleton lines={3} label="Chargement du catalogue…" />
        </Card>
      ) : treeQuery.error ? (
        <ErrorState
          message={treeQuery.error instanceof ApiError ? treeQuery.error.message : "Impossible de charger le catalogue."}
          onRetry={() => {
            void treeQuery.refetch();
          }}
        />
      ) : query.trim() === "" ? (
        <Card>
          <EmptyState
            icon={<Icon name="search" size="xl" />}
            title={domain ? `Domaine : ${domain.name}` : "Que cherchez-vous ?"}
            message="Tapez le nom d'un service — « prise », « fuite », « panne »."
          />
        </Card>
      ) : results.length > 0 ? (
        <ul className="fx-animate-stagger flex flex-col gap-3" data-testid="services-results">
          {results.map(({ node, path }) => (
            <li key={node.id} data-testid="services-result">
              <Card>
                <div className="fx-row mb-2">
                  {node.level === REQUESTABLE_LEVEL ? (
                    <Link href={`/requests/new?serviceId=${node.id}`} data-testid="services-result-link">
                      <strong>{node.name}</strong>
                    </Link>
                  ) : (
                    <strong>{node.name}</strong>
                  )}
                  <Badge variant="neutral">{LEVEL_LABEL[node.level]}</Badge>
                </div>
                {/* Two nodes can share a name; the ancestry is what tells them apart. */}
                <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]">{path.join(" › ")}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="search" size="xl" />}
            title="Aucun service ne correspond"
            message="Essayez un autre mot, ou repartez des domaines depuis l'accueil."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  router.push("/");
                }}
              >
                Voir les domaines
              </Button>
            }
          />
        </Card>
      )}
    </main>
  );
}

/**
 * Catalogue search — over the tree already in cache, so no request leaves per
 * keystroke and the field stays usable offline once the catalogue is loaded.
 *
 * It searches SERVICES, not artisans: no route lists providers, and opening
 * one would mean publishing personal data in a design phase (Decision 71).
 * Only a SERVICE result links onward, because a request is what the product
 * can actually start from here.
 */
export default function ServicesPage(): React.JSX.Element {
  return (
    // useSearchParams() needs a Suspense boundary to prerender (Next.js).
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
