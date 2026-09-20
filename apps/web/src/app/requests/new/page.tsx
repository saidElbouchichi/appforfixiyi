"use client";

import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  CatalogTreeNodeSchema,
  CreateUploadSessionOutputSchema,
  MediaSchema,
  ServiceRequestSchema,
  type CatalogTreeNode,
  type RequestUrgency,
  type ServiceRequest,
} from "@fixiyi/contracts";
import { Badge, Button, Card, ErrorState, Input, Skeleton } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { ApiError, apiFetch, uploadFile } from "../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../lib/auth-store";

const TreeListSchema = z.array(CatalogTreeNodeSchema);
const RequestListSchema = z.array(ServiceRequestSchema);

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

/**
 * First real client screen (docs/phases/PHASE_4_PLAN.md, Option A) — demande
 * creation: service depuis le vrai catalogue (01_SPEC_PRODUCT.md #10),
 * description, urgence, position reelle (Geolocation API du navigateur — pas
 * de carte interactive, `MAP_PROVIDER=dev`), et upload media reel (MinIO)
 * pilote par le vrai pipeline `apps/api/src/media/`. Construit sur
 * `@fixiyi/ui` (01_SPEC_PRODUCT.md #82).
 */
export default function NewRequestPage(): React.JSX.Element | null {
  const router = useRouter();
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
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<RequestUrgency>("NORMAL");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ServiceRequest | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void initializeDraft();

    async function initializeDraft(): Promise<void> {
      try {
        const mine = RequestListSchema.parse(await apiFetch("/api/v1/requests/mine", { auth: true }));
        const draft = mine.find((candidate) => candidate.status === "DRAFT");
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
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Demande envoyee</h1>
        <Card title="Recapitulatif" headingLevel={2}>
          <p className="mb-3 text-xs text-[var(--fixiyi-color-neutral-400)]" data-testid="submitted-request-id">
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
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Nouvelle demande</h1>

      {initError === null ? null : <ErrorState message={initError} />}

      <Card title="Quel service vous faut-il ?" headingLevel={2}>
        {treeQuery.isPending ? (
          <Skeleton lines={5} label="Chargement du catalogue…" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LevelSelect
              testId="domain-select"
              label="Domaine"
              value={domainId}
              options={domains}
              onChange={(value) => {
                setDomainId(value);
                setCategoryId("");
                setServiceId("");
                setInterventionTypeId("");
                setComplexityId("");
              }}
            />
            <LevelSelect
              testId="category-select"
              label="Categorie"
              value={categoryId}
              options={categories}
              onChange={(value) => {
                setCategoryId(value);
                setServiceId("");
                setInterventionTypeId("");
                setComplexityId("");
              }}
            />
            <LevelSelect
              testId="service-select"
              label="Service"
              value={serviceId}
              options={services}
              onChange={(value) => {
                setServiceId(value);
                setInterventionTypeId("");
                setComplexityId("");
              }}
            />
            <LevelSelect
              testId="intervention-type-select"
              label="Type d'intervention"
              value={interventionTypeId}
              options={interventionTypes}
              onChange={(value) => {
                setInterventionTypeId(value);
                setComplexityId("");
              }}
            />
            <LevelSelect testId="complexity-select" label="Complexite" value={complexityId} options={complexities} onChange={setComplexityId} />
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

          <fieldset>
            <legend className="fx-field__label mb-1">Urgence</legend>
            <label className="me-4 text-sm">
              <input
                type="radio"
                data-testid="urgency-normal"
                name="urgency"
                checked={urgency === "NORMAL"}
                onChange={() => {
                  setUrgency("NORMAL");
                }}
              />{" "}
              Normale
            </label>
            <label className="text-sm">
              <input
                type="radio"
                data-testid="urgency-urgent"
                name="urgency"
                checked={urgency === "URGENT"}
                onChange={() => {
                  setUrgency("URGENT");
                }}
              />{" "}
              Urgente
            </label>
          </fieldset>
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
              Utiliser ma position
            </Button>
          </div>
          {coordinates ? (
            <p className="text-sm text-[var(--fixiyi-color-neutral-600)]" data-testid="coordinates-display">
              Position : {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
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
            className="text-sm"
          />
        </div>

        {pendingMedia.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm" data-testid="media-list">
            {pendingMedia.map((item) => (
              <li key={item.file.name} className="flex flex-wrap items-center gap-2">
                <span>{item.file.name}</span>
                <Badge variant={MEDIA_STATUS_VARIANT[item.status]} testId="media-status">
                  {item.status}
                </Badge>
                {item.detail === null ? null : <span className="text-[var(--fixiyi-color-neutral-600)]">{item.detail}</span>}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {formError === null ? null : (
        <p className="fx-field__error" role="alert" data-testid="form-error">
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
          Envoyer la demande
        </Button>
      </div>
    </main>
  );
}

function LevelSelect({
  testId,
  label,
  value,
  options,
  onChange,
}: {
  testId: string;
  label: string;
  value: string;
  options: CatalogTreeNode[];
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="fx-field">
      <label className="fx-field__label" htmlFor={testId}>
        {label}
      </label>
      <select
        id={testId}
        data-testid={testId}
        value={value}
        disabled={options.length === 0}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="fx-field__control"
      >
        <option value="">--</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
