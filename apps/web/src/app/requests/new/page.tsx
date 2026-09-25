"use client";

import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  CatalogTreeNodeSchema,
  CreateUploadSessionOutputSchema,
  MediaSchema,
  ServiceRequestPageSchema,
  ServiceRequestSchema,
  type CatalogTreeNode,
  type RequestUrgency,
  type ServiceRequest,
} from "@fixiyi/contracts";
import { Badge, Button, Card, ErrorState, Icon, Input, RadioGroup } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";

import { apiFetch, uploadFile } from "../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../lib/auth-store";
import { ancestryOf } from "../../../lib/catalog";
import { errorMessage } from "../../../lib/errors";

import { LocationCard } from "./location-card";
import { MediaCard, type PendingMedia } from "./media-card";
import { ServiceCascade, type CascadeSelection } from "./service-cascade";

const TreeListSchema = z.array(CatalogTreeNodeSchema);




async function fetchTree(): Promise<CatalogTreeNode[]> {
  return TreeListSchema.parse(await apiFetch("/api/v1/catalog/tree"));
}

/**
 * First real client screen (docs/phases/PHASE_4_PLAN.md, Option A) — demande
 * creation: service depuis le vrai catalogue (01_SPEC_PRODUCT.md #10),
 * description, urgence, position reelle (Geolocation API du navigateur — pas
 * de carte interactive, `MAP_PROVIDER=dev`), et upload media reel (MinIO)
 * pilote par le vrai pipeline `apps/api/src/media/`. Construit sur
 * `@fixiyi/ui` (01_SPEC_PRODUCT.md #82).
 */
