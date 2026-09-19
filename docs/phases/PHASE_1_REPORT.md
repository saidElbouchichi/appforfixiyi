# PHASE 1 - FOUNDATION

## Statut

**PAUSE (~55% completee)** — arret volontaire pour limite de tokens, pas
un blocage technique. Tout ce qui est marque TERMINE ci-dessous est
reellement construit, teste (build gates + smoke tests manuels), et
fonctionnel.

## Date debut / pause

Debut : 2026-09-19 (immediatement apres reception de "GO PHASE 1")
Pause : 2026-09-19 23:29 UTC

## Objectifs (statut par objectif)

- ✅ Fichiers racine du monorepo (`package.json`, `pnpm-workspace.yaml`,
  `turbo.json`, `.editorconfig`, `.nvmrc`, prettier config)
- ✅ `packages/tsconfig` (configs TypeScript strict partagees)
- ✅ `packages/eslint-config` (ESLint/Prettier partages, flat config)
- ✅ `packages/shared-utils` (UUIDv7, money, time — testes)
- ✅ `packages/contracts` (schemas Zod Offer/WalletTransaction/DomainEvent
  + primitives communes — testes)
- ✅ `packages/config` (chargement/validation Zod de l'environnement,
  recherche du `.env` vers le haut du monorepo — teste)
- ✅ `packages/design-tokens` (tokens de base reels — testes)
- ✅ `packages/i18n` (structure de ressources fr/en/ar/ary + loader —
  teste)
- ✅ `apps/api` (NestJS + Fastify, Mongo + Redis reels, health check reel,
  OpenAPI, pipe de validation Zod, filtre Problem Details) — build gates
  verts + smoke test manuel reussi
- ✅ `apps/worker` (BullMQ + Redis reels, arret propre) — build gates
  verts + smoke test manuel reussi
- ⏳ `apps/web` (Next.js minimal) — **PAS COMMENCE**
- ⏳ `apps/admin` (Next.js minimal) — **PAS COMMENCE**
- ⏳ Dockerfile par app + `docker-compose.dev.yml` — **PAS COMMENCE**
- ⏳ `.github/workflows/ci.yml` — **PAS COMMENCE**
- ⏳ Mise a jour de `README.md` — **PAS COMMENCE**

## Ce qui a ete fait

### 1. Socle monorepo

`pnpm` + `Turborepo` configures a la racine. `turbo.json` definit les
taches `build`/`lint`/`typecheck`/`test`/`dev`/`clean` avec dependances
inter-packages (`dependsOn: ["^build"]`). `pnpm-workspace.yaml` inclut
`apps/*` et `packages/*`, et porte la configuration de securite
supply-chain de pnpm (`allowBuilds`, voir Decision 11).

### 2. Packages partages (7 packages, tous avec build gates verts)

- **`@fixiyi/tsconfig`** : 4 presets (`base.json` strict TS,
  `nestjs.json`, `nextjs.json`, `react-library.json`).
- **`@fixiyi/eslint-config`** : flat config ESLint 10 + typescript-eslint
  8 (`strictTypeChecked` + `stylisticTypeChecked`), `eslint-plugin-import-x`
  avec resolveur TypeScript reel (`eslint-import-resolver-typescript`),
  regle `no-explicit-any: error` (03_AGENT_PROTOCOL.md), 3 presets
  (`base`, `node`, `react`).
- **`@fixiyi/shared-utils`** : `generateId()`/`isValidUuidV7()` (UUIDv7
  via le package `uuid`), `Money` (integer minor units — creation,
  addition, soustraction, multiplication arrondie, formatage
  multi-devise via `Intl.NumberFormat`), helpers de temps UTC. 17 tests.
- **`@fixiyi/contracts`** : schemas Zod `Offer`, `WalletTransaction`,
  `DomainEvent`, primitives `Id`/`Currency`/`IsoDateTime`/`Money`/
  `ProblemDetails`/`BaseEntity`. 11 tests.
- **`@fixiyi/config`** : `EnvSchema` (validation complete de toutes les
  variables de `.env.example`), `loadEnv()` (charge dotenv + valide,
  erreur lisible champ par champ), `findNearestEnvFile()` (recherche du
  `.env` en remontant l'arborescence jusqu'a la racine du monorepo). 14
  tests (dont 4 pour `findNearestEnvFile` avec de vrais dossiers
  temporaires).
- **`@fixiyi/design-tokens`** : couleurs (primary/neutral/semantic),
  spacing, radius, typography, shadows, breakpoints, z-index, motion —
  en TS ET en CSS custom properties (`tokens.css`, pour Tailwind v4).
  3 tests.
