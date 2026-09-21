# INSPECTION ECC — FIXIYI PHASES 0-5

Date : 2026-09-21
Commit de depart : 6f2196c (fin Phase 5 + captures Playwright)

## Methode

Chaque phase a ete inspectee apres la **lecture obligatoire** definie dans
`docs/prompt/08_ECC_INTEGRATION.md` (06_SCOPE, 03_AGENT_PROTOCOL,
05_DECISION_POLICY, PROGRESS, DECISIONS, rapport de la phase precedente,
plan de la phase). L'inspection ne se contente pas de relire les rapports :
elle **re-execute** les commandes et **interroge les bases reelles**
(MongoDB, Redis, MinIO via la stack Docker) pour confronter les
affirmations des rapports aux donnees.

### Note sur les agents ECC

Le prompt de mission cite `/ecc:review`, `/ecc:security`, `/ecc:tdd` et
`/ecc:frontend`. **Ces noms n'existent pas** dans ECC v2.2.2 installe ici.
La surface reelle est :

| Nom cite dans la mission | Nom reel ECC v2.2.2 |
|---|---|
| `/ecc:review` | `/ecc:code-review`, agents `ecc:code-reviewer`, `ecc:typescript-reviewer` |
| `/ecc:security` | `/ecc:security-review`, `/ecc:security-scan`, agent `ecc:security-reviewer` |
| `/ecc:tdd` | `/ecc:tdd-workflow`, agent `ecc:tdd-guide` |
| `/ecc:frontend` | `/ecc:react-review`, agent `ecc:react-reviewer` |

Les noms reels ont ete utilises. `08_ECC_INTEGRATION.md` conserve la liste
telle que dictee par l'utilisateur (contenu impose mot pour mot) ; cette
table est la correspondance operationnelle.

---

## Phase 0 — Audit — **OK**

### Lecture effectuee
`docs/phases/PHASE_0_REPORT.md`, `docs/CURRENT_STATE.md`,
`docs/IMPLEMENTATION_PLAN.md`.

### Verifications

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| `docs/phases/PHASE_0_REPORT.md` existe | oui | oui, 5876 octets | OK |
| Rapport complet au format 03_AGENT_PROTOCOL §4 | 13 sections | 13 sections `##` presentes (Statut, Dates, Objectifs, Ce qui a ete fait, Fichiers crees, Fichiers modifies, Tests, Commandes, Decisions, Problemes, Limitations, Prerequis, Prochaine phase) | OK |
| `docs/CURRENT_STATE.md` decrit l'etat initial | oui | oui : workspace meta-initialise sans code, environnement detecte (Node 22.20.0, pnpm 12.4.2, Docker 28.4.0), 3 services dev verifies, inventaire KEEP/REFACTOR/REPLACE/REMOVE complet | OK |
| `docs/IMPLEMENTATION_PLAN.md` liste les phases a venir | Phases 1-8 | Phases 1 a 8 presentes, chacune avec objectifs/livrables/criteres de sortie, plus « Principes transverses » et « Apres le MVP » | OK |

### Observations

- Le rapport Phase 0 documente une verification **active** des services
  (ping Mongo, ping Redis, healthcheck MinIO) et pas seulement une
  declaration — coherent avec l'interdiction de « mock presente comme
  reel » (03_AGENT_PROTOCOL §2).
- Aucune contradiction entre `CURRENT_STATE.md` et l'etat git de l'epoque
  (1 commit `64eb81e`, 17 fichiers meta).

**Verdict Phase 0 : OK — aucun ecart.**

---

## Phase 1 — Foundation — **OK**

### Lecture effectuee
`docs/phases/PHASE_0_REPORT.md`, `docs/phases/PHASE_1_PLAN.md`,
`docs/phases/PHASE_1_REPORT.md`, `docs/PROGRESS.md`,
`docs/DECISIONS.md` (Decisions 1 a 15).

