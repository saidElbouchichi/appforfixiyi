# FIXIYI - IMPLEMENTATION PLAN

Derniere mise a jour : 2026-09-19 (Phase 0 - Audit)

Ce document est la feuille de route globale (MVP, Phases 0-8). Il reste
volontairement a un niveau roadmap : le detail tactique de chaque phase
est produit au moment de son demarrage dans
`docs/phases/PHASE_X_PLAN.md`, conformement au cycle oblige de
`03_AGENT_PROTOCOL.md`.

Reference complete des exigences : `01_SPEC_PRODUCT.md` (quoi) et
`02_SPEC_ENGINEERING.md` (comment). Ce plan ne duplique pas ces specs,
il les organise en sequence executable.

---

## Principes transverses (valables a toutes les phases)

- Cycle obligatoire : LIRE PROGRESS/DECISIONS/dernier rapport -> PLANIFIER
  -> IMPLEMENTER -> TESTER -> `pnpm lint && pnpm typecheck && pnpm test &&
  pnpm build` -> CORRIGER -> DOCUMENTER -> UPDATE PROGRESS -> STOP.
- Architecture : Modular Monolith (Decision 1), boundaries de module
  strictes, pas de microservices premature.
- Argent : integer minor units uniquement (Decision 2), jamais de float.
- Base de donnees : MongoDB (Decision 3), repository pattern, le domaine
  ne depend jamais directement de MongoDB.
- Contract-first : `packages/contracts` (Zod) avant toute implementation
  d'API critique.
- Aucun faux produit : pas de mock presente comme reel, pas de bouton
  mort, pas de route morte (regle absolue `03_AGENT_PROTOCOL.md #2`).
- Chaque phase se termine par un rapport et un STOP explicite ; jamais
  d'enchainement automatique vers la phase suivante.

---

## Phase 1 - Foundation

**Objectif** : socle technique sur lequel toutes les phases suivantes
s'appuient.

**Livrables cles**
- Monorepo `pnpm` + `Turborepo` (structure `apps/`, `packages/`,
  `infrastructure/` conforme a `01_SPEC_PRODUCT.md #79`).
- `packages/contracts` (schemas Zod partages, ex. Offer/WalletTransaction/
  DomainEvent de `07_EXAMPLES.md`), `packages/config`,
  `packages/eslint-config`, `packages/tsconfig`, `packages/shared-utils`,
  `packages/design-tokens`, `packages/i18n` (squelettes).
- `apps/api` (NestJS + Fastify adapter) : bootstrap minimal, health check,
  OpenAPI expose, connexion MongoDB/Redis.
- `apps/worker` : bootstrap BullMQ minimal.
- `apps/web` (Next.js) et `apps/admin` (Next.js) : bootstrap minimal.
- ESLint strict (interdiction `any` non justifie), Prettier, TypeScript
  strict partage via `packages/tsconfig`.
- `docker-compose.dev.yml` completant les services applicatifs (api,
  worker, web, admin) en plus de mongodb/redis/minio deja presents.
- CI GitHub Actions : install -> lint -> typecheck -> unit tests -> build
  (le pipeline complet de `02_SPEC_ENGINEERING.md #107` se construit
  progressivement au fil des phases).
- `.github/workflows/` peuple.

**Portee explicite** : pas de logique metier, pas d'auth, pas de domaine.
Uniquement le squelette + tooling + build gates fonctionnels.

**Criteres de sortie** : `pnpm lint && pnpm typecheck && pnpm test &&
pnpm build` passent a zero erreur sur un monorepo vide de logique
metier ; `docker compose up -d` demarre tous les services y compris les
apps ; healthcheck API repond.

---

## Phase 2 - Auth

**Objectif** : authentification et RBAC operationnels.

**Livrables cles**
- Module `auth` : Phone OTP (provider dev par defaut, abstraction
  `SmsProvider`), email + verification email, sessions, devices, logout,
  remote logout, rotation refresh tokens.
- Web : cookies secure/HttpOnly/SameSite + CSRF. Mobile (prepare, pas
  encore implemente avant Phase 13) : stockage securise.
- Rate limiting OTP/login (anti brute-force, anti OTP bombing).
- RBAC : roles (`CLIENT`, `PROVIDER`, `COMPANY_MEMBER`, `SUPPORT`,
  `VERIFICATION_AGENT`, `MODERATOR`, `DISPUTE_AGENT`, `FINANCE_AGENT`,
  `MANAGER`, `ADMIN`, `SUPER_ADMIN`) + base ABAC (owner/participant).
- Data model : `User`, `UserSession`, `Device`, `UserRole`.
- Regle age (18+ pour devenir fournisseur, configurable).

**Criteres de sortie** : parcours OTP dev complet teste (unit +
integration), aucune route protegee accessible sans session valide,
build gates verts.

---

## Phase 3 - Marketplace

**Objectif** : catalogue de services, profils, onboarding, verification,
entreprises.

**Livrables cles**
- Service Catalog hierarchique (Domain -> Category -> Service ->
  InterventionType -> Complexity -> RequiredSkill), administrable.
- Profils fournisseur (bricoleur/technicien/expert), profils entreprise.
- `VerificationCase` avec etats (`DRAFT`, `IN_REVIEW`,
  `NEEDS_CORRECTION`, `VERIFIED`, `REJECTED`, `SUSPENDED`, `EXPIRED`),
  decisions historisees, badges precis (pas juste une etoile globale).
- `Company`, `CompanyMember`, `CompanyVerification`.
- Onboarding progressif (bricoleur -> technicien -> expert).

