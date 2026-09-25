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
import { Badge, Button, Card, ErrorState, Icon, Input, RadioGroup, Select, Skeleton } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";

import { ApiError, apiFetch, uploadFile } from "../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../lib/auth-store";
import { ancestryOf } from "../../../lib/catalog";

const TreeListSchema = z.array(CatalogTreeNodeSchema);

type MediaUploadStatus = "pending" | "uploading" | "ready" | "rejected" | "error";

interface PendingMedia {
  file: File;
  status: MediaUploadStatus;
  detail: string | null;
}

const MEDIA_STATUS_VARIANT: Record<MediaUploadStatus, "info" | "success" | "warning" | "error"> = {
  pending: "info",
  uploading: "info",
  ready: "success",
  rejected: "warning",
  error: "error",
};

async function fetchTree(): Promise<CatalogTreeNode[]> {
  return TreeListSchema.parse(await apiFetch("/api/v1/catalog/tree"));
}

function childrenOf(nodes: CatalogTreeNode[], id: string): CatalogTreeNode[] {
  return nodes.find((node) => node.id === id)?.children ?? [];
}

/** Catalog nodes -> `Select` options. The `Select` disables itself when this is empty. */
function toOptions(nodes: CatalogTreeNode[]): { value: string; label: string }[] {
  return nodes.map((node) => ({ value: node.id, label: node.name }));
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

  const [domainId, setDomainId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [interventionTypeId, setInterventionTypeId] = useState("");
  const [complexityId, setComplexityId] = useState("");
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
    if (!preselectedServiceId || domainId !== "" || !treeQuery.data) {
      return;
    }
    const [domain, category, service] = ancestryOf(treeQuery.data, preselectedServiceId);
    if (domain && category && service) {
      setDomainId(domain);
      setCategoryId(category);
      setServiceId(service);
    }
  }, [preselectedServiceId, domainId, treeQuery.data]);
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
        setInitError(err instanceof ApiError ? err.message : "Impossible de creer la demande.");
      }
    }
  }, [user]);

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
        previous.map((p) => (p.file === item.file ? { ...p, status: "error", detail: err instanceof ApiError ? err.message : "Echec de l'upload" } : p)),
      );
    }
  }

  async function handleSubmit(): Promise<void> {
    setFormError(null);
    if (!requestId) {
      return;
    }
    if (!serviceId || !interventionTypeId || !complexityId) {
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
          serviceId,
          interventionTypeId,
          complexityId,
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
      setFormError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
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
  const categories = childrenOf(domains, domainId);
  const services = childrenOf(categories, categoryId);
  const interventionTypes = childrenOf(services, serviceId);
  const complexities = childrenOf(interventionTypes, interventionTypeId);

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Nouvelle demande</h1>

      {initError === null ? null : <ErrorState message={initError} />}

      <Card title="Quel service vous faut-il ?" headingLevel={2}>
        {treeQuery.isPending ? (
          <Skeleton lines={5} label="Chargement du catalogue…" />
        ) : (
          <div className="fx-animate-fade-in grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              testId="domain-select"
              label="Domaine"
              value={domainId}
              options={toOptions(domains)}
              onChange={(value) => {
                setDomainId(value);
                setCategoryId("");
                setServiceId("");
                setInterventionTypeId("");
                setComplexityId("");
              }}
            />
            <Select
              testId="category-select"
              label="Categorie"
              value={categoryId}
              options={toOptions(categories)}
              onChange={(value) => {
                setCategoryId(value);
                setServiceId("");
                setInterventionTypeId("");
                setComplexityId("");
              }}
            />
            <Select
              testId="service-select"
              label="Service"
              value={serviceId}
              options={toOptions(services)}
              onChange={(value) => {
                setServiceId(value);
                setInterventionTypeId("");
                setComplexityId("");
              }}
            />
            <Select
              testId="intervention-type-select"
              label="Type d'intervention"
              value={interventionTypeId}
              options={toOptions(interventionTypes)}
              onChange={(value) => {
                setInterventionTypeId(value);
                setComplexityId("");
              }}
            />
            <Select testId="complexity-select" label="Complexite" value={complexityId} options={toOptions(complexities)} onChange={setComplexityId} />
          </div>
        )}
      </Card>

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

      <Card title="Ou se trouve l'intervention ?" headingLevel={2}>
        <div className="flex flex-col gap-3">
          <Input
            label="Adresse (optionnel)"
            value={address}
            onChange={setAddress}
            placeholder="12 rue des Fleurs, Casablanca"
            testId="address-input"
          />
          <div>
            <Button variant="secondary" onClick={handleUseMyLocation} testId="use-my-location-button">
              <Icon name="map" size="sm" />
              Utiliser ma position
            </Button>
          </div>
          {coordinates ? (
            <p className="fx-text-muted fx-animate-fade-in" data-testid="coordinates-display">
              <Icon name="check" size="sm" /> Position : {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
            </p>
          ) : null}
          {locationError === null ? null : <p className="fx-field__error">{locationError}</p>}
        </div>
      </Card>

      <Card title="Photos, video ou audio (optionnel)" headingLevel={2}>
        <div className="fx-field">
          <label className="fx-field__label" htmlFor="media">
            Ajouter des fichiers
          </label>
          <input
            id="media"
            data-testid="media-input"
            type="file"
            multiple
            accept={ALLOWED_MEDIA_CONTENT_TYPES.join(",")}
            onChange={(event) => {
              handleFilesSelected(event.target.files);
            }}
            className="fx-text-body-sm"
          />
        </div>

        {pendingMedia.length > 0 ? (
          <ul className="fx-animate-stagger mt-3 flex flex-col gap-2 fx-text-body-sm" data-testid="media-list">
            {pendingMedia.map((item) => (
              <li key={item.file.name} className="fx-row">
                <span>{item.file.name}</span>
                <Badge variant={MEDIA_STATUS_VARIANT[item.status]} testId="media-status">
                  {item.status}
                </Badge>
                {item.detail === null ? null : <span className="fx-text-muted">{item.detail}</span>}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

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
