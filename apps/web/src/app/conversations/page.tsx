"use client";

import type { Conversation } from "@fixiyi/contracts";
import { Badge, Card, EmptyState, ErrorState, Icon, Skeleton } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthHydrated, useAuthStore } from "../../lib/auth-store";
import { CONVERSATIONS_KEY, listConversations } from "../../lib/chat-api";
import { errorMessage } from "../../lib/errors";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ROLE_LABEL = { CLIENT: "Client", PROVIDER: "Artisan" } as const;

function ConversationRow({ conversation }: { conversation: Conversation }): React.JSX.Element {
  const unread = conversation.unreadCount;
  return (
    <li data-testid="conversation-row">
      <Card>
        <div className="fx-row mb-2">
          <Link href={`/conversations/${conversation.id}`} data-testid="conversation-link">
            <strong>{conversation.counterpart.displayName}</strong>
          </Link>
          <Badge variant="info">{ROLE_LABEL[conversation.counterpart.role]}</Badge>
          {unread > 0 ? (
            <Badge variant="warning" testId="conversation-unread">
              {unread.toString()} non lu{unread > 1 ? "s" : ""}
            </Badge>
          ) : null}
          {!conversation.canSend ? <Badge variant="neutral">Lecture seule</Badge> : null}
        </div>
        <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]">
          {conversation.lastMessageAt ? `Dernier message le ${DATE_FORMAT.format(new Date(conversation.lastMessageAt))}` : "Aucun message"}
        </p>
        {/* A badge cannot carry a reason, and "Lecture seule" without one reads like a fault of the reader's. */}
        {conversation.canSend ? null : (
          <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]" data-testid="conversation-readonly-reason">
            La demande a ete annulee ou la candidature de l&apos;artisan n&apos;est plus active.
          </p>
        )}
      </Card>
    </li>
  );
}

/**
 * The Messages list — the destination of the navigation entry (phase 6 of the
 * design rework). It shows only what the contract carries: counterpart, role,
 * date of the last message, unread count. No preview of the last message: the
 * API does not send one, and inventing it is forbidden (03_AGENT_PROTOCOL §2).
 */
export default function ConversationsPage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const conversationsQuery = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: listConversations,
    enabled: hydrated && user !== null,
  });

  if (!hydrated || !user) {
    return null;
  }

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Messages</h1>

      {conversationsQuery.isPending ? (
        <Card>
          <Skeleton lines={3} label="Chargement des conversations…" />
        </Card>
      ) : conversationsQuery.error ? (
        <ErrorState
          message={errorMessage(conversationsQuery.error, "Impossible de charger les conversations.")}
          onRetry={() => {
            void conversationsQuery.refetch();
          }}
        />
      ) : conversationsQuery.data.length > 0 ? (
        <ul className="fx-animate-stagger flex flex-col gap-4" data-testid="conversation-list">
          {conversationsQuery.data.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="message" size="xl" />}
            title="Aucune conversation"
            message="Une conversation s'ouvre quand vous contactez un artisan depuis une demande, ou quand un client vous ecrit."
          />
        </Card>
      )}
    </main>
  );
}
