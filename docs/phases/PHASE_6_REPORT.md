# PHASE 6 - CHAT

## Statut : TERMINEE

## Date debut / fin

Debut : 2026-09-21 (« GO PHASE 6 »)
Fin : 2026-09-21

## Objectifs

01_SPEC_PRODUCT.md #26 (chat), #27 (protection contre le contournement),
#49 (realtime), #50 (reconnexion) ; IMPLEMENTATION_PLAN.md Phase 6.

**Critere de sortie** : « tests prouvant qu'un numero de telephone est
bloque/masque avant acceptation et visible apres, build gates verts » —
**atteint** (voir « Tests »).

## Ce qui a ete fait

### Le probleme de dependance, tranche avant le code

« Avant / apres acceptation » renvoie a l'acceptation d'une **offre** —
Phase 7. Plutot qu'une route « debloquer » (qui annulerait la protection)
ou un report (qui violerait le critere de sortie), la conversation porte un
`contactPolicy` que seule `ConversationService.unlockContact` fait passer a
`UNLOCKED`. **Aucune route HTTP ne l'expose** — un test le verifie. C'est
exactement l'appel que fera l'acceptation d'offre (Decision 53).

### Anti-contact (#27)

- `ContactDetectionService` : telephones, emails, URLs, handles, mentions
  de plateformes externes, et leurs variantes — chiffres arabes-indiens,
  persans, pleine largeur ; nombres en lettres en francais (par paires,
  soixante-dix, quatre-vingt-dix-neuf), anglais, darija latine et arabe ;
  lettres sosies ; espaces insecables.
- **Precision** : les candidats telephone sont confirmes par
  `libphonenumber-js` (plan de numerotation reel), ce qui laisse intacts
  prix, heures, dates, adresses, RIB, compteurs, numeros de serie —
  24 cas de faux positifs epingles en test.
- Applique aux **envois**, aux **editions** et aux **noms de pieces
  jointes**, avant tout stockage. L'original n'est **jamais ecrit** ; seule
  la trace de la tentative l'est (`redactions: [{type}]`).
- Apres deverrouillage : chaque partie voit le **telephone verifie du
  compte** de l'autre, et les nouveaux messages ne sont plus masques.

### Chat (#26)

Texte ; photos, videos, fichiers (pipeline media existant, cible
`CONVERSATION`, donc taille signee de la Decision 52) ; reponses ;
reactions (liste fermee) ; modification (15 min, re-scannee) ; suppression
controlee (24 h) ; recherche ; typing ; sent / delivered / read.

### Temps reel (#49, #50)

HTTP ecrit, Socket.IO notifie. Salles par utilisateur, authentification a
la poignee de main, balayage qui deconnecte les sessions revoquees,
rattrapage `after=<seq>` a chaque reconnexion, idempotence par
`clientMessageId`, deduplication par `version`, adaptateur Redis.

### Frontend

Ecran `/conversations/[id]` : fil temps reel, bandeau de protection,
numero verifie une fois deverrouille, accuses, frappe, reponse, reactions,
edition et suppression par `Modal`, pieces jointes image, recherche,
indicateur de reconnexion. Points d'entree depuis la boite du fournisseur
et l'ecran de suivi client. Primitives de chat dans `@fixiyi/ui`.

## Fichiers crees

**API** — `apps/api/src/chat/` : `chat.module.ts`, `chat.controller.ts`,
`chat.gateway.ts`, `chat-events.publisher.ts`, `realtime.adapter.ts`,
`conversation.service.ts`, `message.service.ts`, `message-view.ts`,
`schemas/conversation.schema.ts`, `schemas/message.schema.ts`,
`contact-detection/{contact-detection.ts, contact-detection.service.ts,
normalize.ts, number-words.ts, contact-detection.test.ts}`.
Tests : `apps/api/test/{chat-test-harness.ts, chat-anti-contact.e2e.test.ts,
chat-messaging.e2e.test.ts, chat-realtime.e2e.test.ts}`.

**Contrats** — `packages/contracts/src/chat.ts`, `chat.test.ts`.

**Design system** — `packages/ui/src/components/{Chat.tsx, Chat.test.tsx,
IconButton.tsx, IconButton.test.tsx}`.

**Web** — `apps/web/src/lib/{chat-api.ts, realtime.ts, use-chat-thread.ts}`,
`apps/web/src/app/conversations/[id]/{page.tsx, message-item.tsx,
composer.tsx}`.

**Navigateur** — `tests/browser/support/journeys.ts`,
`tests/browser/tests/chat.spec.ts`.

**Docs** — `docs/phases/PHASE_6_PLAN.md`, ce rapport.

## Fichiers modifies

- `app.module.ts`, `main.ts` — module chat, adaptateur temps reel.
- `auth/` — `RateLimitGuard` gagne `key: "user"` ; `SessionService.filterActiveIds`
  (balayage groupe) ; export du rate limiter.
- `matching/` — `findCandidacy`, `findCandidacyById`, `findCandidacies`,
  `markCandidacyViewed` ; la transition `NOTIFIED -> VIEWED` n'existe plus
  qu'a un endroit ; export du service.
- `media/`, `infrastructure/storage/` — `requireAttachable`,
  `describeForDisplay`, URL presignee de lecture (5 min).
- `requests/`, `providers/` — requetes groupees (`findSummaries`,
  `findManyByIds`) : la liste des conversations fait 5 requetes quelle que
  soit sa taille.
- `packages/contracts` — cible media `CONVERSATION`.
- `packages/ui` — icones `send`, `reply`, `attach`, `check-double`
  (`send`/`reply` mirroirees en RTL) ; styles de chat.
- `apps/web`, `apps/admin` — `apiFetch` accepte `PUT` ; `refreshSession`
  exporte pour la socket ; points d'entree vers le chat.
