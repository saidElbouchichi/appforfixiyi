"use client";

import { ALLOWED_MEDIA_CONTENT_TYPES } from "@fixiyi/contracts";
import { Badge, Card, Icon, type BadgeVariant } from "@fixiyi/ui";

/** The client-side lifecycle of one attachment; `rejected` is the API's verdict, not a guess. */
export type MediaUploadStatus = "pending" | "uploading" | "ready" | "rejected" | "error";

export interface PendingMedia {
  file: File;
  status: MediaUploadStatus;
  detail: string | null;
}

const STATUS_VARIANT: Record<MediaUploadStatus, BadgeVariant> = {
  pending: "info",
  uploading: "info",
  ready: "success",
  rejected: "warning",
  error: "error",
};

/**
 * The attachments block (Decision 78). It shows what the real upload pipeline
 * reports — `rejected` is a verdict the API returned after inspecting the
 * bytes, not a guess made here — and owns none of it: picking files and
 * uploading them stay with the form.
 */
export function MediaCard({
  pending,
  onFilesSelected,
}: {
  pending: PendingMedia[];
  onFilesSelected: (files: FileList | null) => void;
}): React.JSX.Element {
  return (
    <Card title="Photos, video ou audio (optionnel)" headingLevel={2}>
      <div className="fx-field">
        {/* The label IS the target: the native control is 20px tall and its button cannot be resized (design phase 10). */}
        <label className="fx-file-picker" htmlFor="media">
          <Icon name="upload" size="sm" />
          Ajouter des fichiers
          <input
            id="media"
            data-testid="media-input"
            type="file"
            multiple
            accept={ALLOWED_MEDIA_CONTENT_TYPES.join(",")}
            onChange={(event) => {
              onFilesSelected(event.target.files);
            }}
            className="fx-file-picker__input"
          />
        </label>
      </div>

      {pending.length > 0 ? (
        <ul className="fx-animate-stagger mt-3 flex flex-col gap-2 fx-text-body-sm" data-testid="media-list">
          {pending.map((item) => (
            <li key={item.file.name} className="fx-row">
              <span>{item.file.name}</span>
              <Badge variant={STATUS_VARIANT[item.status]} testId="media-status">
                {item.status}
              </Badge>
              {item.detail === null ? null : <span className="fx-text-muted">{item.detail}</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
