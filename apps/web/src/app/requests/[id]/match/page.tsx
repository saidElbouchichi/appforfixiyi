"use client";

import { MatchCandidateSchema, MatchSchema, type Match, type MatchCandidate } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Skeleton } from "@fixiyi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { ApiError, apiFetch } from "../../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../../lib/auth-store";

const CandidateListSchema = z.array(MatchCandidateSchema);

const STATUS_VARIANT: Record<Match["status"], "info" | "success" | "warning"> = {
  ACTIVE: "info",
  EXHAUSTED: "warning",
  CANCELLED: "warning",
};

const CANDIDATE_VARIANT: Record<MatchCandidate["status"], "info" | "success" | "warning" | "error"> = {
  NOTIFIED: "info",
  VIEWED: "success",
  DECLINED: "warning",
  EXPIRED: "error",
};

/**
 * Client view of the progressive dispatch (01_SPEC_PRODUCT.md #15/#18):
 * how many providers were contacted, in which wave, at which radius — and
 * the manual "search wider" control. The scores are shown because the
 * client is entitled to see that the selection is not arbitrary.
 */
export default function MatchPage(): React.JSX.Element | null {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const queryClient = useQueryClient();

  const [radiusInput, setRadiusInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const matchQuery = useQuery({
    queryKey: ["match", requestId],
    queryFn: async (): Promise<Match | null> => {
      try {
        return MatchSchema.parse(await apiFetch(`/api/v1/requests/${requestId}/match`, { auth: true }));
      } catch (error) {
        // 404 simply means the client has not started the search yet.
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: hydrated && user !== null,
  });

  const candidatesQuery = useQuery({
    queryKey: ["match-candidates", requestId],
    queryFn: async (): Promise<MatchCandidate[]> =>
      CandidateListSchema.parse(await apiFetch(`/api/v1/requests/${requestId}/match/candidates`, { auth: true })),
    enabled: hydrated && user !== null && matchQuery.data != null,
  });

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["match", requestId] });
    await queryClient.invalidateQueries({ queryKey: ["match-candidates", requestId] });
  };

  const startMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/requests/${requestId}/match`, { method: "POST", auth: true, body: {} }),
    onSuccess: invalidate,
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : "Impossible de lancer la recherche.");
    },
  });

  const expandMutation = useMutation({
    mutationFn: (radiusKm: number) =>
      apiFetch(`/api/v1/requests/${requestId}/match/expand-radius`, { method: "POST", auth: true, body: { radiusKm } }),
    onSuccess: async () => {
      setRadiusInput("");
      await invalidate();
    },
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : "Impossible d'elargir le rayon.");
    },
  });

  if (!hydrated || !user) {
    return null;
  }

  const match = matchQuery.data ?? null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Recherche de fournisseurs</h1>

      {matchQuery.isPending ? (
        <Card>
          <Skeleton lines={4} label="Chargement du matching…" />
        </Card>
      ) : matchQuery.error ? (
        <ErrorState
          message={matchQuery.error instanceof ApiError ? matchQuery.error.message : "Impossible de charger le matching."}
          onRetry={() => {
            void matchQuery.refetch();
          }}
        />
      ) : match === null ? (
        <Card>
          <EmptyState
            title="Recherche non demarree"
            message="Lancez la recherche pour que Fixiyi contacte progressivement les fournisseurs pertinents."
            action={
              <Button
                loading={startMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  startMutation.mutate();
                }}
                testId="start-match-button"
              >
                Lancer la recherche
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card title="Etat de la recherche" headingLevel={2}>
            <p className="mb-2" data-testid="match-status">
              Statut : <Badge variant={STATUS_VARIANT[match.status]}>{match.status}</Badge>
            </p>
            <p className="mb-2" data-testid="match-radius">
              Rayon de recherche : <strong>{match.currentRadiusKm.toString()} km</strong>
            </p>
            <p className="mb-2" data-testid="match-batch-count">
              Vagues envoyees : <strong>{match.batchCount.toString()}</strong>
            </p>
            <p data-testid="match-candidate-count">
              Fournisseurs contactes : <strong>{match.candidateCount.toString()}</strong>
            </p>
          </Card>

          {match.status === "ACTIVE" ? (
            <Card title="Elargir la recherche" headingLevel={2}>
              <div className="flex flex-col gap-3">
                <Input
                  label="Nouveau rayon (km)"
                  type="number"
                  value={radiusInput}
                  onChange={setRadiusInput}
                  hint={`Doit etre superieur au rayon actuel (${match.currentRadiusKm.toString()} km).`}
                  testId="expand-radius-input"
                />
                <div>
                  <Button
                    variant="secondary"
                    loading={expandMutation.isPending}
                    disabled={radiusInput.trim() === ""}
                    onClick={() => {
                      setActionError(null);
                      expandMutation.mutate(Number(radiusInput));
                    }}
                    testId="expand-radius-button"
                  >
                    Chercher plus loin
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card title="Fournisseurs contactes" headingLevel={2}>
            {candidatesQuery.isPending ? (
              <Skeleton lines={3} label="Chargement des fournisseurs…" />
            ) : candidatesQuery.data && candidatesQuery.data.length > 0 ? (
              <ul className="flex flex-col gap-3" data-testid="candidate-list">
                {candidatesQuery.data.map((candidate) => (
                  <li key={candidate.id} className="flex flex-wrap items-center gap-2" data-testid="candidate-row">
                    <strong>{candidate.providerDisplayName}</strong>
                    <Badge variant={CANDIDATE_VARIANT[candidate.status]}>{candidate.status}</Badge>
                    <span className="text-sm text-[var(--fixiyi-color-neutral-600)]">
                      vague {(candidate.batchIndex + 1).toString()} · {candidate.distanceKm.toFixed(1)} km · score{" "}
                      {candidate.score.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucun fournisseur contacte"
                message="Aucun fournisseur disponible ne correspond encore. Essayez d'elargir le rayon."
              />
            )}
          </Card>
        </>
      )}

      {actionError === null ? null : (
        <p className="fx-field__error" role="alert" data-testid="match-error">
          {actionError}
        </p>
      )}
    </main>
  );
}
