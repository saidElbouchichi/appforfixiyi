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
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { ApiError, apiFetch, uploadFile } from "../../../lib/api-client";
import { useAuthStore } from "../../../lib/auth-store";

const TreeListSchema = z.array(CatalogTreeNodeSchema);
const RequestListSchema = z.array(ServiceRequestSchema);

type MediaUploadStatus = "pending" | "uploading" | "ready" | "rejected" | "error";

interface PendingMedia {
  file: File;
  status: MediaUploadStatus;
  detail: string | null;
}

async function fetchTree(): Promise<CatalogTreeNode[]> {
  return TreeListSchema.parse(await apiFetch("/api/v1/catalog/tree"));
}

function childrenOf(nodes: CatalogTreeNode[], id: string): CatalogTreeNode[] {
  return nodes.find((node) => node.id === id)?.children ?? [];
}

/**
 * First real client screen (docs/phases/PHASE_4_PLAN.md, Option A) — login
 * OTP + demande creation: service depuis le vrai catalogue (01_SPEC_PRODUCT.md
 * #10), description, urgence, position reelle (Geolocation API du
 * navigateur — pas de carte interactive, `MAP_PROVIDER=dev`), et upload
 * media reel (MinIO) pilote par le vrai pipeline `apps/api/src/media/`.
 * Minimal mais reel, meme esprit que le back-office (Decision 34) : chaque
 * etape appelle une vraie API avec une vraie validation.
 */
export default function NewRequestPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  const treeQuery = useQuery({ queryKey: ["catalog-tree"], queryFn: fetchTree, enabled: user !== null });

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

  if (!user) {
    return null;
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-4 text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Demande envoyee</h1>
        <p data-testid="submitted-request-id" className="mb-2 text-xs text-[var(--fixiyi-color-neutral-400)]">
          {submitted.id}
        </p>
        <p data-testid="submitted-status" className="mb-2">
          Statut : <strong>{submitted.status}</strong>
        </p>
        <p className="mb-2">Description : {submitted.description}</p>
        <p className="mb-2">Urgence : {submitted.urgency}</p>
        <p data-testid="submitted-media-count" className="mb-2">
          Medias attaches : {submitted.mediaIds.length.toString()}
        </p>
      </main>
    );
  }

  const domains = treeQuery.data ?? [];
  const categories = childrenOf(domains, domainId);
  const services = childrenOf(categories, categoryId);
  const interventionTypes = childrenOf(services, serviceId);
  const complexities = childrenOf(interventionTypes, interventionTypeId);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Nouvelle demande</h1>

      {initError ? <p className="mb-4 text-sm text-red-600">{initError}</p> : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <label className="mb-1 block text-sm text-[var(--fixiyi-color-neutral-600)]" htmlFor="description">
        Description du probleme
      </label>
      <textarea
        id="description"
        data-testid="description-input"
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
        }}
        className="mb-4 w-full rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-2"
        rows={4}
        placeholder="Prise de courant ne fonctionne plus depuis hier."
      />

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm text-[var(--fixiyi-color-neutral-600)]">Urgence</legend>
        <label className="mr-4 text-sm">
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

      <label className="mb-1 block text-sm text-[var(--fixiyi-color-neutral-600)]" htmlFor="address">
        Adresse (optionnel)
      </label>
      <input
        id="address"
        data-testid="address-input"
        value={address}
        onChange={(event) => {
          setAddress(event.target.value);
        }}
        className="mb-2 w-full rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-2"
        placeholder="12 rue des Fleurs, Casablanca"
      />
      <button
        type="button"
        data-testid="use-my-location-button"
        onClick={handleUseMyLocation}
        className="mb-2 rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-1.5 text-sm"
      >
        Utiliser ma position
      </button>
      {coordinates ? (
        <p data-testid="coordinates-display" className="mb-4 text-sm text-[var(--fixiyi-color-neutral-600)]">
          Position : {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
        </p>
      ) : null}
      {locationError ? <p className="mb-4 text-sm text-red-600">{locationError}</p> : null}

      <label className="mb-1 block text-sm text-[var(--fixiyi-color-neutral-600)]" htmlFor="media">
        Photos / video / audio (optionnel)
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
        className="mb-4 w-full text-sm"
      />
      {pendingMedia.length > 0 ? (
        <ul data-testid="media-list" className="mb-4 flex flex-col gap-1 text-sm">
          {pendingMedia.map((item) => (
            <li key={item.file.name}>
              {item.file.name} — <span data-testid="media-status">{item.status}</span>
              {item.detail ? ` (${item.detail})` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {formError ? (
        <p data-testid="form-error" className="mb-4 text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="submit-request-button"
        disabled={submitting || !requestId}
        onClick={() => {
          void handleSubmit();
        }}
        className="rounded bg-[var(--fixiyi-color-primary-600)] px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Envoi..." : "Envoyer la demande"}
      </button>
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
    <div>
      <label className="mb-1 block text-sm text-[var(--fixiyi-color-neutral-600)]" htmlFor={testId}>
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
        className="w-full rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-2 disabled:opacity-50"
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
