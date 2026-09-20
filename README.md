# Fixiyi

Marketplace de services et interventions a domicile.

## Statut

En construction - Phase 1 (Foundation)

## Stack

- Monorepo : pnpm + Turborepo
- Backend : Node.js + TypeScript + NestJS + Fastify
- Database : MongoDB (Mongoose)
- Cache/Queue : Redis + BullMQ
- Frontend Web / Admin : Next.js (App Router) + React + TypeScript +
  Tailwind CSS v4 (config CSS-first, `@theme`) + TanStack Query + Zustand
  + React Hook Form
- Mobile : Expo + React Native (prevu Phase 13, pas encore scaffolde)
- Realtime : Socket.IO (prevu, pas encore implemente)
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
    # editer .env : remplir JWT_SECRET/JWT_REFRESH_SECRET et les cles des
    # providers externes reellement utilises (les valeurs "dev"/"fake" par
    # defaut suffisent pour du developpement local sans providers reels).
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

## Structure

    fixiyi/
    |-- apps/
    |   |-- api/            NestJS + Fastify (Mongo, Redis, health check, OpenAPI)
    |   |-- worker/         BullMQ (queue de diagnostic system/ping)
    |   |-- web/            Next.js (site public)
    |   `-- admin/          Next.js (back-office)
    |-- packages/           Packages partages (tsconfig, eslint-config,
    |                       shared-utils, contracts, config, design-tokens, i18n)
    |-- infrastructure/     IaC, monitoring (prevu, pas encore implemente)
    |-- docs/               Documentation (PROGRESS, DECISIONS, phases)
    |-- scripts/            Scripts utilitaires
    `-- tests/              Tests E2E globaux (prevu, pas encore implemente)

## Services de developpement

| Service | URL | Credentials |
|---|---|---|
| MongoDB | localhost:27017 | (aucun) |
| Redis | localhost:6379 | (aucun) |
| MinIO API | http://localhost:9000 | minioadmin / minioadmin |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| API (health) | http://localhost:4000/health | - |
| API (docs) | http://localhost:4000/api/docs | - |
| Web | http://localhost:3000 | - |
| Admin | http://localhost:3001 (via Docker) / :3000 (dev local, voir plus haut) | - |

## Licence

Proprietaire - Tous droits reserves.
