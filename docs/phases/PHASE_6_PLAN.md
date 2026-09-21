# PHASE 6 - CHAT - PLAN

## Objectif

Messagerie temps reel liee a la demande (01_SPEC_PRODUCT.md #26, #27, #49,
#50 ; docs/IMPLEMENTATION_PLAN.md Phase 6), avec une protection
anti-contournement reelle avant acceptation d'offre.

**Critere de sortie (IMPLEMENTATION_PLAN.md)** : des tests prouvant qu'un
numero de telephone est bloque/masque avant acceptation et visible apres,
gates verts.

## Lecture prealable effectuee

06_SCOPE, 03_AGENT_PROTOCOL, 05_DECISION_POLICY, PROGRESS, DECISIONS
(1-52), PHASE_5_REPORT, IMPLEMENTATION_PLAN (Phase 6), 01_SPEC_PRODUCT
#26/#27/#49/#50/#52, 02_SPEC_ENGINEERING (rate limiting #634/#640).

## Le probleme de dependance a trancher en premier

§27 dit « avant acceptation » / « apres acceptation » — d'une **offre**.
Or les offres sont la **Phase 7**. Rien, en Phase 6, ne peut accepter une
offre.

Deux mauvaises reponses, ecartees :
- inventer une route « debloquer les coordonnees » appelable par un
  utilisateur : elle annulerait toute la protection (un fournisseur
  l'appellerait lui-meme) — et ce serait un faux workflow
  (03_AGENT_PROTOCOL #2) ;
- repousser tout l'anti-contact en Phase 7 : le critere de sortie de la
  Phase 6 l'exige.

**Choix** : la conversation porte un etat `contactPolicy`
(`PROTECTED` | `UNLOCKED`). Une seule methode de service,
`ConversationService.unlockContact(requestId, providerUserId)`, le fait
passer a `UNLOCKED`. **Aucune route HTTP ne l'expose.** C'est le point
d'accroche exact que l'acceptation d'offre (Phase 7, evenement de domaine
`OfferAccepted`, deja declare dans `@fixiyi/contracts`) appellera. Les
tests e2e l'appellent via l'injection de dependances — c'est le vrai
chemin de code, pas un raccourci de test.

## Ce que « masque avant, visible apres » veut dire precisement

Lecture retenue de §27 (« Apres acceptation : **le numero autorise** peut
etre affiche. Fixiyi ne fournit pas de VoIP interne ») :

- **Avant** (`PROTECTED`) : les coordonnees detectees dans un message sont
  **masquees** a l'ecriture (le reste du message passe — bloquer tout le
  message pour un numero serait punitif et inutile). La conversation
  **n'expose pas** le telephone de l'autre partie. L'expediteur est
  **prevenu** que son message a ete masque (jamais de masquage
  silencieux).
- **Apres** (`UNLOCKED`) : la conversation expose le **numero verifie du
  compte** de l'autre partie (« le numero autorise » — celui qu'on a
  verifie par OTP, pas une chaine tapee dans le chat), et les nouveaux
  messages ne sont plus masques.
- **Les messages masques avant l'acceptation le restent.** L'original
  n'est **jamais stocke** : c'est ce qui garantit qu'aucun bug de lecture,
  de recherche ou d'export ne peut le faire fuiter. On garde en revanche
  la **trace** de la tentative (`redactions: [{type}]`, sans la valeur)
  pour le futur scoring de risque (Phase 10).

## ContactDetectionService

Detecte (§27) : numeros, emails, URLs, tentatives de contournement,
variantes textuelles evidentes. Fonction pure, testee a part.

1. **Normalisation avec carte d'offsets** vers le texte original (pour
   masquer au bon endroit) :
   - chiffres arabes-indiens (`٠-٩`) et persans (`۰-۹`) -> ASCII —
     indispensable au Maroc (ar/ary, 01_SPEC_PRODUCT #5) ;
   - chiffres **ecrits en toutes lettres** -> chiffres : fr (zero..neuf,
     dix..seize, vingt..soixante), en (zero..nine), darija latine
     (wahed, jouj, tlata, rb3a, khamsa, stta, sb3a, tmnya, ts3oud).
2. **Telephones** : spans de chiffres avec separateurs courts
   (`espace . - / ( )`), puis **validation par `libphonenumber-js`**
   (deja une dependance) avec `MA` par defaut. La validation est ce qui
   evite les faux positifs : un prix (`1500 DH`), une heure (`14h30`), une
   date, une adresse (`12 rue ...`) ne sont pas des numeros valides.
3. **Emails** : forme standard, et obfusquee (`(at)`, `[at]`, `arobase`,
   `(dot)`, `point`...) — l'obfuscation n'est retenue que si elle forme
   une adresse complete, sinon « point » et « at » seraient masques dans
   des phrases ordinaires.
4. **URLs / canaux externes** : `http(s)://`, `www.`, domaines usuels,
   raccourcisseurs (`wa.me`, `t.me`, `bit.ly`), et **handles** `@nom`.
   La simple mention d'une plateforme (« whatsapp », « insta ») est
   **journalisee** comme tentative de contournement mais **pas masquee** :
   le mot n'est pas une coordonnee.
5. Tout est masque en `[coordonnees masquees]` avant acceptation.

Applique a : **envoi**, **edition** (sinon l'edition devient le
contournement), et **nom des pieces jointes** (un nom de fichier peut
contenir un numero).

**Limite assumee** : pas d'OCR sur les images (aucun fournisseur
provisionne ; l'IA est la Phase 11). Un numero ecrit dans une photo passe.

## Modele de donnees

- `Conversation` : `requestId`, `clientUserId`, `providerUserId`,
  `providerId`, `contactPolicy`, `contactUnlockedAt`, `lastMessageSeq`,
  `lastMessageAt`, et 4 curseurs d'accuse (`clientDeliveredSeq`,
  `clientReadSeq`, `providerDeliveredSeq`, `providerReadSeq`). Unique sur
  `(requestId, providerUserId)`.
