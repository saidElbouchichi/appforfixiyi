import type { JSX, ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

/**
 * Chat primitives (01_SPEC_PRODUCT.md #1217 lists "chat" in the design
 * system). Presentational only: every decision about WHAT to show — whether
 * a message is read, whether it was masked, whether it can still be edited —
 * is made by the API and arrives as props. Default labels are French, like
 * the rest of the package, and every one is overridable.
 */

export type DeliveryState = "SENT" | "DELIVERED" | "READ";

const DELIVERY_LABELS: Record<DeliveryState, string> = { SENT: "Envoye", DELIVERED: "Distribue", READ: "Lu" };

export interface DeliveryStatusProps {
  status: DeliveryState;
  labels?: Partial<Record<DeliveryState, string>>;
}

/**
 * One tick = sent, two = delivered, two in the primary colour = read. The
 * state is also given as text to assistive tech: colour alone would not
 * convey "read" (WCAG 2.2 AA 1.4.1).
 */
export function DeliveryStatus({ status, labels }: DeliveryStatusProps): JSX.Element {
  const label = labels?.[status] ?? DELIVERY_LABELS[status];
  return (
    <span className={cx("fx-delivery", status === "READ" && "fx-delivery--read")} data-status={status}>
      <Icon name={status === "SENT" ? "check" : "check-double"} size="sm" />
      <span className="fx-visually-hidden">{label}</span>
    </span>
  );
}

export interface ReplyQuoteProps {
  author: string;
  excerpt: string | null;
  deleted: boolean;
  deletedLabel?: string;
}

export function ReplyQuote({ author, excerpt, deleted, deletedLabel = "Message supprime" }: ReplyQuoteProps): JSX.Element {
  return (
    <div className="fx-reply-quote">
      <span className="fx-reply-quote__author">{author}</span>
      <span className="fx-reply-quote__excerpt">{deleted ? deletedLabel : excerpt}</span>
    </div>
  );
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessageBubbleProps {
  /** Sent by the viewer: aligned to the inline end, primary tint. */
  own: boolean;
  body: string | null;
  deleted?: boolean;
  deletedLabel?: string;
  edited?: boolean;
  editedLabel?: string;
  /** Pre-formatted time, e.g. "14:05" — formatting is the app's locale concern. */
  time: string;
  status?: DeliveryState | null;
  reply?: ReactNode;
  attachments?: ReactNode;
  reactions?: ReactionSummary[];
  /** Shown to the sender when part of the message was masked — never mask silently. */
  notice?: string | null;
  /** Action buttons (reply, react, edit, delete) — supplied by the app. */
  actions?: ReactNode;
  testId?: string;
}

/**
 * Logical properties only, so a bubble sent in Arabic sits on the correct
 * side without a mirror stylesheet. `dir="auto"` on the text lets a French
 * message inside an Arabic interface (or the reverse, #5) render in its own
 * direction.
 */
export function MessageBubble({
  own,
  body,
  deleted = false,
  deletedLabel = "Message supprime",
  edited = false,
  editedLabel = "modifie",
  time,
  status = null,
  reply,
  attachments,
  reactions = [],
  notice = null,
  actions,
  testId,
}: MessageBubbleProps): JSX.Element {
  return (
    <div className={cx("fx-bubble-row", own && "fx-bubble-row--own")} data-testid={testId}>
      <div className={cx("fx-bubble", own ? "fx-bubble--own" : "fx-bubble--other", deleted && "fx-bubble--deleted")}>
        {reply}
        {attachments}
        {deleted ? (
          <p className="fx-bubble__text fx-bubble__text--deleted">{deletedLabel}</p>
        ) : body ? (
          <p className="fx-bubble__text" dir="auto">
            {body}
          </p>
        ) : null}
        {notice ? (
          <p className="fx-bubble__notice" role="note">
            <Icon name="shield" size="sm" />
            {notice}
          </p>
        ) : null}
        <div className="fx-bubble__meta">
          {edited && !deleted ? <span>{editedLabel}</span> : null}
          <time>{time}</time>
          {own && status ? <DeliveryStatus status={status} /> : null}
        </div>
      </div>
      {reactions.length > 0 ? (
        <ul className="fx-reactions" aria-label="Reactions">
          {reactions.map((reaction) => (
            <li key={reaction.emoji} className={cx("fx-reaction", reaction.mine && "fx-reaction--mine")}>
              <span aria-hidden="true">{reaction.emoji}</span>
              <span>{reaction.count.toString()}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {actions ? <div className="fx-bubble__actions">{actions}</div> : null}
    </div>
  );
}

export interface TypingIndicatorProps {
  /** e.g. "Ahmed ecrit…" — announced politely to screen readers. */
  label: string;
}

export function TypingIndicator({ label }: TypingIndicatorProps): JSX.Element {
  return (
    <div className="fx-typing" role="status" aria-live="polite">
      <span className="fx-typing__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{label}</span>
    </div>
  );
}
