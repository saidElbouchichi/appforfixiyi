# PRE-PHASE 6 REPORT

## Date

2026-09-21

## ECC

- Version : v2.2.2
- Scope : User (global), utilise uniquement dans Fixiyi
- Hooks : Minimal
- Statut : Actif
- Documentation d'integration : `docs/prompt/08_ECC_INTEGRATION.md`
  (ajoute en point 8 de l'ordre de lecture obligatoire de
  `docs/prompt/00_README.md`)

### Ecart de nommage a connaitre

Les commandes citees dans la mission (`/ecc:review`, `/ecc:security`,
`/ecc:tdd`, `/ecc:frontend`) **n'existent pas** sous ces noms dans ECC
v2.2.2. La surface reelle utilisee :

| Cite | Reel |
|---|---|
| `/ecc:review` | `/ecc:code-review`, agents `ecc:code-reviewer` / `ecc:typescript-reviewer` |
| `/ecc:security` | `/ecc:security-review`, agent `ecc:security-reviewer` |
| `/ecc:tdd` | `/ecc:tdd-workflow`, agent `ecc:tdd-guide` |
| `/ecc:frontend` | `/ecc:react-review`, agent `ecc:react-reviewer` |

`08_ECC_INTEGRATION.md` garde la liste dictee par l'utilisateur (contenu
impose mot pour mot) ; la correspondance operationnelle est dans
`docs/INSPECTION_ECC_PHASE_0_5.md`.

### Honnetete sur l'execution des agents

Un premier lot de 4 agents ECC lances en parallele (securite, TypeScript,
code review, React) est **mort en cours d'execution** sur une limite de
session de l'API — aucun n'a rendu de resultat. Apres reinitialisation,
l'agent `ecc:security-reviewer` a ete relance seul et a rendu son
rapport ; **chacun de ses findings a ete re-verifie a la main dans le
code** avant d'etre retenu, et les items non confirmes n'apparaissent pas
dans le rapport d'inspection. Le reste de l'inspection (structure, tests,
MongoDB, Redis, Playwright, cause racine du bug frontend) a ete conduit
directement, pas delegue.

## Inspection Phases 0-5

Rapport complet : `docs/INSPECTION_ECC_PHASE_0_5.md`.

| Phase | Verdict | Reserve |
|---|---|---|
| Phase 0 — Audit | **OK** | aucune |
| Phase 1 — Foundation | **OK** | MinIO absent du CI (MEDIUM) |
| Phase 2 — Auth | **OK** | aucune |
| Phase 3 — Marketplace | **OK** | base de test jamais purgee (MEDIUM) |
| Phase 4 — Requests | **OK** | aucune |
| Phase 5 — Matching | **OK avec reserves** | bug token frontend (HIGH), upload non borne (HIGH) |

Verifie sur la donnee reelle et non sur declaration : TTL Mongo
(`expireAfterSeconds` lu en base), index `2dsphere`, bornage du batch de
dispatch a 3 candidats par vague, ecart de score du siege d'exploration
(0,78 vs 0,68), lignes reellement ecrites par le run navigateur
(avant/apres), recoupement `declaredSizeBytes` / `actualSizeBytes` du
pipeline media.

## Design System

Point d'entree unique : `@fixiyi/ui` (composants) + `@fixiyi/ui/css`
(styles, qui importe lui-meme la couche mouvement). Aucune duplication
entre `apps/web` et `apps/admin` : les deux `globals.css` se contentent
d'importer les tokens puis `@fixiyi/ui/css`.

### Composants : 8 -> 11

| Composant | Etat |
|---|---|
| Button, Input, Card, Badge, Loading/Skeleton/Spinner, EmptyState, ErrorState, Modal | existants, affines |
| **Icon** | nouveau — 21 SVG inline |
| **Select** | nouveau — remplace le `<select>` fait main (5 usages) |
| **RadioGroup** | nouveau — remplace les radios nus de l'urgence |

### Icones : 21, en 4 familles

- Navigation : `home`, `search`, `message`, `wallet`, `profile`
- Actions : `add`, `edit`, `delete`, `close`, `check`, `arrow`
- Statut : `success`, `warning`, `error`, `info`, `loading`
- Metier : `wrench`, `tools`, `calendar`, `map`, `star`, `shield`