- `Message` : `conversationId`, `seq`, `senderUserId`, `clientMessageId`
  (cle d'idempotence), `body` (deja masque), `attachments` (media ids),
  `replyToMessageId`, `reactions`, `redactions`, `version`, `editedAt`,
  `deletedAt`. Index uniques `(conversationId, seq)` et
  `(conversationId, senderUserId, clientMessageId)`.

`seq` : entier monotone par conversation, alloue par `$inc` atomique. Il
sert au rattrapage apres reconnexion et a la deduplication. **Monotone,
pas garanti dense** (une course sur l'idempotence peut bruler un numero) —
le client rattrape donc par `after=<dernier seq>`, jamais en cherchant des
trous.

## Qui peut discuter

- La conversation lie **le client de la demande** et **un fournisseur
  reellement dispatche** dessus (`MatchCandidate` en `NOTIFIED` ou
  `VIEWED`, Phase 5). On ne peut pas ecrire a un fournisseur qui n'a pas
  ete contacte par le moteur.
- Ouvrir une conversation cote fournisseur fait passer sa candidature de
  `NOTIFIED` a `VIEWED` (reutilise `MatchingService.markViewed`). Raison :
  seules les candidatures `NOTIFIED` expirent ; sans cela, une discussion
  engagee serait coupee au passage du batch suivant.
- Envoi refuse (`CONVERSATION_CLOSED`) si la demande est annulee ou si la
  candidature a ete declinee/expiree — **sauf** si les coordonnees ont
  ete debloquees (apres acceptation, la conversation doit survivre
  jusqu'a l'intervention).
- Frontiere de module (01_SPEC_PRODUCT #51) : le chat n'accede pas au
  modele `MatchCandidate` ; `MatchingModule` exporte une requete etroite.

## Temps reel : l'API est la source de verite, la socket ne fait que notifier

§49 : « Le WebSocket n'est jamais la source de verite. » On l'applique
litteralement :

- **Toutes les mutations passent par HTTP** (envoi, edition, suppression,
  reaction, accuses) : memes guards, meme validation Zod, meme rate
  limiting, memes erreurs Problem Details que le reste de l'API.
- **Socket.IO ne transporte que** les notifications serveur -> client
  (`message.created`, `message.updated`, `receipts.updated`) et un seul
  evenement client -> serveur ephemere : `typing` (jamais persiste).
- **Salles par utilisateur** (`user:<id>`), rejointes automatiquement a la
  connexion. Le serveur choisit qui recoit quoi a partir des participants
  en base : un client ne peut pas demander a rejoindre la salle d'une
  conversation qui n'est pas la sienne, puisqu'il ne demande rien.
- **Authentification a la poignee de main** avec le token d'acces, puis
  la session est reverifiee sur les evenements entrants — meme logique
  qu'`AuthGuard` (la revocation doit couper la socket).
- **Reconnexion** (§50) : le client relit le token courant a chaque
  tentative (le refresh de la Decision 51 a pu le faire tourner) ; en cas
  de refus d'authentification il rafraichit puis reessaie. Au retour, il
  rattrape `GET .../messages?after=<seq>` depuis la base.
- **Idempotence / dedup** : `clientMessageId` a l'envoi (un double envoi
  renvoie le meme message) ; cote client, cle par `id` et on garde la
  plus haute `version`.
- **Multi-instance** : adaptateur Redis `@socket.io/redis-adapter`. Une
  seule instance API aujourd'hui, mais sans lui, deux replicas feraient
  perdre silencieusement les messages entre utilisateurs connectes a des
  instances differentes. Redis est deja la.

## Fonctionnalites (§26, perimetre IMPLEMENTATION_PLAN)

| Fonction | Implementation |
|---|---|
| texte | `POST /conversations/:id/messages` |
| photo / video / fichiers | pipeline media existant, cible `CONVERSATION` — **avec la taille signee du correctif B2** |
| reponses | `replyToMessageId` (meme conversation), extrait resolu a la lecture |
| reactions | **liste fermee** d'emojis, 1 par utilisateur et par message — une reaction libre serait un canal de texte pour faire passer un numero |
| modification | expediteur seul, fenetre de 15 min, **re-scan anti-contact** |
| suppression controlee | expediteur seul, fenetre de 24 h, masquee aux participants, **conservee** pour les litiges (voir « validation humaine ») |
| recherche | par conversation, sur le texte **stocke (deja masque)** — ne peut pas faire ressortir une coordonnee |
| typing | socket, ephemere, jamais persiste |
| sent / delivered / read | curseurs par participant ; le statut de chaque message est **calcule par l'API** pour le lecteur (pas de logique metier dans React, 03_AGENT_PROTOCOL #2) |

Rate limiting : envoi limite **par utilisateur** (et non par IP : derriere
un NAT, tous les clients partageraient un quota — c'est le finding B4). Le
`RateLimitGuard` gagne une cle `user`, retro-compatible.

## Hors perimetre (explicitement)

- **Notifications** (§26) : aucun canal (push/SMS/email) n'existe ; le
  rapport de Phase 5 note deja qu'aucune phase MVP ne prevoit
  `Notification`. Pas absent de l'IMPLEMENTATION_PLAN par oubli.
- **Signalement** (§26) : c'est la moderation, Phase 10.
- **OCR** des images (voir limite anti-contact).
- **Recherche globale** tous-conversations : par conversation seulement.

## Frontend (`apps/web`)

- `/conversations/[id]` : fil de discussion temps reel — bulles, accuses
  sent/delivered/read, indicateur de frappe, reponse, reactions, edition,
  suppression, piece jointe image, recherche, bandeau « coordonnees
  masquees jusqu'a l'acceptation d'une offre », indicateur de
  reconnexion.
- Points d'entree : ecran fournisseur (« Discuter avec le client ») et
  ecran de suivi client (« Envoyer un message » par candidat).
- Primitives de chat dans `@fixiyi/ui` (01_SPEC_PRODUCT #1217 cite
  « chat » dans le design system) : bulle, indicateur de frappe, statut
  de livraison ; nouvelles icones `send`, `reply`, `attach`,
  `check-double`.

## Nouvelles dependances

Toutes nommees par la stack cible (01_SPEC_PRODUCT #52 « Socket.IO ») et
par l'IMPLEMENTATION_PLAN valide :

- `apps/api` : `@nestjs/websockets`, `@nestjs/platform-socket.io`
  (12.0.3, alignes sur Nest 12), `socket.io` (4.8.3),
  `@socket.io/redis-adapter` (8.3.0).
- `apps/web` : `socket.io-client` (4.8.3).

## Validation humaine requise (non bloquante, defaut reversible choisi)

**Conservation des messages supprimes** — choix juridique
(05_DECISION_POLICY : « Choix juridique » -> validation humaine ;
loi marocaine 09-08 sur les donnees personnelles). Defaut retenu : le
message supprime est **cache aux participants mais conserve** pour les
litiges (01/02_SPEC : un litige contient « le chat pertinent »). C'est le
defaut **reversible** : un job de purge peut s'ajouter plus tard, alors
qu'une purge immediate ne se rattrape pas. A confirmer par l'utilisateur.

## Tests

- **Unitaires** `ContactDetectionService` : numeros MA et internationaux,
  separateurs, chiffres arabes, chiffres en lettres (fr/en/darija),
  emails normaux et obfusques, URLs, handles, raccourcisseurs ; **et les
  faux positifs** (prix, heures, dates, adresses, quantites) — un
  detecteur qui masque « 1500 DH » est inutilisable.
- **e2e API** : masque avant / visible apres (le critere de sortie),
  edition re-scannee, nom de piece jointe re-scanne, autorisation
  (etranger, fournisseur non dispatche, candidature declinee),
  idempotence, pagination par curseur, rattrapage `after`, reactions
  hors liste refusees, fenetres d'edition/suppression, accuses, recherche.
- **Temps reel** : vrais clients `socket.io-client` contre l'application
  de test — authentification refusee sans token, reception de
  `message.created`, frappe relayee a l'autre partie seulement, isolation
  (un tiers ne recoit rien).
- **Playwright** : deux navigateurs (client + fournisseur), message recu
  en direct sans rechargement, numero masque, accuse de lecture.
- **UI** : tests des primitives de chat.

## Ordre d'execution

1. Contrats (`chat.ts`, cible media `CONVERSATION`).
2. `ContactDetectionService` + tests (le coeur du critere de sortie).
3. Module chat : schemas, service, controleur, regles d'acces.
4. Gateway Socket.IO + adaptateur Redis + auth de poignee de main.
5. Tests e2e API et temps reel.
6. Primitives `@fixiyi/ui` + ecran `apps/web` + client socket.
7. Playwright, gates, rapport, DECISIONS, PROGRESS -> STOP.