**Criteres de sortie** : catalogue modifiable depuis un back-office
minimal, cycle de verification complet teste, build gates verts.

---

## Phase 4 - Requests

**Objectif** : creation de demande par le client.

**Livrables cles**
- `ServiceRequest`, `RequestMedia`, `RequestLocation`.
- Saisie texte/photo/video/audio/urgence/localisation/disponibilite.
- Structuration de la demande (le mode IA complet arrive en V2/Phase 11 ;
  fallback manuel/formulaire classique fonctionnel des cette phase,
  conforme a `01_SPEC_PRODUCT.md #13`).
- Upload media : `CreateUploadSession -> SignedUpload -> ObjectStorage ->
  Scan -> Process -> Finalize`, controles MIME/taille/signature.
- State machine `Request` (`DRAFT`, `REQUESTED`, `MATCHING`, ...).

**Criteres de sortie** : creation de demande de bout en bout sans IA
(fallback obligatoire), medias stockes via MinIO avec URLs signees
courtes, build gates verts.

---

## Phase 5 - Matching

**Objectif** : mise en relation client/fournisseur.

**Livrables cles**
- `Match`, `MatchCandidate`, `DispatchBatch`.
- Eligibility -> Ranking -> petit batch -> wait -> batch suivant ->
  expansion de rayon -> matching final.
- Ponderations configurables (competence, disponibilite, distance,
  urgence, experience, fiabilite, charge, reputation, exploration
  nouveaux fournisseurs).
- `GeoService`, `DistanceService`, `TravelTimeService`,
  `TransportPricingService`, abstraction `MapProvider`.

**Criteres de sortie** : simulation de dispatch progressif testee
(pas d'envoi a tous les fournisseurs d'un coup), expansion de rayon
fonctionnelle, build gates verts.

---

## Phase 6 - Chat

**Objectif** : messagerie temps reel liee a la demande/intervention.

**Livrables cles**
- `Conversation`, `Message`, `MessageAttachment`.
- Socket.IO : texte, media, reponses, reactions, edition/suppression
  controlee, recherche, typing indicator, sent/delivered/read.
- `ContactDetectionService` (detection numeros/emails/URLs/contournement)
  actif avant acceptation d'offre ; leve apres acceptation.
- Reconnexion, idempotence, deduplication des evenements.

**Criteres de sortie** : tests prouvant qu'un numero de telephone est
bloque/masque avant acceptation et visible apres, build gates verts.

**Livree le 2026-09-21** — voir `docs/phases/PHASE_6_REPORT.md`. Hors
perimetre par construction : notifications push/SMS/email et signalement
de message (moderation, Phase 10).

---

## Phase 7 - Offers

**Objectif** : offres, negociation, acceptation, verrouillage du prix.

**Dependance issue de la Phase 6** : l'acceptation d'une offre doit appeler
`ConversationService.unlockContact(requestId, providerUserId)` — c'est la
seule maniere prevue de lever la protection des coordonnees du chat
(Decision 53). Une offre reste un objet metier, jamais un message.

**Livrables cles**
- `Offer`, `OfferVersion`, `CounterOffer` (schema conforme a
  `07_EXAMPLES.md`).
- Flux Offer -> CounterOffer -> ... -> AcceptedOffer, toutes versions
  conservees.
- Verrouillage du prix apres acceptation, `MaterialRequest`
  (item/quantite/prix estime/plafond autorise), `ScopeChangeRequest`.
- Idempotency-Key sur "accept offer".
- Concurrency : deux clients ne peuvent pas accepter deux offres
  incompatibles simultanement (optimistic locking/version).

**Criteres de sortie** : test de concurrence (double acceptation)
qui echoue proprement pour le second acteur, build gates verts.

---

## Phase 8 - Interventions

**Objectif** : cycle de vie complet de l'intervention.

**Livrables cles**
- `Appointment`, `Intervention` avec state machine complete
  (`CONFIRMED -> ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> PAUSED ->
  COMPLETED -> DISPUTED/CANCELLED/NO_SHOW`), transitions validees
  cote backend uniquement (`02_SPEC_ENGINEERING.md #100-101`).
- GPS tracking pendant le trajet, localisation precise seulement apres
  confirmation et pour le fournisseur autorise, expiration de l'acces.
- Navigation externe (bouton "Naviguer" vers Google Maps/Waze/Apple
  Maps), pas de navigation vocale interne.
- Cancellation Policy Engine (`Cancellation` avec actor/timestamp/reason/
  categorie/preuve/resultat).

**Criteres de sortie** : E2E principal de `02_SPEC_ENGINEERING.md #104`
execute jusqu'a `COMPLETED` (paiement/wallet/review restent V2, donc le
E2E complet ne sera termine qu'apres Phase 9 - documenter cette
limitation explicitement dans le rapport de Phase 8), build gates verts.

---

## Apres le MVP

V2 (Phases 9-12 : Finance, Trust, AI, Admin) et V3 (Phases 13-15 :
Mobile, Hardening, Production) ne demarrent qu'apres validation humaine
explicite du MVP complet, conformement a `06_SCOPE.md`. Ce plan sera
etendu avec le meme niveau de detail au moment ou le GO V2 sera donne.

---

## Suivi

Ce fichier est mis a jour "si le plan change" (`03_AGENT_PROTOCOL.md
#9`) : re-sequencement de taches, decouverte d'une dependance non
prevue, changement de perimetre valide par l'utilisateur. L'etat
d'avancement phase par phase reste dans `docs/PROGRESS.md` et
`docs/phases/PHASE_X_REPORT.md`.