Tailles `sm`/`md`/`lg`/`xl` = 16/20/24/32 px, toutes dessinees sur une
**seule grille 24x24** pour que l'epaisseur de trait reste optiquement
egale. Couleur : `currentColor` uniquement — aucune couleur codee sur un
`path`. Accessibilite : `aria-hidden` par defaut (l'icone accompagne du
texte), `role="img"` + `aria-label` quand elle porte le sens seule, et
`focusable="false"` pour qu'elle ne devienne jamais un arret de
tabulation. Aucune dependance externe.

### Animations

`packages/ui/src/styles/animations.css` — 6 `@keyframes` (`fx-fade-in`,
`fx-fade-out`, `fx-slide-in-from-bottom`, `fx-slide-in-inline`,
`fx-pulse`, `fx-spin`) et 7 utilitaires `.fx-animate-*`, dont un
`.fx-animate-stagger` qui fait arriver les listes en sequence.

Durees et courbes viennent **exclusivement** des tokens
(`--fixiyi-motion-*`, `--fixiyi-ease-*`) : un test echoue s'il trouve une
duree litterale ou un `cubic-bezier` inline dans le fichier.

Deux points non evidents, tenus par des tests :

- **`prefers-reduced-motion` en une seule regle**, pas une exemption par
  classe. Le test extrait la liste reelle des `.fx-animate-*` du fichier
  et exige que chacune figure dans le bloc : une animation ajoutee plus
  tard sans son exemption casse le build.
