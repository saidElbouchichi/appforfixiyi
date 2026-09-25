import type {
  MatchCandidateStatus,
  MatchStatus,
  ProviderAvailabilityStatus,
  ProviderType,
  RequestStatus,
  RequestUrgency,
} from "@fixiyi/contracts";

/**
 * Every enum the interface shows, in the words of the person reading it
 * (design phase 8).
 *
 * Why one file: `/requests`, `/requests/[id]/match` and `/provider/requests`
 * each carried their own table for the same enums — three copies, three ways
 * to drift. Each table below is a `Record<Enum, string>`, so adding a value
 * to a contract enum fails the build until its label is written; the tests
 * cover what the type cannot.
 */

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: "Brouillon",
  REQUESTED: "Envoyee",
  MATCHING: "Recherche en cours",
  CANCELLED: "Annulee",
  EXPIRED: "Expiree",
};

export const URGENCY_LABEL: Record<RequestUrgency, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
};

/**
 * `EXHAUSTED` is the one to get right. It means the engine has no more
 * eligible provider to contact — **not** that everyone refused, and not that
 * the search succeeded. There is no "an artisan accepted" state at all:
 * answering a dispatch means making an Offer, which does not exist before
 * phase 7 of the product (`matching.ts`). A label that implied an outcome
 * would be inventing one.
 */
export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  ACTIVE: "Recherche en cours",
  EXHAUSTED: "Plus d'artisan a contacter",
  CANCELLED: "Recherche annulee",
};

export const CANDIDATE_STATUS_LABEL: Record<MatchCandidateStatus, string> = {
  NOTIFIED: "Prevenu",
  VIEWED: "A vu la demande",
  DECLINED: "A decline",
  EXPIRED: "N'a pas repondu a temps",
};

export const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = {
  BRICOLEUR: "Bricoleur",
  TECHNICIEN: "Technicien",
  EXPERT: "Expert",
};

export const AVAILABILITY_LABEL: Record<ProviderAvailabilityStatus, string> = {
  OFFLINE: "Hors ligne",
  AVAILABLE: "Disponible",
  BUSY: "Occupe",
  ON_THE_WAY: "En route",
  ARRIVED: "Sur place",
  IN_SERVICE: "En intervention",
  PAUSED: "En pause",
};

/** `2 media(s) joint(s)` read like a database column; this agrees in number, or says nothing. */
export function attachmentCount(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 fichier joint" : `${count.toString()} fichiers joints`;
}

/**
 * How far the search has gone, for the person waiting — not for the engine.
 * The dispatch batch ("vague") is an implementation detail of
 * `matching.service.ts`; what a client can act on is how many artisans have
 * been contacted and how far out the search reaches.
 */
export function searchProgress(candidateCount: number, radiusKm: number): string {
  const artisans = candidateCount === 1 ? "1 artisan contacte" : `${candidateCount.toString()} artisans contactes`;
  return `${artisans}, jusqu'a ${radiusKm.toString()} km`;
}