- **`@fixiyi/i18n`** : `fr`/`en`/`ar`/`ary` (4 langues de
  01_SPEC_PRODUCT.md #5), metadonnees RTL/LTR, loader avec fallback vers
  la langue par defaut. 3 tests. Note : traductions `ary` (darija) sont
  un premier jet a faire relire par un locuteur natif avant production
  (documente en commentaire dans le code).

### 3. `apps/api` — NestJS + Fastify

- `main.ts` : charge l'env (`loadEnv()`) AVANT tout le reste, prefixe
  global `/api/v1` (sauf `/health`), filtre d'exception global, CORS,
  Swagger (`DocumentBuilder` + `SwaggerModule.setup("api/docs", ...)`).
- `AppModule` : module dynamique `forRoot(env)` (voir Decision 7).
- `EnvModule` (`@Global()`) : rend l'`Env` deja valide injectable partout
  via le token `ENV`.
- `DatabaseModule` : `MongooseModule.forRootAsync` branche sur `ENV`.
- `RedisModule`/`RedisService` : client `ioredis` injectable, `ping()`
  reel, `onModuleDestroy` ferme la connexion proprement.
- `HealthModule` : `GET /health` verifie ACTIVEMENT Mongo
  (`admin().command({ping:1})`) et Redis (`PING`), retourne 200 si les
  deux sont up, 503 sinon, avec le detail par dependance.
- `ProblemDetailsFilter` : convertit toute exception (NestJS
  `HttpException`, `DomainHttpException` avec code explicite, erreur
  generique) au format Problem Details (02_SPEC_ENGINEERING.md #62), ne
  fuite jamais un message d'erreur interne, genere/propage un `traceId`.
- `DomainHttpException` : base prete pour les erreurs metier typees des
  phases suivantes.
- `ZodValidationPipe` : pret a l'emploi, pas encore branche sur une route
  (aucun DTO metier en Phase 1).

### 4. `apps/worker` — BullMQ

- `main.ts` : charge l'env, cree la connexion Redis (`maxRetriesPerRequest:
  null` requis par BullMQ), demarre le worker "system", gere
  SIGTERM/SIGINT proprement (ferme le worker puis la connexion).
- Queue de diagnostic `system` / job `ping` : PAS une queue metier
  (aucune n'existe encore), sert a prouver que tout le pipeline
  BullMQ+Redis fonctionne (voir Decision 9). Testee de bout en bout avec
  un vrai `Queue.add()` + `QueueEvents` + attente de completion reelle
  via Redis.

## Fichiers crees / modifies

Liste complete et exhaustive dans `docs/PROGRESS.md` (sections "Liste
COMPLETE des fichiers crees" et "... modifies"). Resume : **~100 fichiers
crees**, 1 fichier modifie (`.env.test.example`, complete pour matcher
`EnvSchema`), plus les 2 fichiers de suivi (`docs/PROGRESS.md`,
`docs/DECISIONS.md`).

## Tests

| Niveau | Ou | Resultat |
|---|---|---|
| Unit | `packages/shared-utils` | 17 tests OK |
| Unit | `packages/contracts` | 11 tests OK |
| Unit + integration (dossiers temp reels) | `packages/config` | 14 tests OK |
| Unit | `packages/design-tokens` | 3 tests OK |
| Unit | `packages/i18n` | 3 tests OK |
| Unit + **integration reelle** (Mongo+Redis Docker) | `apps/api` | 13 tests OK |
| **Integration reelle** (Redis Docker, BullMQ bout-en-bout) | `apps/worker` | 2 tests OK |
| **Smoke test manuel** (process reel demarre) | `apps/api` | `GET /health` -> 200 ok, `GET /api/v1/health` -> 404, `GET /api/docs` -> 200, erreur 404 -> Problem Details correct |
| **Smoke test manuel** (process reel demarre) | `apps/worker` | demarre, log `[worker] ready`, connexion Redis confirmee |

**Total automatise : 63 tests, tous passent.** Build (`tsc`/`nest
build`/`tsup`) et lint (ESLint, 0 erreur/0 warning) verts sur les 9
packages/apps existants.

## Commandes lancees et resultats (extraits verifies)

```
$ pnpm --filter @fixiyi/api typecheck
$ tsc --noEmit -p tsconfig.json
(aucune sortie = succes)

$ pnpm --filter @fixiyi/api lint
$ eslint .
(aucune sortie = succes)

$ pnpm --filter @fixiyi/api test
...
 Test Files  4 passed (4)
      Tests  13 passed (13)

$ pnpm --filter @fixiyi/api build
$ nest build
(succes)

$ node dist/main.js   (avec .env reel copie de .env.example)
[Nest] Starting Nest application...
[Nest] AppModule / EnvModule / DatabaseModule / MongooseModule /
       RedisModule / MongooseCoreModule / HealthModule dependencies initialized
[Nest] HealthController {/api/v1/health}
[Nest] Mapped {/health, GET} route
[Nest] Nest application successfully started

$ curl http://localhost:4000/health
{"status":"ok","checks":{"mongo":{"status":"up"},"redis":{"status":"up"}}}
HTTP 200

$ curl http://localhost:4000/api/v1/does-not-exist
{"type":"https://fixiyi.app/errors/not-found","title":"Cannot GET /api/v1/does-not-exist","status":404,"code":"NOT_FOUND","traceId":"01a0bbf5-93d1-74ed-80ad-63b50981d4f7"}
HTTP 404

$ pnpm --filter @fixiyi/worker test
...
 Test Files  1 passed (1)
      Tests  2 passed (2)

$ pnpm --filter @fixiyi/worker build
$ tsup src/main.ts --format esm --clean
ESM dist\main.js 1.66 KB
⚡️ Build success

$ node dist/main.js
[worker] ready (env=development)
```

## Decisions prises

Voir `docs/DECISIONS.md`, Decisions 4 a 12 :

4. TypeScript epingle en 6.0.3 (pas 7.x — incompatibilite peer avec
   `typescript-eslint`).
5. `tsup` pour builder les packages partages (dual ESM+CJS).
6. Pas de `nestjs-zod` (peer casse avec NestJS 12) — pipe Zod maison.
7. Retrait de `@nestjs/config` — chargement d'env maison via `EnvModule`.
8. `findNearestEnvFile` — recherche du `.env` vers le haut du monorepo.
9. Queue de diagnostic `system/ping` dans `apps/worker` (pas de fausse
   queue metier).
10. Extensions `.mjs`/`.mts` pour les fichiers de config ESM dans les
    apps CommonJS.
11. `allowBuilds` pnpm : deny `@scarf/scarf` (telemetrie pure), allow le
    reste (fonctionnels et verifies).
12. `apps/mobile` non cree en Phase 1 (prevu Phase 13).

## Problemes rencontres et resolutions

### Bug 1 — Exports de package casses (`packages/*` vers `apps/api`)

**Symptome** : `vitest run` dans `apps/api` echouait avec `Failed to
resolve entry for package "@fixiyi/config"` / `"@fixiyi/shared-utils"`.

**Cause racine** : chaque `package.json` de `packages/*` declarait
`"exports": { ".": { "import": "./dist/index.mjs", "require":
"./dist/index.js" } }`, mais `tsup` (avec `"type": "module"` dans le
package.json) genere en realite `dist/index.js` (ESM) et
`dist/index.cjs` (CJS) — PAS `index.mjs`. Le mapping etait invalide
depuis le debut ; l'erreur n'est apparue qu'au moment ou un vrai
consommateur externe (`apps/api` via Vite/Vitest) a tente de resoudre le
module (les tests internes de chaque package, eux, n'importent jamais
leur propre `package.json` donc ne l'auraient jamais detecte).

**Resolution** : correction des champs `main`/`module`/`exports` des 5
packages pour pointer vers les vrais fichiers generes
(`dist/index.cjs` pour CJS/`main`, `dist/index.js` pour ESM/`module`+
`exports.import`). Verifie par rebuild + re-test complet.

### Bug 2 — `@nestjs/config` valide un instantane d'env perime

**Symptome** : smoke test manuel de `apps/api` (`node dist/main.js`)
echouait avec `InvalidEnvironmentError` listant TOUTES les variables
requises comme `undefined`, alors que le log dotenv confirmait
`"injected env (36) from ..\..\.env"` juste avant.

**Cause racine** : `ConfigModule.forRoot({ validate: loadEnv })` — Nest
passe a `validate` une copie de `process.env` prise avant l'execution du
callback. Notre `loadEnv()` charge dotenv (mutation du vrai
`process.env`) **a l'interieur** de ce callback, donc trop tard : la
copie deja recue par la fonction ne reflete jamais cette mutation.

**Resolution** : retrait complet de `@nestjs/config` (Decision 7).
`loadEnv()` est desormais appele une seule fois, explicitement, tout au
debut de `main.ts`, avant `NestFactory.create`. L'objet `Env` deja
valide est injecte partout via un module NestJS maison `@Global()`
(`EnvModule.forRoot(env)` + token `ENV`). Verifie par un nouveau smoke
test manuel reussi.

### Bug 3 — `dotenv` ne trouve jamais le `.env` racine depuis `apps/api`

**Symptome** : meme apres correction du Bug 2, le premier essai de smoke
test montrait `"injected env (0) from .env"` — dotenv cherchait
`.env` dans `apps/api/` (son `cwd` au moment de l'execution), pas a la
racine du monorepo ou vit le vrai fichier.

**Cause racine** : convention pnpm/turbo — chaque script de package
s'execute avec ce package comme `cwd`. `dotenv.config()` ne regarde que
dans `process.cwd()` par defaut, sans recherche vers le haut.

**Resolution** : `findNearestEnvFile()` (Decision 8), nouvelle fonction
dans `@fixiyi/config` qui remonte l'arborescence depuis `cwd` jusqu'a
trouver `.env`, en s'arretant a la racine du monorepo (marqueur
`pnpm-workspace.yaml`). `loadEnv()` l'utilise pour construire le chemin
passe a `dotenv.config({ path })`. 4 tests dedies avec de vrais dossiers
temporaires (cas nominal, sous-dossier profond, aucun `.env` nulle part,
`.env` present hors du monorepo mais pas dedans). Verifie par le smoke
test final : `"injected env (36) from ..\..\.env"` puis demarrage
reussi.

### Problemes mineurs (corriges au fil de l'eau, non bloquants)

- `typescript-eslint` ne supporte pas encore TypeScript 7.x (peer
  `<6.1.0`) -> epingle sur 6.0.3 (Decision 4).
- `nestjs-zod` ne supporte pas encore NestJS 12 -> pipe Zod maison
  (Decision 6).
- `eslint-plugin-react@7.37.5` declare un peer ESLint jusqu'a `^9.7`
  seulement (nous sommes en ESLint 10) — **warning connu, non bloquant**,
  pas encore reellement teste puisque `apps/web`/`apps/admin` (seuls
  consommateurs du preset `react.js`) ne sont pas encore crees. A
  surveiller a la prochaine session.
- `eslint-plugin-import-x` sans resolveur configure produisait des
  centaines de faux positifs "Resolve error" -> ajout de
  `eslint-import-resolver-typescript` + configuration
  `import-x/resolver-next`.
- Deprecation TS6 `baseUrl` remontee par le plugin dts de `tsup` (pas par
  notre propre config) -> `"ignoreDeprecations": "6.0"` dans le tsconfig
  de base.
- `rootDir`/`outDir`/`exclude` dans les presets partages
  (`packages/tsconfig/*.json`) se resolvent relativement au FICHIER qui
  les declare (pas au fichier qui `extends`) — piege classique de
  `tsconfig extends`. Corrige en retirant ces champs des presets partages
  et en les redefinissant dans chaque app/package consommateur.

## Limitations / TODO documentes

- `apps/web`, `apps/admin` : pas crees.
- Dockerfiles (api/worker/web/admin) et `docker-compose.dev.yml` : pas
  crees. `docker-compose.yml` (infra) existant fonctionne toujours.
- `.github/workflows/ci.yml` : pas cree.
- `README.md` : pas mis a jour (toujours le contenu de fin de Phase 0).
- Traductions `ary` (darija) : premier jet, a valider par un locuteur
  natif avant tout usage en production.
- `ZodValidationPipe` : ecrit et teste unitairement, mais pas encore
  branche sur une vraie route (aucun DTO metier en Phase 1).
- Peer warning `eslint-plugin-react` vs ESLint 10 : non teste en
  conditions reelles (attend `apps/web`/`apps/admin`).
- Aucune CI n'a encore tourne ces gates automatiquement — seulement en
  local dans cette session.

## Prerequis pour la phase suivante

Tous remplis pour continuer IMMEDIATEMENT la Phase 1 (pas la Phase 2) :

- Environnement Docker (Mongo/Redis/MinIO) operationnel et verifie.
- Socle monorepo + 7 packages partages stables et testes.
- `apps/api` et `apps/worker` fonctctionnels de bout en bout (build +
  tests + smoke test reel).
- Toutes les decisions techniques de cette premiere moitie de phase
  documentees (`docs/DECISIONS.md`).

## Prochaine phase

**Toujours Phase 1 - Foundation** — la phase n'est PAS terminee. Reprendre
avec `apps/web`, `apps/admin`, Dockerfiles, `docker-compose.dev.yml`, CI,
README, puis clore le rapport et **STOP + attendre "GO PHASE 2"**
conformement a `06_SCOPE.md` (regle d'arret absolue : jamais de Phase 2
sans validation humaine explicite ET sans que la Phase 1 soit
effectivement terminee).