### Verifications structurelles

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| Monorepo pnpm + Turborepo | oui | `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `tests/*`) + `turbo.json` (build/lint/typecheck/test/dev/clean, `dependsOn: ^build`) | OK |
| 8 packages | tsconfig, eslint-config, shared-utils, contracts, config, design-tokens, i18n, ui | les 8 presents, tous sous le scope `@fixiyi/*` | OK |
| 4 apps | api, worker, web, admin | `@fixiyi/api`, `@fixiyi/worker`, `@fixiyi/web`, `@fixiyi/admin` | OK |
| Docker 7 services | 7 | 3 infra (`mongodb`, `redis`, `minio` dans `docker-compose.yml`) + 4 applicatifs (`api`, `worker`, `web`, `admin` dans `docker-compose.dev.yml`) = **7** | OK |
| CI GitHub Actions | oui | `.github/workflows/ci.yml` : install -> lint -> typecheck -> test -> build, avec services `mongo:7` et `redis:7-alpine` | OK |

### Tests re-executes (pas repris du rapport)

```
pnpm --filter @fixiyi/shared-utils test ->  4 fichiers,  27 tests, 27 passed
pnpm --filter @fixiyi/contracts   test -> 14 fichiers,  69 tests, 69 passed
pnpm --filter @fixiyi/ui          test ->  9 fichiers,  52 tests, 52 passed
```

Total des trois : **148 tests verts**. Avec `config` (11), `i18n` (3) et
`design-tokens` (3), la couche packages compte **165 tests**, tres au-dessus
du critere « 48+ » du plan de Phase 1.

### Observations

- **[MEDIUM] MinIO absent du CI.** `.github/workflows/ci.yml` declare
  `mongodb` et `redis` en `services:` mais **pas MinIO**, alors que le
  pipeline media (Phase 3/4) parle a un S3 reel. Tout test d'integration
  media qui s'appuie sur MinIO ne peut donc pas s'executer de la meme
  facon en CI qu'en local. A trancher en Phase 6 : soit ajouter le service
  MinIO au workflow, soit documenter explicitement que ces tests sont
  locaux uniquement. Ce n'est pas une regression de la Phase 1 — c'est une
  dette introduite quand le pipeline media est arrive en Phase 3.
- `turbo.json` fait dependre `lint`, `typecheck` et `test` de `^build` :
  les packages sont donc toujours construits avant d'etre consommes, ce
  qui evite la classe de faux verts ou un test passe contre un `dist/`
  perime.

**Verdict Phase 1 : OK — 1 observation MEDIUM (MinIO/CI), aucune regression.**

---

## Phase 2 — Auth — **OK**

### Lecture effectuee
`docs/phases/PHASE_1_REPORT.md`, `docs/phases/PHASE_2_PLAN.md`,
`docs/phases/PHASE_2_REPORT.md`, `docs/VERIFICATION_PHASE_1_2.md`,
`docs/DECISIONS.md` (Decisions 16 a 25).

### Verifications structurelles

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| Module auth | 38 fichiers | **38 fichiers exactement** dans `apps/api/src/auth/` | OK |
| OTP phone + email | oui | `otp/otp.service.ts`, `sms/` (interface + provider dev), `email/` (interface + provider dev), `verification-code.ts` | OK |
| Sessions + refresh rotation | oui | `session/session.service.ts`, `token/token.service.ts`, `schemas/user-session.schema.ts`, route `POST /api/v1/auth/refresh` | OK |
| Devices | oui | `schemas/device.schema.ts` | OK |
| RBAC | oui | `guards/roles.guard.ts` + `roles.decorator.ts` (+ `resource-owner.guard.ts`) | OK |
| CSRF | oui | `csrf/csrf.guard.ts` + `csrf/csrf.service.ts` | OK |
| Rate limiting | oui | `rate-limit/` (guard + service + decorateur), applique jusque sur `POST /auth/refresh` (60/h) | OK |

### Tests re-executes

```
pnpm --filter @fixiyi/api test -> 23 fichiers, 153 tests, 153 passed (191.95 s)
```

> Precision d'exactitude : les 153 tests sont le total de `apps/api`
> (auth + catalog + providers + companies + verification + media +
> requests + matching + geo + configuration + common), **pas** 153 tests
> d'auth seuls. Le critere « Tests api auth : 153+ » du prompt de mission
> confond le total applicatif avec le sous-total auth. Le chiffre est
> atteint, mais il ne veut pas dire ce que le libelle suggere.

Note : la sortie du run contient un `Error: connection string contains a
password` **attendu** — c'est le test de `problem-details.filter` qui
verifie justement que ce type de message est capte et assaini ; le test
passe.

### Verification MongoDB reelle (base `fixiyi`)

```
users:         25 documents
user_sessions: 32 documents
devices:       32 documents
```

Index `user_sessions` :

```
{"key":{"_id":1}}
{"key":{"userId":1}}
{"key":{"expiresAt":1},"expireAfterSeconds":0}   <- TTL confirme
```

Le TTL sur `expiresAt` existe bien et est un **vrai index TTL**
(`expireAfterSeconds: 0`, donc expiration a la date portee par le
document) — conforme a la Decision 24.

Bonus verifie au passage, index `devices` :

```
{"key":{"lastSeenAt":1},"expireAfterSeconds":7776000}   <- 90 jours
```

7 776 000 s = exactement 90 jours — conforme a la Decision 25.

### Observations

- `AuthGuard` (apps/api/src/auth/guards/auth.guard.ts) **re-verifie la
  session en base a chaque appel** en plus de verifier la signature JWT.
  C'est ce qui rend le logout distant reellement effectif au lieu de
  laisser un token revoque vivre jusqu'a son expiration naturelle. Le
  cout (1 lecture Mongo par requete authentifiee) est assume et
  documente.
- Le guard distingue deux messages d'erreur differents — `"Invalid or
  expired access token"` (echec de verification JWT) et `"Session has been
  revoked or expired"` (session absente/revoquee en base). Cette
  distinction est **la cle du diagnostic du bug frontend** (voir Phase 5).

**Verdict Phase 2 : OK — aucun ecart structurel, TTL confirmes par la base.**

---

## Phase 3 — Marketplace — **OK**

### Lecture effectuee
`docs/phases/PHASE_2_REPORT.md`, `docs/phases/PHASE_3_PLAN.md`,
`docs/phases/PHASE_3_REPORT.md`, `docs/DECISIONS.md` (Decisions 26 a 34).

### Verifications structurelles

| Module | Attendu | Constate | Verdict |
|---|---|---|---|
| `apps/api/src/catalog/` | 5 fichiers | **5** | OK |
| `apps/api/src/providers/` | 4 fichiers | **4** | OK |
| `apps/api/src/companies/` | 5 fichiers | **5** | OK |
| `apps/api/src/verification/` | 6 fichiers | **6** | OK |
| `apps/api/src/media/` | 6 fichiers | **6** | OK |
| Back-office admin | oui | `apps/admin` : `login/page.tsx`, `catalog/page.tsx`, store/client d'auth | OK |

Les six comptes correspondent **exactement** a ce qu'annonce le rapport de
Phase 3 — aucun fichier fantome, aucun fichier manquant.

### Verification MongoDB reelle (base `fixiyi`)

```
catalog_nodes:      25 documents
provider_profiles:   4 documents
```

Index `provider_profiles` :

```
{"key":{"_id":1}}
{"key":{"userId":1},"unique":true}
{"key":{"serviceAreas.center":"2dsphere"}}   <- 2dsphere confirme
{"key":{"availabilityStatus":1}}
```

L'index **2dsphere** demande est bien present, sur
`serviceAreas.center` — c'est-a-dire sur le centre de zone de service, ce
qui est le bon champ pour la requete de proximite du matching (et non sur
une position ponctuelle du fournisseur).

Index `catalog_nodes` : `{level, parentId, name}` **unique** — c'est cet
index qui rend impossible deux noeuds homonymes sous le meme parent au
meme niveau, et c'est lui qui a fait surface la race condition du seed
(Decision 31). La contrainte est donc reellement portee par la base, pas
seulement par le code applicatif.

### Verification de l'execution reelle (base `fixiyi_test`)

La base de dev `fixiyi` affiche `companies: 0` et `verification_cases: 0`,
ce qui pourrait laisser croire que ces modules n'ont jamais tourne. **Ce
n'est pas le cas** : les tests e2e ecrivent dans `fixiyi_test`
(`.env.test.example` -> `DATABASE_URL=.../fixiyi_test`), ou l'on trouve :

```
companies:               66      company_members:         88
verification_cases:      11      verification_documents:  11
verification_decisions:  11      provider_profiles:      214
catalog_nodes:          313      media:                   18
```

Les flux entreprise et verification ont donc bien ete exerces contre une
vraie base, avec de vrais documents — la Decision 29 (« upload MinIO
reel ») est corroboree par 11 `verification_documents` reellement ecrits.

### Observations

- **[MEDIUM] La base de test n'est pas purgee entre les runs.**
  `fixiyi_test` accumule (819 `users`, 852 `user_sessions`, 852
  `devices`). Les suites restent vertes aujourd'hui parce qu'elles se
  scopent sur leurs propres identifiants, mais c'est exactement le terrain
  qui a produit le bug de la Phase 5 ou « les fournisseurs globaux d'un
  test e2e remplissaient le batch du test suivant » (Decision 46). Le
  risque de flakiness croit avec le volume accumule. A traiter avant que
  la Phase 6 (chat) n'ajoute ses propres collections.
- Rappel de la Phase 1 : MinIO n'est pas un `service:` du workflow CI, donc
  la partie du pipeline verification/media qui parle a S3 ne peut pas
  s'executer en CI comme en local.

**Verdict Phase 3 : OK — 1 observation MEDIUM (hygiene de la base de test).**

---

## Phase 4 — Requests — **OK**

### Lecture effectuee
`docs/phases/PHASE_3_REPORT.md`, `docs/phases/PHASE_4_PLAN.md`,
`docs/phases/PHASE_4_REPORT.md`, `docs/DECISIONS.md` (Decisions 35 a 39).

### Verifications structurelles

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| `apps/api/src/requests/` | 4 fichiers | **4** | OK |
| Pipeline media — magic bytes | oui | `media/media-signature.ts` + `media-signature.test.ts` (JPEG, PNG, WEBP, WEBM/EBML, WAV, OGG testes sur de vraies signatures) | OK |
| Pipeline media — HeadObject | oui | `infrastructure/storage/storage.service.ts:69` `headObject()` reel, consomme par `media.service.ts:90` | OK |
| `apps/web` login + new request | oui | `app/login/page.tsx`, `app/requests/new/page.tsx` | OK |
| Tests Playwright | 2 scenarios | **2 scenarios, 2 passed** | OK |

### Les trois bugs de la Phase 4 : corrections verifiees dans le code

| Bug (Decision 39) | Correction attendue | Verifie |
|---|---|---|
| `Content-Type: application/json` envoye sans corps | n'ajouter l'en-tete que s'il y a un corps | `apps/web/src/lib/api-client.ts:24` **et** `apps/admin/src/lib/api-client.ts:24` — corrige dans les **deux** apps | OK |
| Preflight CORS sans PATCH/DELETE | methodes explicites | `apps/api/src/main.ts:26` : `enableCors({ methods: ["GET","HEAD","POST","PATCH","PUT","DELETE"] })` | OK |
| URL presignee signee sur `http://minio:9000` | endpoint public separe | `STORAGE_PUBLIC_ENDPOINT` dans `env-schema.ts:44`, second client de signature `storage.service.ts:39`, `docker-compose.dev.yml:17` -> `http://localhost:9000` | OK |

Les trois corrections sont **presentes dans le code source courant**, pas
seulement racontees dans le rapport.

### Test navigateur reel re-execute

```
cd tests/browser && pnpm exec playwright test

Running 2 tests using 1 worker
  ok 1 [chromium] client logs in with OTP and creates a service request
       with a real photo upload (3.9s)
  ok 2 [chromium] a dispatched provider sees the client's request,
       approximated, and can decline it (5.5s)
  2 passed (13.6s)
```

### Verification MongoDB reelle — avant / apres le run

C'est la preuve que le scenario navigateur ecrit vraiment en base et ne
simule rien :

| Collection | Avant le run | Apres le run |
|---|---|---|
| `service_requests` | 14 | **16** |
| `media` | 6 | **7** |
| `matches` | 4 | **5** |
| `match_candidates` | 11 | **14** |
| `dispatch_batches` | 6 | **7** |

Index `media` : `{ownerUserId}`, `{targetId}` — les deux axes de lecture
reels (« mes medias », « les medias de cette demande »).
Index `service_requests` : `{clientUserId}` et **`{location.point: "2dsphere"}`**.

Document media reellement ecrit par le run Playwright :

```json
{
  "kind": "IMAGE", "status": "READY", "contentType": "image/png",
  "objectKey": "media/request/01a0c18c-.../01a0c18c-...-photo.png",
  "declaredSizeBytes": 45, "actualSizeBytes": 45,
  "width": 1, "height": 1, "rejectionReason": null
}
```

Point notable : le schema separe **`declaredSizeBytes`** (ce que le client
annonce) de **`actualSizeBytes`** (ce que `HeadObject` constate reellement
sur l'objet MinIO), et extrait les vraies dimensions. La taille annoncee
par le client n'est donc jamais prise pour argent comptant — c'est
exactement ce que la Phase 4 promettait, et la donnee le confirme.

**Verdict Phase 4 : OK — les 3 bugs sont corriges dans le code, le
scenario navigateur passe et ecrit de vraies donnees.**

---

## Phase 5 — Matching — **OK avec reserves** (bug frontend confirme)

### Lecture effectuee
`docs/phases/PHASE_4_REPORT.md`, `docs/phases/PHASE_5_REPORT.md`,
`docs/DECISIONS.md` (Decisions 40 a 46), `docs/prompt/06_SCOPE.md`
(perimetre Phase 5).

### Verifications structurelles

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| `apps/api/src/matching/` | 12 fichiers | **12** | OK |
| `apps/api/src/configuration/` | 5 fichiers | **5** | OK |
| `apps/api/src/geo/` | 5 fichiers | **5** | OK |
| `@fixiyi/ui` | 8 composants, 52 tests | **8 composants**, **52 tests passes** | OK |
| Tests matching (ranking) | 19 | `ranking.test.ts` -> **19 tests passes** | OK |

### Gates du monorepo re-executes

```
pnpm lint       -> 15 taches / 15, 0 erreur
pnpm typecheck  -> 15 taches / 15, 0 erreur
pnpm test       -> 13 taches / 13, 55 fichiers, 320 tests, 0 echec
pnpm build      -> 10 taches / 10, succes
```

Repartition reelle des 320 tests : api 153, contracts 69, ui 52,
shared-utils 27, config 11, i18n 3, design-tokens 3, worker 2.

### Verification MongoDB reelle — le dispatch progressif est-il vraiment borne ?

C'est la promesse centrale de la phase, donc elle est verifiee sur la
donnee et non sur le rapport. Configuration reellement en base :

```json
{"_id":"system","matching":{"weights":{"distance":0.4,"availability":0.2,
 "verificationLevel":0.2,"experience":0.1,"exploration":0.1,
 "reputation":0,"reliability":0,"history":0,"currentLoad":0},
 "defaultRadiusKm":10,"maxRadiusKm":50,"radiusExpansionStepKm":10,
 "batchSize":3,"batchWaitSeconds":120,"urgentBatchSize":5,
 "urgentBatchWaitSeconds":45,"explorationSlotsPerBatch":1,
 "maxBatchesPerMatch":5,"candidateExpirySeconds":900}, ...}
```

Les quatre signaux sans donnees reelles (`reputation`, `reliability`,
`history`, `currentLoad`) sont bien a **0** — la Decision 40 (« jamais de
valeur inventee ») est tenue par la donnee.

Candidats par match, confrontes a `batchSize: 3` :

```
match ...e8100c42 -> 4 candidats, vagues [0,1]
match ...408b9f803 -> 3 candidats, vague  [0]
match ...737eef41 -> 2 candidats, vague  [0]
match ...01b6e62d -> 2 candidats, vagues [0,1]
```

**Aucune vague ne depasse 3 candidats.** Le seul match a 4 candidats les
repartit sur 2 vagues. Le batch est donc reellement borne en base, pas
seulement dans l'intention du code.

Siege d'exploration visible dans les scores reels : `0.78` contre `0.68`
pour des fournisseurs par ailleurs identiques — le bonus d'exploration
(`explorationSlotsPerBatch: 1`) produit un effet mesurable.

Les 4 matches sont `EXHAUSTED` a `currentRadiusKm: 50`, soit exactement
`maxRadiusKm` : l'expansion de rayon va bien jusqu'a son plafond puis
s'arrete au lieu de boucler.

### Verification Redis reelle

```
docker exec fixiyi-redis redis-cli --scan --pattern "bull:matching:*"
  bull:matching:id
  bull:matching:events
  bull:matching:meta          (db0 — stack de dev)
  39 cles                     (db1 — base des tests e2e)
```

La queue BullMQ `matching` existe reellement dans les deux
environnements — conforme a la Decision 43.

---

## BUG FRONTEND — « Invalid or expired access token » — **CONFIRME, reproduit**

### Reproduction

Reproduit de facon **deterministe** via un harnais Playwright temporaire
contre la vraie stack Docker (supprime apres la mesure ; capture d'ecran
conservee : `docs/evidence/bug-expired-token-repro.png`) :

```
REPRO: refreshToken persisted in localStorage = true
REPRO: calls to /auth/refresh                 = 0
REPRO: dead session still in localStorage     = true
  ok 1 REPRO: an expired access token is never refreshed and never recovered
```

Scenario : login OTP reel -> session valide -> l'`accessToken` persiste
est remplace par un token expire (effet identique a l'attente naturelle de
`JWT_ACCESS_TTL`) -> rechargement de `/requests/new`.

### Cause racine

Ce n'est **pas** un bug d'hydratation (celui-la a ete corrige en Phase 5,
Decision 46, et `useAuthHydrated()` fait correctement son travail). C'est
une **fonctionnalite absente** :

1. `JWT_ACCESS_TTL = 15m`, `JWT_REFRESH_TTL = 30d`
   (`packages/config/src/env-schema.ts:28-29`, `.env:24-25`).
2. `apps/web` et `apps/admin` persistent `accessToken` **et**
   `refreshToken` dans `localStorage` via `zustand/persist`
   (`apps/web/src/lib/auth-store.ts`, cle `fixiyi-web-auth`).
3. `apiFetch` attache `Authorization: Bearer <accessToken>`
   (`apps/web/src/lib/api-client.ts:26-31`) — mais **aucune ligne de
   `apps/web` ni de `apps/admin` n'appelle jamais
   `POST /api/v1/auth/refresh`**. Le `refreshToken` est ecrit dans le
   store et **jamais relu** (verifie par grep : uniquement des
   declarations de type et l'ecriture au login).
4. L'endpoint existe pourtant cote API, complet et rate-limite
   (`apps/api/src/auth/auth.controller.ts:69`, 60 appels/h).
5. Passe 15 minutes, chaque appel `auth: true` prend donc un 401. Le
   message vient de `AuthGuard`
   (`apps/api/src/auth/guards/auth.guard.ts:39` — branche « verification
   JWT echouee », a distinguer de `"Session has been revoked or
   expired"`).
6. Sur `/requests/new` c'est immediat et visible, parce que
   `initializeDraft()` appelle `GET /api/v1/requests/mine` des le montage.
7. **Aucune recuperation** : `apiFetch` leve une `ApiError`, la page
   affiche le message, la session morte **reste dans `localStorage`
   indefiniment** et l'utilisateur n'est meme pas renvoye vers `/login`.
   Il est bloque sur un ecran inutilisable jusqu'a vidage manuel du
   navigateur.

### Correction proposee (NON APPLIQUEE — hors perimetre d'une inspection)

Dans `apiFetch` : sur un 401 pour une requete `auth: true`, tenter **une
fois** `POST /api/v1/auth/refresh` avec le `refreshToken` stocke, ranger
le couple rote via `setSession`, rejouer la requete d'origine ; si le
refresh echoue a son tour, `clearSession()` puis redirection vers
`/login`.

Deux precautions indispensables :

- **Serialiser les refresh concurrents** derriere une seule promesse en
  vol : `/requests/new` declenche plusieurs appels authentifies
  simultanes, et N refresh paralleles sur un token rotatif
  declencheraient la detection de rejeu (`REUSE_DETECTED`,
  `session.service.ts`) — qui revoque toute la session. Le remede naif
  serait donc pire que le mal.
- **Ne pas dupliquer le correctif** : `apps/web/src/lib/api-client.ts` et
  `apps/admin/src/lib/api-client.ts` sont aujourd'hui identiques au
  caractere pres. Le corriger deux fois recreerait exactement la
  divergence que la Decision 39 a deja fait payer une fois. La forme
  juste est d'extraire le client dans un package partage.

---

## Findings de securite (agent ECC `ecc:security-reviewer`, re-verifies a la main)

Chaque finding ci-dessous a ete **re-verifie dans le code** avant d'etre
retenu ; les items non confirmes ne figurent pas dans cette liste.

| # | Severite | Fichier | Defaut |
|---|---|---|---|
| S1 | **HIGH** | `infrastructure/storage/storage.service.ts:57-61`, `media/media.service.ts`, `requests/request.controller.ts` | Upload presigne non borne + aucun nettoyage |
| S2 | MEDIUM | `auth/schemas/user.schema.ts:37` | `User.status` defini mais jamais applique |
| S3 | MEDIUM | `main.ts:16`, `auth/rate-limit/rate-limit.guard.ts:25` | `trustProxy` non configure |
| S4 | LOW | `requests/request.service.ts:113`, `media/media.service.ts:142` | `finalize` ne verifie pas que le media appartient a CETTE demande |
| S5 | LOW | `auth/auth.service.ts:218` | Oracle d'inscription sur `POST /auth/email` |

**S1 (HIGH)** — re-verifie point par point :
- `createPresignedUploadUrl` ne pose que `Bucket`/`Key`/`ContentType` :
  **ni `ContentLength`, ni condition de taille**. L'URL presignee accepte
  donc un PUT de n'importe quelle taille.
- `grep -rn "DeleteObject" apps packages` -> **aucun resultat**. Un objet
  rejete (trop gros, mauvaise signature) reste dans MinIO **pour
  toujours**.
- `request.controller.ts` n'a **aucun** `@RateLimit` sur ses 9 routes, y
  compris `POST /requests` et `POST /:id/media`.

Scenario : un client authentifie ouvre une session d'upload en declarant
1 Ko, PUT un fichier de plusieurs Go sur l'URL presignee (rien ne borne la
taille au PUT), puis finalise. Le document media passe `REJECTED` — mais
l'objet de plusieurs Go reste dans le bucket. Sans rate limit, l'operation
est repetable a volonte : saturation du stockage par un seul compte.

**S2 (MEDIUM)** re-verifie : `user.status` n'est lu qu'en
`auth.service.ts:311`, pour le projeter dans la reponse. Aucun guard ne le
consulte. Dormant aujourd'hui (aucun endpoint ne desactive un compte),
mais le jour ou un compte passe `DEACTIVATED`, ses sessions continuent de
vivre et son refresh token continue de tourner.

**S4 (LOW)** re-verifie : `requestService.finalizeMedia` verifie que la
demande est editable et possedee, puis `mediaService.finalize` ->
`requireOwned` ne verifie que `ownerUserId`. **Personne ne verifie que
`media.targetId === id`.** Borne au meme utilisateur (pas d'IDOR
inter-comptes), donc integrite de donnees plutot que faille
d'autorisation.

### Points juges sains par l'audit (et confirmes)

OTP (HMAC-SHA256, jamais de code en clair, `timingSafeEqual`, 5 tentatives
par sujet), rotation/rejeu du refresh token (`REUSE_DETECTED` revoque la
session entiere), CSRF double-submit, **non-confiance au `Content-Type`
client** (la decision accepter/rejeter vient des vrais magic bytes),
absence de secret en dur, absence d'injection Mongo et de traversee de
chemin sur les cles d'objet.

**Verdict Phase 5 : OK sur le perimetre livre (dispatch borne, expansion,
ponderations, geo — tous confirmes par la donnee reelle). Deux reserves
hors perimetre Phase 5 : le bug frontend de rafraichissement de token
(HIGH, reproduit) et le finding S1 (HIGH, upload non borne).**
