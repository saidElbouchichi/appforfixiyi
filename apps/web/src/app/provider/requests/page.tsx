"use client";

import { ProviderMatchSchema, type ProviderMatch } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@fixiyi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";

import { ApiError, apiFetch } from "../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../lib/auth-store";

const ProviderMatchListSchema = z.array(ProviderMatchSchema);
const PROVIDER_MATCHES_KEY = ["provider-matches"];

function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

/**
 * First provider-facing screen. It deliberately shows only what
 * 01_SPEC_PRODUCT.md #17 allows before acceptance: an APPROXIMATE location
 * (the API never sends the exact one), the distance, and the travel fee the
 * engine computed — never the client's address, and never another
 * provider's candidacy.
 */
export default function ProviderRequestsPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const matchesQuery = useQuery({
    queryKey: PROVIDER_MATCHES_KEY,
    queryFn: async (): Promise<ProviderMatch[]> => ProviderMatchListSchema.parse(await apiFetch("/api/v1/matches/mine", { auth: true })),
    enabled: hydrated && user !== null,
  });

  const declineMutation = useMutation({
    mutationFn: (candidateId: string) =>
      apiFetch(`/api/v1/matches/candidates/${candidateId}/decline`, { method: "POST", auth: true, body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROVIDER_MATCHES_KEY }),
  });

  if (!hydrated || !user) {
    return null;
  }

  const isProvider = user.roles.includes("PROVIDER");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Demandes recues</h1>

      {!isProvider ? (
        <ErrorState title="Acces refuse" message="Cet ecran est reserve aux comptes fournisseur." />
      ) : matchesQuery.isPending ? (
        <Card>
          <Skeleton lines={4} label="Chargement des demandes…" />
        </Card>
      ) : matchesQuery.error ? (
        <ErrorState
          message={matchesQuery.error instanceof ApiError ? matchesQuery.error.message : "Impossible de charger les demandes."}
          onRetry={() => {
            void matchesQuery.refetch();
          }}
        />
      ) : matchesQuery.data.length > 0 ? (
        <ul className="flex flex-col gap-4" data-testid="provider-match-list">
          {matchesQuery.data.map((match) => (
            <li key={match.candidateId} data-testid="provider-match-row">
              <Card>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant={match.urgency === "URGENT" ? "warning" : "info"}>{match.urgency}</Badge>
                  <Badge variant={match.status === "VIEWED" ? "success" : "info"}>{match.status}</Badge>
                  <span className="text-sm text-[var(--fixiyi-color-neutral-600)]">{match.distanceKm.toFixed(1)} km</span>
                </div>

                <p className="mb-3">{match.description}</p>

                <p className="mb-1 text-sm text-[var(--fixiyi-color-neutral-600)]" data-testid="approximate-location">
                  Zone approximative : {match.approximateLocation.coordinates[1].toFixed(2)},{" "}
                  {match.approximateLocation.coordinates[0].toFixed(2)}
                </p>
                <p className="mb-1 text-sm text-[var(--fixiyi-color-neutral-600)]">
                  Adresse exacte communiquee apres acceptation de l&apos;offre.
                </p>
                <p className="mb-3 text-sm text-[var(--fixiyi-color-neutral-600)]" data-testid="transport-quote">
                  Deplacement :{" "}
                  {match.transportQuote.isFree ? "inclus" : formatMoney(match.transportQuote.amountMinor, match.transportQuote.currency)} ·{" "}
                  {match.transportQuote.travelTimeMinutes.toString()} min estimees
                </p>

                {match.mediaCount > 0 ? (
                  <p className="mb-3 text-sm text-[var(--fixiyi-color-neutral-600)]">
                    {match.mediaCount.toString()} media(s) joint(s) par le client
                  </p>
                ) : null}

                <Button
                  variant="secondary"
                  loading={declineMutation.isPending}
                  onClick={() => {
                    declineMutation.mutate(match.candidateId);
                  }}
                  testId="decline-button"
                >
                  Refuser
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="Aucune demande pour le moment"
            message="Les demandes correspondant a vos services, vos competences et votre zone apparaitront ici. Verifiez que votre statut est 'disponible'."
          />
        </Card>
      )}
    </main>
  );
}
