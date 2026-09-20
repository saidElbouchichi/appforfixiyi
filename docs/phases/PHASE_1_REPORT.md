# PHASE 1 - FOUNDATION

## Statut

**TERMINEE** — tous les objectifs du perimetre sont construits, testes
(build gates + smoke tests manuels + verification Docker reelle), et
fonctionnels.

## Date debut / fin

Debut : 2026-09-19 (immediatement apres reception de "GO PHASE 1")
Pause intermediaire : 2026-09-19 23:29 UTC (~55%, limite de tokens, voir
historique de ce fichier / `docs/PROGRESS.md`)
Reprise et fin : 2026-09-20 (apres reception de "CONTINUE PHASE 1")

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
  verts + smoke test manuel reussi + verifie sain dans Docker
- ✅ `apps/worker` (BullMQ + Redis reels, arret propre) — build gates
  verts + smoke test manuel reussi + verifie sain dans Docker
- ✅ `apps/web` (Next.js App Router, Tailwind v4 CSS-first, design tokens
  cables, TanStack Query/Zustand/React Hook Form/Zod installes) — build
  gates verts + smoke test manuel reussi + verifie sain dans Docker
- ✅ `apps/admin` (meme niveau que `apps/web`) — build gates verts +
  smoke test manuel reussi + verifie sain dans Docker
- ✅ Dockerfile par app + `docker-compose.dev.yml` — les 4 images
  construites, la stack complete (7 services) demarree et verifiee saine
- ✅ `.github/workflows/ci.yml` — install -> lint -> typecheck -> test ->
  build, avec MongoDB/Redis en services CI
- ✅ Mise a jour de `README.md`

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

### 5. `apps/web` et `apps/admin` — Next.js (App Router)

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 en
  config CSS-first (`@import "tailwindcss";` + `@import
  "@fixiyi/design-tokens/css";` dans `globals.css`, PAS de
  `tailwind.config.js`). Verifie reellement : les variables
  `--fixiyi-color-*` et les utilitaires Tailwind a valeur arbitraire
  (`bg-[var(--fixiyi-color-primary-100)]`) sont bien presents dans le CSS
  compile (`grep` sur `.next/static/chunks/*.css` apres build).
- `Providers` (composant client) : `QueryClientProvider` (TanStack Query)
  reellement cable dans `layout.tsx` — pas de requete reelle encore
  (aucun ecran metier), mais l'infrastructure fonctionne (meme logique
  que `ZodValidationPipe` en Decision 6 : piece prete, pas encore
  exercee par une fonctionnalite reelle).
- `zustand`, `react-hook-form` installes (requis par le plan technique
  pour les phases suivantes) mais non utilises encore : aucun ecran/etat
  metier n'existe en Phase 1 pour les exercer honnetement.
- Page d'accueil minimale et honnete : statut de build fonctionnel
  uniquement, aucun bouton mort ni fonctionnalite simulee.
- `eslint-plugin-react` casse reellement sous ESLint 10 (voir Decision 13
  et Bug 4) — remplace par `@eslint-react/eslint-plugin`.
- Smoke test manuel reel (`next build` + `next start`) pour les deux
  apps : `GET /` -> 200, contenu HTML verifie (texte de statut present).

### 6. Docker — Dockerfile par app + `docker-compose.dev.yml`

- Pattern `turbo prune --docker` (documente officiellement par
  Turborepo pour les monorepos pnpm) : chaque `Dockerfile`
  (`apps/{api,worker,web,admin}/Dockerfile`) prune le monorepo au
  strict necessaire pour son app, installe le lockfile pruned, build,
  puis copie le resultat dans une image finale minimale tournant en
  utilisateur non-root.
- `docker-compose.dev.yml` complete `docker-compose.yml` (infra) avec
  les 4 apps ; `api`/`worker` recoivent les URLs Mongo/Redis/MinIO
  reecrites vers les noms de service Docker (`mongodb`, `redis`,
  `minio`) au lieu de `localhost` (`.env` local reutilise via `env_file`
  + `environment` pour les surcharges reseau).
- **Verifie reellement** : `docker compose -f docker-compose.yml -f
  docker-compose.dev.yml up -d` demarre les 7 services ; `docker compose
  ps` confirme `api`/`web`/`admin` `healthy` (HEALTHCHECK reel sur
  `/health` et `/`) et `worker` `Up` (pas de HEALTHCHECK - pas de
  surface HTTP, voir Decision 9) ; `curl http://localhost:4000/health`
  retourne `{"status":"ok","checks":{"mongo":{"status":"up"},"redis":{"status":"up"}}}`
  en passant reellement par le reseau Docker (pas `localhost`).