- `tests/browser/tests/matching.spec.ts` — utilise les parcours partages.

71 fichiers, +6 616 / -183 lignes. Plus gros fichier cree : 365 lignes.

## Tests (unit, integration, build)

| Suite | Tests | Ce qu'elle prouve |
|---|---|---|
| `contact-detection.test.ts` | 77 | rappel sur toutes les variantes, **et** 24 faux positifs qui doivent rester intacts |
| `chat-anti-contact.e2e.test.ts` | 16 | **le critere de sortie**, a trois niveaux : reponse a l'expediteur, lecture par l'autre partie, **document en base** |
| `chat-messaging.e2e.test.ts` | 18 | idempotence, `seq`, pagination et rattrapage, reponses, reactions, fenetres d'edition/suppression, accuses, pieces jointes (aller-retour d'octets reel), recherche litterale |
| `chat-realtime.e2e.test.ts` | 12 | vrais clients socket.io via le vrai adaptateur Redis : auth de poignee de main, revocation, vues par lecteur, isolation, frappe, pas de tempete d'accuses |
| `packages/contracts` chat | 21 | regles d'entree |
| `packages/ui` chat + IconButton | 23 | primitives, accessibilite, RTL |
| Playwright `chat.spec.ts` | 1 scenario | deux navigateurs : livraison en direct, frappe, masquage, avis a l'expediteur, READ en direct, reponse, rechargement |

Le critere de sortie, concretement :

```
masque AVANT  : l'expediteur recoit "Appelez-moi au [•••] ce soir" + redactions [PHONE]
                l'autre partie lit la meme chose
                le document MongoDB contient la meme chose — le numero n'a jamais ete ecrit
                aucune des deux parties ne voit le telephone de l'autre
visible APRES  : unlockContact() -> chaque partie voit le telephone VERIFIE de l'autre
                un nouveau numero est livre tel quel
                l'ancien message masque le reste (rien a reveler : jamais stocke)
```

Verifie en base apres le scenario navigateur : **0** numero brut dans les
messages stockes de la base de dev.

## Commandes lancees et resultats

```
pnpm lint --force       -> 15/15 taches, 0 erreur, 0 warning
pnpm typecheck --force  -> 15/15 taches, 0 erreur
pnpm test --force       -> 13/13 taches, 542 tests, 0 echec
pnpm build --force      -> 10/10 taches, succes
playwright test         -> 5/5 scenarios (images api/web/admin reconstruites)
```

| Package | Avant Phase 6 | Apres |
|---|---|---|
| `@fixiyi/api` | 155 | **278** |
| `@fixiyi/ui` | 102 | **125** |
| `@fixiyi/contracts` | 69 | **90** |
| autres | 49 | 49 |
| **Total** | **375** | **542** |

## Decisions prises

Decisions **53 a 61** (`docs/DECISIONS.md`) : point d'accroche du
deverrouillage et sens de « visible apres » (53), strategie de detection
(54), architecture temps reel (55), dependances (56), accuses par
filigranes (57), cycle de vie de la conversation (58), **conservation des
messages supprimes — validation humaine requise** (59), rate limiting par
utilisateur (60), six bugs reels (61).

## Problemes rencontres

Six bugs reels, tous trouves par l'execution (detail : Decision 61) :
decalage d'offsets par un emoji ; tests passant **a vide** a cause d'un
`dist` perime ; numeros de test devenus invalides passe 99 connexions ;
classe de caracteres corrompue par l'outillage (les tests passaient
toujours) ; indicateur de frappe persistant, **vu dans les captures
Playwright** ; session Playwright injectee avec un refresh token deja
consomme.

Et un choix corrige en cours de route : le client ouvrait une conversation
en nommant un `providerUserId` — que l'ecran client ne connaissait meme
pas. Il nomme desormais une **candidature**, qui est en soi la preuve du
contact (Decision 58).

## Limitations / TODO documentes

- **Deverrouillage** : aucun declencheur avant la Phase 7. En Phase 6,
  toutes les conversations restent `PROTECTED` dans l'usage reel.
- **Conservation des messages supprimes** : defaut reversible, **a
  confirmer** (Decision 59).
- **Pas d'OCR** : un numero ecrit dans une photo passe.
- **Pas de notifications** push/SMS/email (#26) : aucun canal n'existe et
  aucune phase MVP ne le prevoit (deja note en Phase 5).
- **Pas de signalement** de message (#26) : moderation, Phase 10.
- **Recherche** par conversation seulement, sans pliage des accents
  (« electricite » ne trouve pas « électricité »).
- **Uploads de verification** toujours non bornes en taille (limite de la
  Decision 52, inchangee).
- **Pas de notification temps reel du deverrouillage** : le client voit le
  numero au prochain chargement de la conversation. A ajouter avec la
  Phase 7, qui declenche l'evenement.
- Textes de l'ecran de chat en francais uniquement, comme le reste de
  `apps/web` : l'i18n des ecrans n'a pas encore ete branchee.

## Prerequis pour phase suivante

- **Phase 7 doit appeler** `ConversationService.unlockContact(requestId,
  providerUserId)` a l'acceptation d'une offre — le module est deja
  exporte pour cela, et c'est la seule maniere prevue de lever la
  protection.
- Une offre (#28) est un objet metier, **pas un message** : elle ne doit
  pas transiter par le chat, mais peut y etre annoncee par un evenement.
- La conversation existe deja par `(demande, fournisseur)` : c'est
  naturellement le fil de la negociation.

## Prochaine phase

Phase 7 - Offers (offres, contre-offres, negociation, acceptation, price
lock) — **STOP, en attente de « GO PHASE 7 »**.
