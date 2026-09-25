"use client";

import { MatchCandidateSchema, MatchSchema, ServiceRequestSchema, type Match, type MatchCandidate } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Input, Skeleton } from "@fixiyi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { ApiError, apiFetch } from "../../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../../lib/auth-store";
import { CATALOG_TREE_KEY, catalogNames, fetchCatalogTree } from "../../../../lib/catalog";
import { openConversation } from "../../../../lib/chat-api";
import { errorMessage } from "../../../../lib/errors";
import { CANDIDATE_STATUS_LABEL, MATCH_STATUS_LABEL, searchProgress } from "../../../../lib/labels";

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
 * Client view of the progressive dispatch (01_SPEC_PRODUCT.md #15/#18): who
 * was contacted, how far the search reaches, and the manual "search wider"
 * control.
 *
 * Design phase 8 took two things off this screen. The ranking **score** went
 * because it is an implementation detail: showing `0.78` invites a client to
 * compare artisans on a number that means nothing to them, and the engine
 * already explains itself to the back-office. The dispatch **batch** ("vague")
 * went for the same reason — it is a word from `matching.service.ts`. What a
 * client can act on is how many artisans have been reached and how far out
 * the search goes, which is what `searchProgress()` says in one line.
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

  // The service the client chose: `Match` carries the request id, not the
  // service, so the name comes from the request plus the catalogue — the same
  // resolution `/requests` already does.
  const requestQuery = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => ServiceRequestSchema.parse(await apiFetch(`/api/v1/requests/${requestId}`, { auth: true })),
    enabled: hydrated && user !== null,
  });
  const treeQuery = useQuery({ queryKey: CATALOG_TREE_KEY, queryFn: fetchCatalogTree, enabled: hydrated && user !== null });

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

  // The client designates the candidacy the engine created — itself the proof this provider was contacted.
  const chatMutation = useMutation({
    mutationFn: (candidateId: string) => openConversation({ requestId, candidateId }),
    onSuccess: (conversation) => {
      router.push(`/conversations/${conversation.id}`);
    },
    onError: (error: unknown) => {
      setActionError(errorMessage(error, "Impossible d'ouvrir la conversation."));
    },
  });

  const startMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/requests/${requestId}/match`, { method: "POST", auth: true, body: {} }),
    onSuccess: invalidate,
    onError: (error: unknown) => {
      setActionError(errorMessage(error, "Impossible de lancer la recherche."));
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
      setActionError(errorMessage(error, "Impossible d'elargir le rayon."));
    },
  });

  if (!hydrated || !user) {
    return null;
  }

  const match = matchQuery.data ?? null;
  const serviceId = requestQuery.data?.serviceId ?? null;
  const serviceName = serviceId && treeQuery.data ? (catalogNames(treeQuery.data).get(serviceId) ?? null) : null;

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Recherche de fournisseurs</h1>

      {matchQuery.isPending ? (
        <Card>
          <Skeleton lines={4} label="Chargement de votre recherche…" />
        </Card>
      ) : matchQuery.error ? (
        <ErrorState
          message={errorMessage(matchQuery.error, "Impossible de charger votre recherche.")}
          onRetry={() => {
            void matchQuery.refetch();
          }}
        />
      ) : match === null ? (
        <Card>
          <EmptyState
            icon={<Icon name="search" size="xl" />}
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
                <Icon name="search" size="sm" />
                Lancer la recherche
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card title="Ou en est votre demande" headingLevel={2}>
            <p className="mb-2" data-testid="match-status">
              <Badge variant={STATUS_VARIANT[match.status]}>{MATCH_STATUS_LABEL[match.status]}</Badge>
            </p>
            <p data-testid="match-progress">{searchProgress(match.candidateCount, match.currentRadiusKm)}</p>
            {serviceName === null ? null : (
              <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]" data-testid="match-service-name">
                Service demande : {serviceName}
              </p>
            )}
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
                    <Icon name="map" size="sm" />
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
              <ul className="fx-animate-stagger flex flex-col gap-3" data-testid="candidate-list">
                {candidatesQuery.data.map((candidate) => (
                  <li key={candidate.id} className="fx-row" data-testid="candidate-row">
                    {/* The public profile of this artisan — the entry point to it (Decision 70). */}
                    <Link href={`/providers/${candidate.providerId}`} data-testid="candidate-profile-link">
                      <strong className="fx-user-text">{candidate.providerDisplayName}</strong>
                    </Link>
                    <Badge variant={CANDIDATE_VARIANT[candidate.status]}>{CANDIDATE_STATUS_LABEL[candidate.status]}</Badge>
                    <span className="fx-text-muted">a {candidate.distanceKm.toFixed(1)} km</span>
                    {candidate.status === "NOTIFIED" || candidate.status === "VIEWED" ? (
                      <Button
                        variant="ghost"
                        loading={chatMutation.isPending && chatMutation.variables === candidate.id}
                        onClick={() => {
                          setActionError(null);
                          chatMutation.mutate(candidate.id);
                        }}
                        testId="chat-with-provider-button"
                      >
                        <Icon name="message" size="sm" />
                        Envoyer un message
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Icon name="profile" size="xl" />}
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
