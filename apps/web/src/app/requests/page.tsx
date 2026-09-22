"use client";

import { ServiceRequestSchema, type RequestStatus, type ServiceRequest } from "@fixiyi/contracts";
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Skeleton, type BadgeVariant } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";

import { ApiError, apiFetch } from "../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../lib/auth-store";
import { CATALOG_TREE_KEY, catalogNames, fetchCatalogTree } from "../../lib/catalog";
import { NAV_HREFS, requestHref } from "../../lib/navigation";

const RequestListSchema = z.array(ServiceRequestSchema);
const REQUESTS_KEY = ["my-requests"];

const DATE_FORMAT = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: "Brouillon",
  REQUESTED: "Envoyee",
  MATCHING: "Recherche en cours",
  CANCELLED: "Annulee",
  EXPIRED: "Expiree",
};

const STATUS_VARIANT: Record<RequestStatus, BadgeVariant> = {
  DRAFT: "neutral",
  REQUESTED: "info",
  MATCHING: "success",
  CANCELLED: "warning",
  EXPIRED: "warning",
};

async function fetchMyRequests(): Promise<ServiceRequest[]> {
  return RequestListSchema.parse(await apiFetch("/api/v1/requests/mine", { auth: true }));
}

function RequestRow({ request, serviceName }: { request: ServiceRequest; serviceName: string }): React.JSX.Element {
  const href = requestHref(request);
  return (
    <li data-testid="request-row">
      <Card>
        <div className="fx-row mb-2">
          {href ? (
            <Link href={href} data-testid="request-link">
              <strong>{serviceName}</strong>
            </Link>
          ) : (
            <strong>{serviceName}</strong>
          )}
          <Badge variant={STATUS_VARIANT[request.status]} testId="request-status">
            {STATUS_LABEL[request.status]}
          </Badge>
          {request.urgency === "URGENT" ? <Badge variant="warning">Urgent</Badge> : null}
        </div>
        {request.description ? <p className="mb-2">{request.description}</p> : null}
        <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]">Creee le {DATE_FORMAT.format(new Date(request.createdAt))}</p>
      </Card>
    </li>
  );
}

/**
 * The client's own requests — the destination of the "Mes demandes" entry
 * (phase 6 of the design rework). A row links where something can actually be
 * done: a draft back to the form (which resumes it), a live request to its
 * matching screen; a cancelled or expired one links nowhere rather than to a
 * dead end.
 */
export default function MyRequestsPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const enabled = hydrated && user !== null;

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const requestsQuery = useQuery({ queryKey: REQUESTS_KEY, queryFn: fetchMyRequests, enabled });
  const treeQuery = useQuery({ queryKey: CATALOG_TREE_KEY, queryFn: fetchCatalogTree, enabled });

  if (!hydrated || !user) {
    return null;
  }

  const names = treeQuery.data ? catalogNames(treeQuery.data) : new Map<string, string>();
  const serviceNameOf = (request: ServiceRequest): string =>
    (request.serviceId ? names.get(request.serviceId) : undefined) ?? "Service a preciser";

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Mes demandes</h1>

      {requestsQuery.isPending ? (
        <Card>
          <Skeleton lines={3} label="Chargement des demandes…" />
        </Card>
      ) : requestsQuery.error ? (
        <ErrorState
          message={requestsQuery.error instanceof ApiError ? requestsQuery.error.message : "Impossible de charger les demandes."}
          onRetry={() => {
            void requestsQuery.refetch();
          }}
        />
      ) : requestsQuery.data.length > 0 ? (
        <ul className="fx-animate-stagger flex flex-col gap-4" data-testid="request-list">
          {requestsQuery.data.map((request) => (
            <RequestRow key={request.id} request={request} serviceName={serviceNameOf(request)} />
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="file" size="xl" />}
            title="Aucune demande"
            message="Vos demandes apparaitront ici des que vous en aurez cree une."
            action={
              <Button
                testId="empty-new-request"
                onClick={() => {
                  router.push(NAV_HREFS.newRequest);
                }}
              >
                Demander un service
              </Button>
            }
          />
        </Card>
      )}
    </main>
  );
}