- L'exemption pose **`animation: none`** et pas `animation-duration:
  0.01ms`. Les utilitaires sont remplis en `both` ; une duree quasi nulle
  figerait un `fade-in` sur son etat `from` (`opacity: 0`) — l'element
  resterait **invisible** pour l'utilisateur qui vient justement de
  demander moins de mouvement.

RTL : le glissement directionnel passe par `--fx-slide-offset`, negatif
sous `[dir="rtl"]`, au lieu d'un `translateX` fige ; la fleche porte
`fx-icon--directional` et est mirroree sous `[dir="rtl"]` (une fleche
« suivant » non retournee pointe vers l'etape precedente en arabe).

**Verifie sur le vrai build Next.js** et pas seulement dans la source :
les 6 `@keyframes`, les 7 utilitaires, les 2 blocs
`prefers-reduced-motion` et les 2 regles `[dir="rtl"]` sont presents dans
le CSS compile de `apps/web`.

### Tokens

`tokens.css` avait derive de `tokens.ts` : `spacing`, `shadows`,
`typography`, `zIndex` et `motion.easing` n'existaient que cote
TypeScript. Consequence reelle : `styles.css` codait en dur ses ombres,
ses tailles de texte et son `z-index`, tout en se declarant « 100 %
tokens » — l'ancien test d'invariant ne le voyait pas parce qu'il ne
cherchait que des couleurs hexadecimales.

Les 5 familles manquantes sont ajoutees, `styles.css` les consomme, et un
**test de synchronisation bidirectionnelle** parse les deux fichiers :
tout token TS doit avoir sa variable CSS a la meme valeur, et toute
variable CSS doit avoir son token TS. `breakpoints` est exclu
explicitement — une custom property ne peut pas servir dans une `@media`,
l'exposer serait mensonger.

### Style

Ombres, rayons, tailles de texte, graisses, espacements et z-index
viennent desormais tous des tokens. Ajout d'utilitaires de mise en page
(`fx-page`, `fx-page__title`, `fx-page__header`, `fx-stack`, `fx-row`,
`fx-text-muted`) qui remplacent le `text-2xl font-semibold
text-[var(--fixiyi-color-neutral-900)]` recopie dans chacun des 6 ecrans.
Etats `hover` / `active` / `disabled` homogenes, retour tactile de 1 px a
l'enfoncement, anneau de focus unique a `2px` sur tout ce qui est
focusable (WCAG 2.2 AA 2.4.7 / 2.4.11), cibles tactiles a 44 px
(2.5.8).

### Ecrans adaptes : 6 / 6

| Ecran | Changement principal |
|---|---|
| `apps/web/login` | `fx-page__title`, icones, carte en `slide-in` |
| `apps/web/requests/new` | 5 `<select>` faits main -> `Select`, radios nus -> `RadioGroup`, stagger sur la liste de medias |
| `apps/web/requests/[id]/match` | `fx-page`, icones, stagger sur la liste de candidats |
| `apps/web/provider/requests` | `fx-page`, icones, stagger sur la liste de demandes |
| `apps/admin/login` | identique a web (meme composants) |
| `apps/admin/catalog` | **`window.prompt()` -> `Modal` + `Input`** |

Le `window.prompt()` du back-office (accepte en Decision 34 quand
`packages/ui` n'existait pas) est remplace : un prompt natif est
intraduisible — donc incompatible avec fr/en/ar/ary —, instylable,
bloquant, parfois supprime silencieusement par le navigateur, et muet
pour un lecteur d'ecran.

### Tests du design system

| Package | Avant | Apres |
|---|---|---|
| `@fixiyi/ui` | 52 | **102** |
| `@fixiyi/design-tokens` | 3 | **6** |

Repartition des 50 nouveaux tests `ui` : Icon 18, RadioGroup 9, Select 9,
animations 14. Ils testent des invariants verifiables, pas des
apparences : couverture des 4 familles d'icones, absence de couleur en
dur sur chaque `path`, grille 24x24 constante, `aria-hidden` vs
`role="img"`, mirroring RTL, association label/controle, auto-desactivation
du `Select` vide, cible de 44 px du `RadioGroup`, et pour les animations
les invariants du fichier CSS lui-meme (aucun keyframe orphelin, aucune
duree litterale, couverture integrale de `prefers-reduced-motion`,
absence de nom de keyframe portant un cote physique).

## Tests

Tous les gates relances apres la refonte du Design System, sur l'arbre
complet :

| Gate | Resultat | Attendu |
|---|---|---|
| `pnpm lint` | **15 / 15 taches, 0 erreur, 0 warning** | 0 erreur |
| `pnpm typecheck` | **15 / 15 taches, 0 erreur** | 0 erreur |
| `pnpm test` | **13 / 13 taches, 375 tests, 0 echec** (relance sans cache, `--force`) | 320+ |
| `pnpm build` | **10 / 10 taches, succes** | succes |
| Playwright | **4 / 4 scenarios** | 2+ |

Repartition des 375 tests :

| Package | Tests |
|---|---|
| `@fixiyi/api` | **155** (153 avant) |
| `@fixiyi/ui` | **102** (52 avant) |
| `@fixiyi/contracts` | 69 |
| `@fixiyi/shared-utils` | 27 |
| `@fixiyi/config` | 11 |
| `@fixiyi/design-tokens` | **6** (3 avant) |
| `@fixiyi/i18n` | 3 |
| `@fixiyi/worker` | 2 |

+55 tests par rapport aux 320 de la fin de Phase 5.

Playwright : les 2 scenarios d'origine plus **2 nouveaux**
(`session-refresh.spec.ts`, couverture du bug B1). Tous rejoues contre des
images Docker `api`, `web` et `admin` **reconstruites avec le code
corrige** — sans quoi le navigateur aurait teste l'ancien bundle et le
« vert » n'aurait rien prouve.

### Une note honnete sur un echec intermittent

Pendant la validation, le test `runs the full happy path` a depasse deux
fois son delai de 5 s. J'ai d'abord suppose une contention avec le build
Docker en cours — puis l'echec s'est reproduit sur ce que je croyais etre
une machine au repos, donc l'hypothese ne tenait plus en l'etat. Mesure
ensuite : execute seul, le test prend 250-300 ms ; en fichier complet,
trois runs consecutifs donnent 206, 265 et 268 ms. L'explication tient
aux horodatages : la notification de fin de build est arrivee **avec** la
sortie du second echec, donc les **deux** echecs ont eu lieu pendant le
build — et MinIO tourne dans la meme VM Docker, dont les E/S disque
etaient saturees. La suite complete relancee sans cache sur machine
reellement au repos passe a 375/375. Le test n'a pas ete modifie ni son
delai allonge.

Verification supplementaire, non demandee mais necessaire : le
remplacement du `window.prompt()` du back-office etait le changement le
plus risque de la session **et le seul sans couverture e2e**. Il a donc
ete verifie par un harnais Playwright temporaire contre l'admin reel
(supprime ensuite) : dialogue in-page avec `aria-modal="true"`, titre
lisible, refus du nom vide affiche dans le champ, fermeture par
`Escape`, creation reellement passee par l'API et noeud apparu dans
l'arbre, et **aucun `window.prompt()` natif declenche**. Le noeud cree
pour ce test a ete desactive ensuite via la vraie API — l'environnement
est rendu dans l'etat ou il a ete trouve.

## Bugs trouves et corriges

7 findings a l'inspection. Les **2 HIGH sont corriges** ; les 5 autres
restent documentes (fichier, ligne, scenario, correction proposee) dans
`docs/INSPECTION_ECC_PHASE_0_5.md`.

| # | Severite | Titre | Statut |
|---|---|---|---|
| **B1** | **HIGH** | Token d'acces jamais rafraichi cote client — **le bug signale** | **CORRIGE** `13895a3` |
| **B2** | **HIGH** | Upload presigne non borne + objets rejetes jamais supprimes | **CORRIGE** `e9cf329` (media ; voir limite) |
| B3 | MEDIUM | `User.status` (`DEACTIVATED`) defini mais applique par aucun guard | ouvert |
| B4 | MEDIUM | `trustProxy` non configure -> rate limiting par IP degenere derriere un proxy | ouvert |
| B5 | MEDIUM | MinIO absent des `services:` du workflow CI | ouvert |
| B6 | MEDIUM | Base de test `fixiyi_test` jamais purgee | ouvert |
| B7 | LOW | `finalize` ne verifie pas que le media appartient a la demande de l'URL | ouvert |

### B1 — le bug signale — CORRIGE

**Cause racine** : `apps/web` et `apps/admin` stockaient un `refreshToken`
et ne l'utilisaient **jamais** — aucun appel a `POST /api/v1/auth/refresh`
n'existait cote client. Passe `JWT_ACCESS_TTL` (15 min), chaque appel
authentifie prenait un 401 et la session morte restait en `localStorage`,
sans retour a `/login`.

**Correction** (`apps/web/src/lib/api-client.ts` et
`apps/admin/src/lib/api-client.ts`, comme demande) : sur un 401 d'une
requete authentifiee, `apiFetch` rafraichit une fois puis rejoue la
requete ; si le refresh echoue aussi, il vide la session et la garde
existante des pages renvoie vers `/login`.

Le point non evident : **une seule requete de refresh en vol**, partagee
par tous les appelants. Le refresh token tourne a chaque usage et
`SessionService` traite sa re-presentation comme un rejeu — il revoque
**toute la session**. `/requests/new` lance plusieurs appels au montage :
N refresh paralleles auraient donc deconnecte l'utilisateur plus surement
que le bug lui-meme. Et comme `/auth/refresh` ne renvoie que des tokens,
le store gagne un `setTokens` qui conserve l'utilisateur connecte.

**Preuve rouge -> vert** (`tests/browser/tests/session-refresh.spec.ts`) :
les 2 nouveaux scenarios ont ete executes **contre l'ancien client** (image
reconstruite sur le code d'avant correction) et echouent exactement sur le
symptome signale :

```
Expected: 0   Received: 1   <- "Invalid or expired access token" affiche
Expected pattern: /\/login$/
Received string:  "http://localhost:3000/requests/new"   <- utilisateur bloque
2 failed
```

puis passent contre le client corrige (un seul appel a `/auth/refresh`,
en `201`, et le token stocke a bien tourne). Un test qui passe ne prouve
rien s'il n'a jamais echoue sans la correction ; ceux-ci ont echoue.

Detail qui justifie ce controle : l'endpoint du catalogue est **public**.
Une assertion « l'ecran se remplit » seule aurait donc passe **aussi sur
l'ancien code**. Ce sont l'absence du message d'erreur et le compte des
appels a `/auth/refresh` qui detectent vraiment le bug — le run rouge
l'a montre.

Dette assumee : le correctif existe en deux exemplaires, conformement a
la demande. L'extraction dans un package partage reste recommandee
(Decision 51).

### B2 — upload — CORRIGE, avec une precision sur le diagnostic

La mission decrivait le bug comme « `createUploadSession` ne verifie pas
la taille declaree ». **Cette verification existait deja** depuis la
Phase 4 (`MEDIA_SIZE_LIMIT_EXCEEDED`) — un test la couvre desormais
explicitement. Le vrai trou etait que la declaration **n'engageait
rien** : l'URL presignee acceptait un PUT de n'importe quelle taille. Un
client declarait 1 Ko, passait le controle, puis envoyait des Go ; l'exces
n'etait vu qu'au `finalize`, apres stockage, et aucun `DeleteObject`
n'existait dans le depot — l'objet restait pour toujours.

**Correction** :
- La taille declaree est **signee dans l'URL presignee**. MinIO repond a
  un PUT de taille differente par **`403 SignatureDoesNotMatch`** et
  n'ecrit rien (verifie par `objectExists`).
- `reject()` **supprime l'objet**. Best-effort : un incident de stockage
  est journalise, pas transforme en 500 ; le document reste `REJECTED`.

Effet de bord revelateur : un test existant declarait `sizeBytes: 20` en
envoyant 26 octets. Sans consequence tant que la declaration ne liait
rien — elle lie desormais, donc le test a du dire la verite.

`request.e2e.test.ts` : 7 -> 9 tests. Le scenario navigateur
`create-request` (vrai PUT depuis Chrome) passe toujours : la correction
ne casse pas l'upload legitime.

**Limite — non corrigee, et c'est delibere** : signer `ContentLength`
impose une taille **exacte**, pas un plafond. Le pipeline media connait la
taille ; le pipeline **verification** non (son contrat
`RequestDocumentUploadInput` n'en porte pas), donc **ses uploads restent
non bornes**. Plafonner sans taille exacte demande une POST policy
(`content-length-range`), qui change l'upload de PUT en formulaire
multipart — un lot de travail distinct, documente dans le code et en
Decision 52 plutot que glisse en douce ici.

## Commits de cette session

| Hash | Message |
|---|---|
| `802301e` | chore: ECC integration documentation |
| `38841d4` | chore: ECC integration documentation (mandatory pre-phase reading) |
| `fc5367f` | chore: verify phase 0 audit |
| `06e50af` | chore: verify phase 1 foundation |
| `2e15c29` | chore: verify phase 2 auth |
| `14657ea` | chore: verify phase 3 marketplace |
| `117c913` | chore: verify phase 4 requests |
| `6abf1b3` | chore: verify phase 5 matching + reproduce frontend token bug |
| `6aa81b3` | docs: ECC inspection report phases 0-5 |
| `a3b23dd` | feat: design system unique + animations + icons + adaptation |
| `f7b7c2b` | chore: refresh Playwright screenshots against the redesigned UI |
| `6f4a2e9` | chore: pre-phase 6 validation |
| `420ef37` | docs: pre-phase 6 report |
| `13895a3` | **fix: refresh an expired access token instead of stranding the user** |
| `e9cf329` | **fix: bind media upload size in the presigned URL and delete rejected objects** |
| *(ce commit)* | chore: pre-phase 6 validation + docs: pre-phase 6 report (mise a jour) |

Decisions ajoutees : **47 a 52** (`docs/DECISIONS.md`). La mission
proposait « 47 ou 48 » pour le correctif token et « 49 » pour l'upload ;
47 a 50 etant deja pris par le design system, ce sont **51** et **52**.

## Verdict

**OK — les 2 HIGH sont corriges, prouves rouge -> vert, rien de bloquant.**

Les Phases 0 a 5 sont conformes a leurs rapports. Les deux defauts HIGH
trouves a l'inspection sont corriges, chacun avec des tests qui echouent
sans la correction et passent avec. Restent 5 findings MEDIUM/LOW, dont
aucun ne bloque la Phase 6, plus une limite explicite de B2 (uploads de
verification non bornes).

## Pret pour Phase 6

- [x] **Oui.**

La reserve formulee au tour precedent — « corriger B1 avant le chat » —
est levee : B1 est corrige et couvert par deux scenarios navigateur. La
connexion longue du chat temps reel partira d'une session qui sait se
renouveler.

## Recommandations pour la Phase 6

1. **Extraire `api-client.ts` et `auth-store.ts` dans un package
   partage.** Ils sont desormais identiques a deux commentaires pres *et*
   portent une logique non triviale (refresh serialise). Le chat
   ajoutera un troisieme consommateur — un client WebSocket authentifie —
   qui aura besoin de la meme logique de renouvellement. C'est le moment
   ou la duplication devient chere.
2. **Faire suivre le renouvellement a la connexion temps reel.** Une
   socket ouverte avec un token de 15 minutes doit se re-authentifier
   quand `apiFetch` fait tourner les tokens, sinon elle mourra au meme
   endroit que le bug B1.
3. **Borner les uploads de verification** (limite de B2) — et, puisque
   les pieces jointes du chat reutiliseront le pipeline media, s'assurer
   qu'elles passent bien par `MediaService` (donc avec taille signee) et
   non par un chemin parallele.
4. **Purger `fixiyi_test` entre les runs** (B6) avant d'y ajouter les
   collections de messages.
5. **Ajouter MinIO au workflow CI** (B5) : les deux nouveaux tests de B2
   parlent a un vrai MinIO et ne tourneraient pas en CI aujourd'hui.
6. B3, B4, B7 : a planifier, aucun ne concerne le chat directement.