- Voir Bug 4 ci-dessous pour un probleme reel de permissions decouvert
  et corrige pendant cette verification.

### 7. CI — `.github/workflows/ci.yml`

- Pipeline `install -> lint -> typecheck -> test -> build` (turbo, sur
  tout le monorepo), avec des services GitHub Actions `mongo:7` et
  `redis:7-alpine` (memes versions que `docker-compose.yml`) pour que
  les tests d'integration reels d'`apps/api`/`apps/worker` fonctionnent
  en CI exactement comme en local.
- Telemetrie Next.js/Turborepo desactivee (Decision 15).
- Pas encore exerce par une execution GitHub Actions reelle (aucun push
  vers le remote depuis cette session) - voir Limitations.

### 8. `README.md`

Instructions d'installation/dev/test/Docker reelles (plus le contenu de
fin de Phase 0), incluant la note telemetrie (Decision 15) et le tableau
des services de developpement mis a jour (API, web, admin).

## Fichiers crees / modifies

Liste complete et exhaustive dans `docs/PROGRESS.md` (sections "Liste
COMPLETE des fichiers crees" et "... modifies"). Resume : **~120 fichiers
crees** (packages/apps de la premiere moitie de phase + `apps/web`,
`apps/admin`, 4 `Dockerfile`, `docker-compose.dev.yml`,
`.github/workflows/ci.yml`, `.dockerignore`), fichiers modifies
(`.env.test.example`, `.gitignore`, `README.md`,
`packages/eslint-config/{package.json,react.js}`), plus les fichiers de
suivi (`docs/PROGRESS.md`, `docs/DECISIONS.md`).

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
| Build gates (lint/typecheck/build) | `apps/web`, `apps/admin` | 0 erreur/0 warning ; pas de tests unitaires (page de statut sans logique metier a tester - voir Decision 14) |
| **Smoke test manuel** (process reel demarre) | `apps/web`, `apps/admin` | `next start` -> `GET /` 200, contenu HTML verifie |
| **Verification Docker reelle** (7 conteneurs, reseau Docker reel) | stack complete | `docker compose ps` -> mongodb/redis (healthy, deja verifies), api/web/admin (healthy, HEALTHCHECK reel), worker (Up, pas de HEALTHCHECK) ; `curl :4000/health` via le reseau Docker -> 200, mongo+redis up |

**Total automatise : 63 tests, tous passent** (inchange - `apps/web`/
`apps/admin` n'ajoutent pas de tests unitaires, voir Decision 14).
`pnpm lint && pnpm typecheck && pnpm test && pnpm build` -> **13/13,
13/13, 11/11, 9/9 taches Turbo reussies** sur les 12 packages/apps du
monorepo (0 erreur, 0 warning).

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

$ pnpm --filter @fixiyi/web lint && pnpm --filter @fixiyi/web typecheck && pnpm --filter @fixiyi/web build
(0 erreur, 0 warning ; build Next.js reussi, route / statique)

$ docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 Container fixiyi-mongodb  Healthy
 Container fixiyi-redis  Healthy
 Container fixiyi-api  Started
 Container fixiyi-worker  Started
 Container fixiyi-web  Started
 Container fixiyi-admin  Started

$ docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
fixiyi-admin    Up ... (healthy)
fixiyi-api      Up ... (healthy)
fixiyi-mongodb  Up ... (healthy)
fixiyi-redis    Up ... (healthy)
fixiyi-web      Up ... (healthy)
fixiyi-worker   Up ...
fixiyi-minio    Up ...

$ curl http://localhost:4000/health
{"status":"ok","checks":{"mongo":{"status":"up"},"redis":{"status":"up"}}}

$ docker logs fixiyi-worker --tail 5
[worker] ready (env=development)
```

## Decisions prises

Voir `docs/DECISIONS.md`, Decisions 4 a 15 :

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
13. Remplacement de `eslint-plugin-react` (crash reel sous ESLint 10) par
    `@eslint-react/eslint-plugin`.
14. Design tokens <-> Tailwind v4 : pont par variables CSS + valeurs
    arbitraires, pas de mapping `@theme inline` complet en Phase 1.
15. Telemetrie Next.js ET Turborepo desactivee (Docker/CI).

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

### Bug 4 — Permissions Docker : le cache pnpm par utilisateur de
  corepack casse au demarrage du conteneur

**Symptome** : les 4 conteneurs (`api`, `worker`, `web`, `admin`)
demarraient puis bouclaient en erreur au lieu de rester up :

```
Error: ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR
  × installing dependencies
  ╰─▶ Failed to remove /app/node_modules/.pnpm from the modules directory:
      Permission denied (os error 13)
```

Decouvert en verifiant reellement `docker compose up -d` + `docker logs`
(pas suppose) - `docker compose ps` montrait les 4 conteneurs bloques en
`health: starting` puis en boucle de redemarrage, `curl` sur `/health`
echouait avec une connexion vide.

**Cause racine** : le `Dockerfile` activait pnpm via `corepack enable &&
corepack prepare pnpm@12.4.2 --activate`, execute par `root` dans les
stages de build. Le cache de corepack (le binaire pnpm telecharge) vit
sous `$HOME`, qui differe pour l'utilisateur non-root `fixiyi` cree pour
le stage `runner`. Au premier lancement du conteneur, corepack ne
retrouve pas son cache sous le nouveau `$HOME`, retelecharge pnpm, puis
declenche une verification de coherence qui tente de vider
`/app/node_modules/.pnpm` - un dossier appartenant a `root` (copie
`COPY --from=installer /app .` executee avant le `USER fixiyi`, donc en
tant que `root`) - d'ou le refus de permission en tant qu'utilisateur
non-root.

**Resolution** : deux changements independants et complementaires,
verifies ensemble en reconstruisant les 4 images puis en relancant la
stack :

1. `npm install -g pnpm@12.4.2 turbo@2.11.2` au lieu de `corepack
   enable`/`prepare` - un binaire pnpm global unique, sans cache par
   utilisateur, elimine la cause du retelechargement.
2. `COPY --from=installer --chown=fixiyi:fixiyi /app .` - les fichiers
   copies appartiennent directement a l'utilisateur d'execution non-root,
   plus de mismatch de proprietaire quel que soit le comportement de
   pnpm au demarrage.

Verifie par reconstruction complete des 4 images + `docker compose up -d`
+ `docker compose ps` (4/4 `healthy`/`Up`) + `curl`/`docker logs` reels
sur chaque service (voir "Commandes lancees" ci-dessus).

### Problemes mineurs (corriges au fil de l'eau, non bloquants)

- `typescript-eslint` ne supporte pas encore TypeScript 7.x (peer
  `<6.1.0`) -> epingle sur 6.0.3 (Decision 4).
- `nestjs-zod` ne supporte pas encore NestJS 12 -> pipe Zod maison
  (Decision 6).
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

- Traductions `ary` (darija) : premier jet, a valider par un locuteur
  natif avant tout usage en production.
- `ZodValidationPipe` : ecrit et teste unitairement, mais pas encore
  branche sur une vraie route (aucun DTO metier en Phase 1).
- `Providers`/TanStack Query dans `apps/web`/`apps/admin` : cable mais
  pas encore exerce par une vraie requete (aucun ecran metier).
- `zustand`/`react-hook-form` : installes (stack imposee), pas encore
  utilises (aucun formulaire/etat metier en Phase 1).
- Mapping design tokens -> theme Tailwind (`@theme inline`) : pas fait,
  seules les variables CSS brutes + valeurs arbitraires sont cablees
  (Decision 14) - a refaire quand de vrais composants existeront.
- Images Docker non optimisees pour la taille (tout `node_modules` du
  sous-ensemble pruned est copie, pas de `next.config.ts`
  `output: "standalone"` ni d'install `--prod` separee) - fonctionnel
  mais pas mimimal, a revisiter si la taille des images devient un vrai
  probleme (pas le cas en Phase 1).
- `.github/workflows/ci.yml` : ecrit et relu attentivement (syntaxe,
  versions d'actions, services Mongo/Redis), mais **pas encore exerce
  par une execution GitHub Actions reelle** - aucun push vers un remote
  GitHub n'a eu lieu depuis cette session locale. A verifier au premier
  push/PR.
- Peer warning `eslint-plugin-react` vs ESLint 10 : **resolu** (Decision
  13, Bug reel decouvert et corrige - pas qu'un warning, un crash reel).

## Prerequis pour la phase suivante

Tous remplis pour demarrer la Phase 2 :

- Environnement Docker complet (Mongo/Redis/MinIO + api/worker/web/admin)
  operationnel et verifie sain (`docker compose ps`, healthchecks reels).
- Socle monorepo + 7 packages partages + 4 apps stables et testes (0
  erreur/0 warning sur lint/typecheck/test/build, tout le monorepo).
- CI ecrite (install -> lint -> typecheck -> test -> build) - a confirmer
  au premier push.
- README a jour avec les instructions reelles d'installation/dev/Docker.
- Toutes les decisions techniques de la phase documentees
  (`docs/DECISIONS.md`, Decisions 4 a 15).

## Prochaine phase

**Phase 1 - Foundation TERMINEE.** Conformement a `06_SCOPE.md` (regle
d'arret absolue : jamais de Phase 2 sans validation humaine explicite),
**STOP et attente de "GO PHASE 2"**.
