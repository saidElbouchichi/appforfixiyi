"use client";

import { ALLOWED_MEDIA_CONTENT_TYPES, MESSAGE_ATTACHMENTS_MAX, MESSAGE_BODY_MAX_LENGTH, type Message } from "@fixiyi/contracts";
import { Button, Icon, IconButton, ReplyQuote } from "@fixiyi/ui";
import { useId, useRef, useState } from "react";

import { ApiError } from "../../../lib/api-client";

export interface ComposerProps {
  replyTo: Message | null;
  replyAuthor: string;
  onCancelReply: () => void;
  onSend: (input: { body: string; replyToMessageId?: string; files?: File[] }) => Promise<Message>;
  onTyping: () => void;
}

/**
 * Enter sends, Shift+Enter breaks the line. The draft is kept if sending
 * fails, so a network error never costs the user what they typed.
 */
export function Composer({ replyTo, replyAuthor, onCancelReply, onSend, onTyping }: ComposerProps): React.JSX.Element {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !sending && (body.trim().length > 0 || files.length > 0);

  async function submit(): Promise<void> {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSend({ body: body.trim(), files, ...(replyTo ? { replyToMessageId: replyTo.id } : {}) });
      setBody("");
      setFiles([]);
      onCancelReply();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {replyTo ? (
        <div className="fx-row" style={{ paddingInline: "var(--fixiyi-space-3)" }} data-testid="reply-preview">
          <div style={{ flex: 1 }}>
            <ReplyQuote author={replyAuthor} excerpt={replyTo.body} deleted={replyTo.deletedAt !== null} />
          </div>
          <IconButton label="Annuler la reponse" icon="close" onClick={onCancelReply} />
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="fx-row" style={{ paddingInline: "var(--fixiyi-space-3)", listStyle: "none", margin: 0 }} data-testid="pending-files">
          {files.map((file) => (
            <li key={`${file.name}-${file.size.toString()}`} className="fx-reaction">
              <Icon name="attach" size="sm" />
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}

      {error === null ? null : (
        <p className="fx-field__error" role="alert" style={{ paddingInline: "var(--fixiyi-space-3)" }} data-testid="composer-error">
          {error}
        </p>
      )}

      <form
        className="fx-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MEDIA_CONTENT_TYPES.join(",")}
          multiple
          hidden
          data-testid="attach-input"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []).slice(0, MESSAGE_ATTACHMENTS_MAX);
            setFiles(picked);
            event.target.value = "";
          }}
        />
        <IconButton label="Joindre un fichier" icon="attach" onClick={() => fileInputRef.current?.click()} testId="attach-button" />

        <label htmlFor={inputId} className="fx-visually-hidden">
          Votre message
        </label>
        <textarea
          id={inputId}
          className="fx-composer__input"
          rows={1}
          maxLength={MESSAGE_BODY_MAX_LENGTH}
          placeholder="Ecrire un message…"
          value={body}
          dir="auto"
          data-testid="composer-input"
          onChange={(event) => {
            setBody(event.target.value);
            onTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <Button type="submit" disabled={!canSend} loading={sending} aria-label="Envoyer" testId="send-button">
          <Icon name="send" size="sm" />
        </Button>
      </form>
    </div>
  );
}
