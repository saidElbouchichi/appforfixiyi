"use client";

import { ALLOWED_REACTIONS, type Message, type ReactionEmoji } from "@fixiyi/contracts";
import { Button, IconButton, Input, MessageBubble, Modal, ReplyQuote, type ReactionSummary } from "@fixiyi/ui";
import { useId, useState } from "react";

import { errorMessage } from "../../../lib/errors";

const TIME_FORMAT = new Intl.DateTimeFormat("fr-MA", { hour: "2-digit", minute: "2-digit" });

/** Masked content, as opposed to a mere mention of an external channel (recorded, not masked). */
function wasMasked(message: Message): boolean {
  return message.redactions.some((redaction) => redaction.type !== "OFF_PLATFORM");
}

function summarizeReactions(message: Message, myUserId: string): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const reaction of message.reactions) {
    const current = byEmoji.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    byEmoji.set(reaction.emoji, { ...current, count: current.count + 1, mine: current.mine || reaction.userId === myUserId });
  }
  return [...byEmoji.values()];
}

/** The API computes these deadlines per viewer; the UI only hides a button once one has passed. */
function stillBefore(deadline: string | null): boolean {
  return deadline !== null && new Date(deadline).getTime() > Date.now();
}

export interface MessageItemProps {
  message: Message;
  myUserId: string;
  counterpartName: string;
  canAct: boolean;
  onReply: (message: Message) => void;
  onEdit: (messageId: string, body: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, emoji: ReactionEmoji | null) => Promise<void>;
}

export function MessageItem({ message, myUserId, counterpartName, canAct, onReply, onEdit, onDelete, onReact }: MessageItemProps): React.JSX.Element {
  const own = message.senderUserId === myUserId;
  const deleted = message.deletedAt !== null;
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickerId = useId();
  const [draft, setDraft] = useState(message.body ?? "");
  const [actionError, setActionError] = useState<string | null>(null);

  const myReaction = message.reactions.find((reaction) => reaction.userId === myUserId)?.emoji ?? null;

  async function run(action: () => Promise<void>): Promise<void> {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err, "Action impossible."));
    }
  }

  const actions =
    deleted || !canAct ? null : (
      <>
        <IconButton label="Repondre" icon="reply" onClick={() => { onReply(message); }} testId="reply-button" />
        <IconButton label="Reagir" expanded={picking} controls={picking ? pickerId : undefined} onClick={() => { setPicking((open) => !open); }} testId="react-button">
          {myReaction ?? "🙂"}
        </IconButton>
        {own && stillBefore(message.editableUntil) ? (
          <IconButton label="Modifier" icon="edit" onClick={() => { setDraft(message.body ?? ""); setEditing(true); }} testId="edit-button" />
        ) : null}
        {own && stillBefore(message.deletableUntil) ? (
          <IconButton label="Supprimer" icon="delete" onClick={() => { setConfirmingDelete(true); }} testId="delete-button" />
        ) : null}
      </>
    );

  return (
    <li className="fx-animate-slide-in-bottom" data-testid="message-item" data-seq={message.seq}>
      <MessageBubble
        own={own}
        body={message.body}
        deleted={deleted}
        edited={message.editedAt !== null}
        time={TIME_FORMAT.format(new Date(message.createdAt))}
        status={own ? message.deliveryStatus : null}
        notice={own && wasMasked(message) ? "Coordonnees masquees jusqu'a l'acceptation d'une offre." : null}
        reply={
          message.replyTo ? (
            <ReplyQuote
              author={message.replyTo.senderUserId === myUserId ? "Vous" : counterpartName}
              excerpt={message.replyTo.excerpt}
              deleted={message.replyTo.deleted}
            />
          ) : null
        }
        attachments={message.attachments.map((attachment) =>
          attachment.kind === "IMAGE" ? (
            <img key={attachment.mediaId} className="fx-bubble__media" src={attachment.url} alt={attachment.fileName} data-testid="message-image" />
          ) : (
            <a key={attachment.mediaId} href={attachment.url} target="_blank" rel="noreferrer noopener">
              {attachment.fileName}
            </a>
          ),
        )}
        reactions={summarizeReactions(message, myUserId)}
        actions={actions}
        testId="message-bubble"
      />

      {picking ? (
        <div id={pickerId} className="fx-row" role="group" aria-label="Choisir une reaction">
          {ALLOWED_REACTIONS.map((emoji) => (
            <IconButton
              key={emoji}
              label={`Reagir ${emoji}`}
              pressed={myReaction === emoji}
              onClick={() => {
                setPicking(false);
                void run(() => onReact(message.id, myReaction === emoji ? null : emoji));
              }}
            >
              {emoji}
            </IconButton>
          ))}
        </div>
      ) : null}

      {actionError === null ? null : (
        <p className="fx-field__error" role="alert">
          {actionError}
        </p>
      )}

      <Modal
        open={editing}
        title="Modifier le message"
        onClose={() => { setEditing(false); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditing(false); }}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                setEditing(false);
                void run(() => onEdit(message.id, draft));
              }}
              disabled={draft.trim().length === 0}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <Input label="Message" value={draft} onChange={setDraft} multiline rows={3} />
      </Modal>

      <Modal
        open={confirmingDelete}
        title="Supprimer ce message ?"
        onClose={() => { setConfirmingDelete(false); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setConfirmingDelete(false); }}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmingDelete(false);
                void run(() => onDelete(message.id));
              }}
            >
              Supprimer
            </Button>
          </>
        }
      >
        <p className="fx-text-muted">Le message disparaitra pour vous et pour votre interlocuteur.</p>
      </Modal>
    </li>
  );
}
