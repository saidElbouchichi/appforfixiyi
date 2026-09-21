"use client";

import type { Conversation, Message } from "@fixiyi/contracts";
import { Badge, Button, EmptyState, ErrorState, Icon, IconButton, Input, Skeleton, TypingIndicator } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "../../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../../lib/auth-store";
import { getConversation, searchMessages } from "../../../lib/chat-api";
import { useChatThread } from "../../../lib/use-chat-thread";

import { Composer } from "./composer";
import { MessageItem } from "./message-item";

/**
 * The conversation screen (01_SPEC_PRODUCT.md #26, #27). Renders what the
 * API decided — masking, ticks, whether the thread is still open — and never
 * decides any of it itself (03_AGENT_PROTOCOL.md #2).
 */
export default function ConversationPage(): React.JSX.Element | null {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const conversationQuery = useQuery({
    queryKey: ["conversation", params.id],
    queryFn: () => getConversation(params.id),
    enabled: hydrated && user !== null,
  });
  const conversation = conversationQuery.data ?? null;

  if (!hydrated || !user) {
    return null;
  }
  if (conversationQuery.error) {
    return (
      <main className="fx-page fx-page--narrow">
        <ErrorState
          message={conversationQuery.error instanceof ApiError ? conversationQuery.error.message : "Conversation introuvable."}
          onRetry={() => void conversationQuery.refetch()}
        />
      </main>
    );
  }
  if (!conversation) {
    return (
      <main className="fx-page fx-page--narrow">
        <Skeleton lines={6} label="Chargement de la conversation…" />
      </main>
    );
  }

  // Keyed by conversation: navigating to another one remounts the thread, which resets its state.
  return <ConversationThread key={conversation.id} conversation={conversation} userId={user.id} />;
}

function ConversationThread({ conversation, userId }: { conversation: Conversation; userId: string }): React.JSX.Element {
  const thread = useChatThread(conversation, userId);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searching, setSearching] = useState(false);
  const counterpartName = conversation.counterpart.displayName;

  return (
    <main className="fx-page fx-page--narrow" style={{ blockSize: "100dvh", paddingBlock: 0, gap: 0 }}>
      <header className="fx-page__header" style={{ paddingBlock: "var(--fixiyi-space-3)" }}>
        <div className="fx-row">
          <h1 className="fx-page__title" style={{ fontSize: "var(--fixiyi-font-size-xl)" }} data-testid="conversation-title">
            {counterpartName}
          </h1>
          <Badge variant={conversation.counterpart.role === "PROVIDER" ? "info" : "success"}>
            {conversation.counterpart.role === "PROVIDER" ? "Fournisseur" : "Client"}
          </Badge>
        </div>
        <div className="fx-row">
          <span className="fx-text-muted" data-testid="connection-status" aria-live="polite">
            {thread.connected ? "En ligne" : "Reconnexion…"}
          </span>
          <IconButton label="Rechercher dans la conversation" icon="search" expanded={searching} onClick={() => { setSearching((open) => !open); }} />
        </div>
      </header>

      <ContactBanner policy={conversation.contactPolicy} phone={conversation.counterpart.phone} />
      {searching ? <SearchPanel conversationId={conversation.id} /> : null}

      <ol className="fx-chat-log" role="log" aria-live="polite" aria-label={`Conversation avec ${counterpartName}`} data-testid="chat-log" style={{ listStyle: "none", margin: 0 }}>
        {thread.hasOlder ? (
          <li style={{ alignSelf: "center" }}>
            <Button variant="ghost" onClick={() => void thread.loadOlder()}>
              Messages precedents
            </Button>
          </li>
        ) : null}
        {thread.loading ? <Skeleton lines={4} label="Chargement des messages…" /> : null}
        {thread.error === null ? null : <ErrorState message={thread.error} />}
        {!thread.loading && thread.messages.length === 0 ? (
          <EmptyState icon={<Icon name="message" size="xl" />} title="Aucun message" message="Posez vos questions avant de recevoir une offre." />
        ) : null}
        {thread.messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            myUserId={userId}
            counterpartName={counterpartName}
            canAct={conversation.canSend}
            onReply={setReplyTo}
            onEdit={thread.edit}
            onDelete={thread.remove}
            onReact={thread.react}
          />
        ))}
      </ol>

      {thread.counterpartTyping ? <TypingIndicator label={`${counterpartName} ecrit…`} /> : null}

      {conversation.canSend ? (
        <Composer
          replyTo={replyTo}
          replyAuthor={replyTo?.senderUserId === userId ? "Vous" : counterpartName}
          onCancelReply={() => { setReplyTo(null); }}
          onSend={thread.send}
          onTyping={thread.notifyTyping}
        />
      ) : (
        <p className="fx-text-muted" role="status" style={{ padding: "var(--fixiyi-space-4)", textAlign: "center" }} data-testid="conversation-closed">
          Cette conversation est fermee : la demande a ete annulee ou le fournisseur n&apos;est plus disponible.
        </p>
      )}
    </main>
  );
}

/**
 * Says WHY contact details are hidden, in the user's words — the stored text
 * only carries a neutral placeholder (01_SPEC_PRODUCT.md #27). Once unlocked,
 * shows the counterpart's verified number, callable: Fixiyi has no VoIP.
 */
function ContactBanner({ policy, phone }: { policy: "PROTECTED" | "UNLOCKED"; phone: string | null }): React.JSX.Element {
  if (policy === "UNLOCKED" && phone) {
    return (
      <p className="fx-badge fx-badge--success" style={{ alignSelf: "flex-start" }} data-testid="counterpart-phone">
        <Icon name="check" size="sm" />
        Numero verifie : <a href={`tel:${phone}`}>{phone}</a>
      </p>
    );
  }
  return (
    <p className="fx-badge fx-badge--info" role="note" style={{ alignSelf: "flex-start" }} data-testid="contact-protected-banner">
      <Icon name="shield" size="sm" />
      Pour votre securite, telephones, emails et liens sont masques jusqu&apos;a l&apos;acceptation d&apos;une offre.
    </p>
  );
}

function SearchPanel({ conversationId }: { conversationId: string }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useQuery({
    queryKey: ["conversation-search", conversationId, trimmed],
    queryFn: () => searchMessages(conversationId, trimmed),
    enabled: trimmed.length >= 2,
  });

  return (
    <section aria-label="Recherche" className="fx-stack" style={{ paddingBlock: "var(--fixiyi-space-2)" }}>
      <Input label="Rechercher" type="search" value={query} onChange={setQuery} placeholder="chauffe-eau, devis…" testId="search-input" />
      {trimmed.length >= 2 && results.data ? (
        <ul className="fx-stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: "var(--fixiyi-space-1)" }} data-testid="search-results">
          {results.data.length === 0 ? <li className="fx-text-muted">Aucun resultat.</li> : null}
          {results.data.map((message) => (
            <li key={message.id} className="fx-text-muted" dir="auto">
              {message.body}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
