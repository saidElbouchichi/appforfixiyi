"use client";

import { Button, Card, EmptyState, ErrorState, Icon, SearchBar, Skeleton } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../lib/auth-store";
import { CATALOG_TREE_KEY, fetchCatalogTree } from "../lib/catalog";
import { NAV_HREFS } from "../lib/navigation";
import { startRouteFor } from "../lib/start-route";

import { ServiceTile } from "./service-tile";

/**
 * The home screen: the real catalogue, as a grid of its domains.
 *
 * Until design phase 7 this route was a bare redirect to each role's start
 * screen, which left the product with no front door — a signed-out visitor
 * landed on the login form. `startRouteFor()` still decides where a fresh
 * login lands (Decision 65); it no longer decides what `/` shows.
 *
 * The grid holds exactly what the catalogue holds. It looks sparser than the
 * design board, which drew ten trades: the board is a drawing, the catalogue
 * is the database, and filling it is the administrator's job — not this
 * screen's, which would mean inventing services nobody can order.
 */
export default function HomePage(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const [query, setQuery] = useState("");

  const treeQuery = useQuery({ queryKey: CATALOG_TREE_KEY, queryFn: fetchCatalogTree });

  function goToSearch(value: string): void {
    const trimmed = value.trim();
    router.push(trimmed ? `/services?q=${encodeURIComponent(trimmed)}` : "/services");
  }

  return (
    <main className="fx-page fx-page--wide">
      <div className="fx-page__header">
        <div>
          <h1 className="fx-page__title">Trouvez un artisan de confiance</h1>
          <p className="text-[var(--fixiyi-color-text-muted)]">Choisissez un domaine, decrivez votre besoin, recevez des propositions.</p>
        </div>
        {hydrated ? (
          <Button
            testId="home-primary-action"
            onClick={() => {
              router.push(user ? NAV_HREFS.newRequest : "/login");
            }}
          >
            {/* The plus belongs to creating a request; signing in is not a creation. */}
            {user ? <Icon name="add" size="sm" /> : null}
            {user ? "Demander un service" : "Se connecter"}
          </Button>
        ) : null}
      </div>

      <SearchBar
        label="Rechercher un service"
        value={query}
        onChange={setQuery}
        onSubmit={goToSearch}
        placeholder="Panne electrique, fuite d'eau…"
        testId="home-search"
      />

      <Card>
        <h2 className="fx-card__title">Domaines de services</h2>
        {treeQuery.isPending ? (
          <Skeleton lines={3} label="Chargement du catalogue…" />
        ) : treeQuery.error ? (
          <ErrorState
            message={treeQuery.error instanceof ApiError ? treeQuery.error.message : "Impossible de charger le catalogue."}
            onRetry={() => {
              void treeQuery.refetch();
            }}
          />
        ) : treeQuery.data.length > 0 ? (
          <ul className="fx-tile-grid fx-animate-stagger" data-testid="domain-grid">
            {treeQuery.data.map((domain) => (
              <ServiceTile key={domain.id} node={domain} href={`/services?domain=${domain.id}`} testId="domain-tile" />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Icon name="tools" size="xl" />}
            title="Catalogue en cours de constitution"
            message="Aucun domaine de services n'est encore publie."
          />
        )}
      </Card>

      {hydrated && user ? (
        <p>
          <Button
            variant="secondary"
            testId="home-start-route"
            onClick={() => {
              router.push(startRouteFor(user));
            }}
          >
            Reprendre ou j&apos;en etais
          </Button>
        </p>
      ) : null}
    </main>
  );
}