function NewRequestForm(): React.JSX.Element | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const treeQuery = useQuery({ queryKey: ["catalog-tree"], queryFn: fetchTree, enabled: hydrated && user !== null });

  const [requestId, setRequestId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  // Bumped to re-run the draft lookup: a failed one left the form unusable with no way back (design phase 9).
  const [draftAttempt, setDraftAttempt] = useState(0);

  const [selection, setSelection] = useState<CascadeSelection>({
    domainId: "",
    categoryId: "",
    serviceId: "",
    interventionTypeId: "",
    complexityId: "",
  });
  /** Arriving from the catalogue search, which links a SERVICE (design phase 7). */
  const preselectedServiceId = searchParams.get("serviceId");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<RequestUrgency>("NORMAL");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Opening the form from a catalogue search result fills the cascade for the
   * visitor. Only once, and only while they have chosen nothing: re-running it
   * would fight whatever they picked afterwards.
   */
  useEffect(() => {
    if (!preselectedServiceId || selection.domainId !== "" || !treeQuery.data) {
      return;
    }
    const [domain, category, service] = ancestryOf(treeQuery.data, preselectedServiceId);
    if (domain && category && service) {
      setSelection((previous) => ({ ...previous, domainId: domain, categoryId: category, serviceId: service }));
    }
  }, [preselectedServiceId, selection.domainId, treeQuery.data]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ServiceRequest | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void initializeDraft();

    async function initializeDraft(): Promise<void> {
      try {
        // The first page is newest-first and a client holds at most one open
        // draft, which they just started — it cannot be further down (Decision 76).
        const mine = ServiceRequestPageSchema.parse(await apiFetch("/api/v1/requests/mine", { auth: true }));
        const draft = mine.requests.find((candidate) => candidate.status === "DRAFT");
        if (draft) {
          setRequestId(draft.id);
          return;
        }
        const created = ServiceRequestSchema.parse(await apiFetch("/api/v1/requests", { method: "POST", auth: true }));
        setRequestId(created.id);
      } catch (err) {
        setInitError(errorMessage(err, "Impossible de creer la demande."));
      }
    }
  }, [user, draftAttempt]);

  function handleUseMyLocation(): void {
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocationError("Impossible d'obtenir la position — autorisez l'acces a la localisation.");
      },
    );
  }

  function handleFilesSelected(fileList: FileList | null): void {
    if (!fileList) {
      return;
    }
    const files = Array.from(fileList).filter((file) => ALLOWED_MEDIA_CONTENT_TYPES.includes(file.type));
    setPendingMedia((previous) => [...previous, ...files.map((file) => ({ file, status: "pending" as const, detail: null }))]);
  }

  async function uploadOneFile(activeRequestId: string, item: PendingMedia): Promise<void> {
    setPendingMedia((previous) => previous.map((p) => (p.file === item.file ? { ...p, status: "uploading", detail: null } : p)));
    try {
      const session = CreateUploadSessionOutputSchema.parse(
        await apiFetch(`/api/v1/requests/${activeRequestId}/media`, {
          method: "POST",
          auth: true,
          body: { fileName: item.file.name, contentType: item.file.type, sizeBytes: item.file.size },
        }),
      );
      await uploadFile(session.uploadUrl, item.file);
      const finalized = MediaSchema.parse(
        await apiFetch(`/api/v1/requests/${activeRequestId}/media/${session.mediaId}/finalize`, { method: "POST", auth: true }),
      );
      setPendingMedia((previous) =>
        previous.map((p) =>
          p.file === item.file ? { ...p, status: finalized.status === "READY" ? "ready" : "rejected", detail: finalized.rejectionReason } : p,
        ),
      );
    } catch (err) {
      setPendingMedia((previous) =>
        previous.map((p) => (p.file === item.file ? { ...p, status: "error", detail: errorMessage(err, "Echec de l'upload") } : p)),
      );
    }
  }

  async function handleSubmit(): Promise<void> {
    setFormError(null);
    if (!requestId) {
      return;
    }
    if (!selection.serviceId || !selection.interventionTypeId || !selection.complexityId) {
      setFormError("Choisissez un service complet dans le catalogue (domaine, categorie, service, type, complexite).");
      return;
    }
    if (!description.trim()) {
      setFormError("Decrivez votre probleme.");
      return;
    }
    if (!coordinates) {
      setFormError("Indiquez votre position (bouton \"Utiliser ma position\").");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/requests/${requestId}`, {
        method: "PATCH",
        auth: true,
        body: {
          serviceId: selection.serviceId,
          interventionTypeId: selection.interventionTypeId,
          complexityId: selection.complexityId,
          description,
          urgency,
          location: { address: address || null, point: { type: "Point", coordinates: [coordinates.lng, coordinates.lat] } },
        },
      });

      for (const item of pendingMedia) {
        if (item.status === "ready") {
          continue;
        }
        await uploadOneFile(requestId, item);
      }

      const result = ServiceRequestSchema.parse(await apiFetch(`/api/v1/requests/${requestId}/submit`, { method: "POST", auth: true }));
      setSubmitted(result);
    } catch (err) {
      setFormError(errorMessage(err, "Une erreur est survenue."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated || !user) {
    return null;
  }

  if (submitted) {
    return (
      <main className="fx-page fx-page--narrow">
        <h1 className="fx-page__title">Demande envoyee</h1>
        <Card className="fx-animate-slide-in-bottom" title="Recapitulatif" headingLevel={2}>
          <p className="fx-text-muted mb-3" data-testid="submitted-request-id">
            {submitted.id}
          </p>
          <p className="mb-3" data-testid="submitted-status">
            Statut : <Badge variant="success">{submitted.status}</Badge>
          </p>
          <p className="mb-2">Description : {submitted.description}</p>
          <p className="mb-2">
            Urgence : <Badge variant={submitted.urgency === "URGENT" ? "warning" : "info"}>{submitted.urgency}</Badge>
          </p>
          <p data-testid="submitted-media-count">Medias attaches : {submitted.mediaIds.length.toString()}</p>

          <div className="mt-6">
            <Button
              onClick={() => {
                router.push(`/requests/${submitted.id}/match`);
              }}
              testId="go-to-match-button"
            >
              <Icon name="search" size="sm" />
              Suivre la recherche de fournisseurs
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const domains = treeQuery.data ?? [];

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Nouvelle demande</h1>

      {initError === null ? null : (
        <ErrorState
          message={initError}
          onRetry={() => {
            setInitError(null);
            setDraftAttempt((attempt) => attempt + 1);
          }}
        />
      )}

      <ServiceCascade domains={domains} selection={selection} onChange={setSelection} loading={treeQuery.isPending} />

      <Card title="Decrivez le probleme" headingLevel={2}>
        <div className="flex flex-col gap-4">
          <Input
            label="Description"
            value={description}
            onChange={setDescription}
            multiline
            rows={4}
            placeholder="Prise de courant ne fonctionne plus depuis hier."
            required
            testId="description-input"
          />

          <RadioGroup<RequestUrgency>
            legend="Urgence"
            name="urgency"
            value={urgency}
            onChange={setUrgency}
            options={[
              { value: "NORMAL", label: "Normale" },
              { value: "URGENT", label: "Urgente" },
            ]}
            testIdPrefix="urgency"
          />
        </div>
      </Card>

      <LocationCard
        address={address}
        onAddressChange={setAddress}
        coordinates={coordinates}
        onUseMyLocation={handleUseMyLocation}
        error={locationError}
      />

      <MediaCard pending={pendingMedia} onFilesSelected={handleFilesSelected} />

      {formError === null ? null : (
        <p className="fx-field__error fx-animate-fade-in" role="alert" data-testid="form-error">
          {formError}
        </p>
      )}

      <div>
        <Button
          loading={submitting}
          disabled={requestId === null}
          onClick={() => {
            void handleSubmit();
          }}
          testId="submit-request-button"
        >
          <Icon name="check" size="sm" />
          Envoyer la demande
        </Button>
      </div>
    </main>
  );
}

/** `useSearchParams()` needs a Suspense boundary to prerender (Next.js). */
export default function NewRequestPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <NewRequestForm />
    </Suspense>
  );
}
