# Fixiyi

Marketplace de services et interventions a domicile.

## Statut

En construction - phases produit 0 a 6 livrees (fondation, auth, marketplace,
demandes, matching, chat) ; refonte Design System V2 en cours (phases 1 a 5
sur 14 livrees). Audit complet du 2026-09-21 : `docs/AUDIT_PHASES_0_5.md`.
Detail : `docs/PROGRESS.md`.

## Stack

- Monorepo : pnpm + Turborepo
- Backend : Node.js + TypeScript + NestJS + Fastify
- Database : MongoDB (Mongoose)
- Cache/Queue : Redis + BullMQ
- Frontend Web / Admin : Next.js (App Router) + React + TypeScript +
  Tailwind CSS v4 (config CSS-first, `@theme`) + TanStack Query + Zustand
  + React Hook Form
- Mobile : Expo + React Native (prevu Phase 13, pas encore scaffolde)
- Realtime : Socket.IO (chat : HTTP ecrit, la socket notifie ; adaptateur Redis)
- Storage : S3-compatible (MinIO en dev)
- Validation : Zod
- API Docs : OpenAPI (Swagger UI sur `apps/api`)

## Prerequis

- Node.js 20+ (22 recommande - voir `.nvmrc`)
- pnpm 9+ (12.4.2 utilise dans ce depot - voir `packageManager` dans
  `package.json`)
- Docker Desktop
- Git

## Installation

    git clone <repo-url>
    cd fixiyi
    cp .env.example .env
    # editer .env : remplir JWT_SECRET/JWT_REFRESH_SECRET/OTP_SECRET (par
    # exemple via `openssl rand -hex 32`) et les cles des providers externes
    # reellement utilises (les valeurs "dev"/"fake" par defaut suffisent
    # pour du developpement local sans providers reels).
    pnpm install
    docker compose up -d
    docker compose ps

`docker compose up -d` demarre uniquement l'infrastructure (MongoDB, Redis,
MinIO). `.env.test.example` est utilise directement par les tests
d'integration (pas de copie necessaire) - voir "Tests" plus bas.

## Developpement local (sans Docker pour les apps)

    pnpm dev

Lance en parallele (via Turborepo, mode watch persistant) : `apps/api`
(http://localhost:4000), `apps/worker`, `apps/web`
(http://localhost:3000) et `apps/admin` (http://localhost:3000 aussi par
defaut - utiliser `PORT=3001 pnpm --filter @fixiyi/admin dev` pour eviter
le conflit de port si les deux tournent en meme temps).

Next.js et Turborepo collectent une telemetrie anonyme par defaut. Ce
depot la desactive dans Docker/CI (voir `docs/DECISIONS.md`, Decision 15) ;
en local, desactiver soi-meme si souhaite :

    npx next telemetry disable
    npx turbo telemetry disable

## Validation (gates)

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

## Tests

Les tests d'integration reels (`apps/api`, `apps/worker`) se connectent a
MongoDB/Redis via les valeurs non-secretes de `.env.test.example`
(`localhost`, ports par defaut) - `docker compose up -d` doit avoir ete
lance au prealable. Aucune donnee simulee : les tests font de vraies
requetes Mongo/Redis/HTTP.

## Docker (apps applicatives)

Les Dockerfiles de `apps/api`, `apps/worker`, `apps/web` et `apps/admin`
completent l'infrastructure existante (`docker-compose.yml`) via
`docker-compose.dev.yml` :

    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
    docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
    curl http://localhost:4000/health

## Tests navigateur (Playwright)

Contre la pile Docker demarree (voir plus haut) :

    cd tests/browser
    npx playwright test

Parcours reels (connexion OTP, demande avec upload, matching, chat,
rafraichissement de session, navigation) et banc d'essai des composants de
`@fixiyi/ui` rendus avec les vraies feuilles de style.

## Production

En `NODE_ENV=production`, l'API refuse de demarrer si `JWT_SECRET`,
`JWT_REFRESH_SECRET` ou `OTP_SECRET` reprend une valeur d'exemple, fait
moins de 32 caracteres, ou si deux d'entre eux sont egaux (Decision 64).
Generer chacun avec `openssl rand -hex 32`.

## Auth (Phase 2)

`apps/api` expose desormais un module `auth` complet sous `/api/v1/auth` :
OTP telephone (provider `dev`/`fake`, jamais un vrai SMS), sessions +
rotation des refresh tokens (detection de reutilisation -> revocation),
logout/logout-all, gestion des appareils/sessions, RBAC (roles), auto-
attribution du role `PROVIDER` (regle d'age configurable via
`MIN_PROVIDER_AGE`), email + verification. Le detail complet est dans
`docs/phases/PHASE_2_REPORT.md`. En dev, `POST /auth/otp/request` renvoie
le code dans le corps de la reponse (`devCode`) - jamais logue, jamais
envoye par un vrai SMS.

## Structure

    fixiyi/
    |-- apps/
    |   |-- api/            NestJS + Fastify (Mongo, Redis, health check,
    |   |                   OpenAPI, module auth complet)
    |   |-- worker/         BullMQ (queue de diagnostic system/ping)
    |   |-- web/            Next.js (site public)
    |   `-- admin/          Next.js (back-office)
    |-- packages/           Packages partages (tsconfig, eslint-config,
    |                       shared-utils, contracts, config, design-tokens,
    |                       ui = design system @fixiyi/ui, i18n)
    |-- infrastructure/     IaC, monitoring (prevu, pas encore implemente)
    |-- docs/               Documentation (PROGRESS, DECISIONS, phases)
    |-- scripts/            Scripts utilitaires
    `-- tests/browser/      Tests navigateur Playwright (parcours reels contre la
                            pile Docker + banc d'essai du design system)

## Services de developpement

| Service | URL | Credentials |
|---|---|---|
| MongoDB | localhost:27017 | (aucun) |
| Redis | localhost:6379 | (aucun) |
| MinIO API | http://localhost:9000 | minioadmin / minioadmin |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| API (health) | http://localhost:4000/health | - |
| API (docs) | http://localhost:4000/api/docs | - |
| API (auth) | http://localhost:4000/api/v1/auth/* | voir `docs/phases/PHASE_2_REPORT.md` |
| Web | http://localhost:3000 | - |
| Admin | http://localhost:3001 (via Docker) / :3000 (dev local, voir plus haut) | - |

## Licence

Proprietaire - Tous droits reserves.
