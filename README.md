# Fixiyi

Marketplace de services et interventions a domicile.

## Statut

En construction - Phase 0 (Audit)

## Stack

- Monorepo : pnpm + Turborepo
- Backend : Node.js + TypeScript + NestJS + Fastify
- Database : MongoDB
- Cache/Queue : Redis + BullMQ
- Frontend Web : Next.js + React + TypeScript + Tailwind
- Mobile : Expo + React Native
- Admin : Next.js
- Realtime : Socket.IO
- Storage : S3-compatible (MinIO en dev)
- Validation : Zod
- API Docs : OpenAPI

## Prerequis

- Node.js 20+
- pnpm 9+
- Docker Desktop
- Git

## Installation

    git clone <repo-url>
    cd fixiyi
    cp .env.example .env
    pnpm install
    docker compose up -d
    docker compose ps

## Structure

    fixiyi/
    â”œâ”€â”€ apps/              Applications
    â”œâ”€â”€ packages/          Packages partages
    â”œâ”€â”€ infrastructure/    IaC, Docker, monitoring
    â”œâ”€â”€ docs/              Documentation
    â”œâ”€â”€ scripts/           Scripts utilitaires
    â””â”€â”€ tests/             Tests E2E

## Services de developpement

| Service | URL | Credentials |
|---|---|---|
| MongoDB | localhost:27017 | (aucun) |
| Redis | localhost:6379 | (aucun) |
| MinIO API | http://localhost:9000 | minioadmin / minioadmin |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |

## Licence

Proprietaire - Tous droits reserves.
