# PHASE 1 - FOUNDATION - PLAN

## Date

2026-09-19

## Objectif

Poser le socle technique du monorepo Fixiyi : outillage, structure,
configuration partagee, squelettes d'applications connectes a
MongoDB/Redis, CI. Aucune logique metier (auth/marketplace/requests/...)
n'est implementee ici : c'est l'objet des phases suivantes.

## Perimetre explicite

**Dans le perimetre**
- `pnpm-workspace.yaml`, `turbo.json`, `package.json` racine.
- `packages/tsconfig` : configs TypeScript strict partagees.
- `packages/eslint-config` : ESLint/Prettier partages (interdiction `any`
  non justifie).
- `packages/shared-utils` : IDs (UUIDv7), money (integer minor units),
  time (UTC) - utilitaires reellement utilises et testes, pas de
  placeholders vides.
- `packages/contracts` : premiers schemas Zod partages (Offer,
  WalletTransaction, DomainEvent - repris de `07_EXAMPLES.md`) +
  primitives communes (Money, ISODateTime).
- `packages/config` : chargement/validation Zod des variables d'env,
  echoue au demarrage si invalide.
- `packages/design-tokens` : tokens de base reels (couleurs, espacements,
  rayons, typographie) - minimal mais fonctionnel, pas decoratif faux.
- `packages/i18n` : structure de ressources de traduction (fr/en/ar/ary)
  + loader minimal. Pas d'integration UI complete (prematuree tant qu'il
  n'y a pas d'ecrans reels).
- `apps/api` : NestJS + adaptateur Fastify, connexion MongoDB (Mongoose)
  et Redis (ioredis) reelles et verifiees au boot, endpoint de health
  check reel (verifie Mongo+Redis, pas un stub), OpenAPI expose,
  pipe de validation Zod.
- `apps/worker` : process Node + BullMQ, connexion Redis reelle,
  arret propre (graceful shutdown).
- `apps/web` : Next.js (App Router) + TypeScript + Tailwind, page
  d'accueil minimale et honnete (pas de faux boutons, pas de fonctionnalite
  simulee) consommant `packages/design-tokens`.
- `apps/admin` : Next.js minimal, meme niveau que `apps/web`.
- Dockerfile par app + `docker-compose.dev.yml` completant l'infra
  existante (mongodb/redis/minio deja definis dans `docker-compose.yml`).
- `.github/workflows/ci.yml` : install -> lint -> typecheck -> test ->
  build (les etapes integration/E2E/docker/deploy arriveront quand il y
  aura une base fonctionnelle a tester).
- Mise a jour de `README.md` pour refleter l'installation reelle.

**Hors perimetre (explicitement reporte)**
- `apps/mobile` (Expo) : Phase 13 (V3), pas de scaffolding premature.
- Toute logique metier (auth, catalogue, requests, matching, chat,
  offers, interventions) : phases 2 a 8.
- Integration complete d'un framework i18n dans le rendu UI : quand de
  vrais ecrans existeront.
- `infrastructure/terraform` : Phase 15.

## Decisions techniques a prendre en Phase 1 (documentees dans
docs/DECISIONS.md au fil de l'implementation)

- ODM MongoDB pour `apps/api` : Mongoose via `@nestjs/mongoose` (choix
  par defaut le plus maintenu dans l'ecosysteme NestJS) vs driver natif
  `mongodb`. A trancher et documenter.
- Validation des DTOs NestJS avec Zod (schema `02_SPEC_ENGINEERING`
  impose Zod partout) : pipe de validation Zod maison et fine (evite une
  dependance supplementaire) plutot que `class-validator`.
- Versions exactes des dependances : resolues par `pnpm add` au moment
  de l'implementation (pas de version figee de memoire), consignees dans
  le rapport de phase et le lockfile.

## Sequence d'implementation

1. Fichiers racine du monorepo (package.json, pnpm-workspace.yaml,
   turbo.json, .editorconfig, .nvmrc).
2. `packages/tsconfig`, `packages/eslint-config` (fondations utilisees
   par tout le reste).
3. `packages/shared-utils`, `packages/contracts`, `packages/config`,
   `packages/design-tokens`, `packages/i18n`.
4. `pnpm install` a la racine, verification du linking workspace.
5. `apps/api` (NestJS/Fastify, Mongo, Redis, health check, OpenAPI).
6. `apps/worker` (BullMQ/Redis).
7. `apps/web`, `apps/admin` (Next.js minimal).
8. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` sur tout le
   monorepo, correction jusqu'a zero erreur.
9. Dockerfiles + `docker-compose.dev.yml`, verification `docker compose
   build`.
10. `.github/workflows/ci.yml`.
11. Mise a jour `README.md`.
12. `docs/phases/PHASE_1_REPORT.md`, mise a jour `docs/PROGRESS.md` et
    `docs/DECISIONS.md`.
13. STOP, attendre `GO PHASE 2`.

## Criteres de sortie (build gates)

- `pnpm lint` -> 0 erreur sur tout le workspace.
- `pnpm typecheck` -> 0 erreur.
- `pnpm test` -> tous les tests passent (au moins : shared-utils,
  contracts, health controller api).
- `pnpm build` -> succes pour tous les apps/packages.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
  demarre mongodb/redis/minio/api/worker/web/admin ; `GET /health` de
  l'API repond 200 avec statut Mongo+Redis reellement verifie.
- Aucun bouton mort / route morte / donnee simulee presentee comme
  reelle.
