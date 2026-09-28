# Licences — Fixiyi

Etat au 2026-09-27 (phase 14 de la refonte). Fixiyi lui-meme est
`UNLICENSED` (code proprietaire, `package.json` de chaque paquet).

## Dependances de production

368 paquets, lus par `pnpm licenses list --prod` (liste complete :
`docs/design/evidence/phase14/licences-prod.json`).

| Licence | Paquets |
|---|---|
| MIT | 279 |
| Apache-2.0 | 50 |
| ISC | 15 |
| BSD-2-Clause | 8 |
| BSD-3-Clause | 7 |
| BlueOak-1.0.0 | 5 |
| Python-2.0 | 1 |
| MIT OR Apache-2.0 | 1 |
| CC-BY-4.0 | 1 |
| 0BSD | 1 |

**Aucune licence copyleft** (GPL, LGPL, AGPL, MPL) : rien n'oblige a
publier le code de Fixiyi.

Les licences moins courantes, et ce qu'elles demandent :

- **Apache-2.0** (dont `@aws-sdk/*`, client S3) : conserver le fichier
  `NOTICE` du paquet s'il en a un, en cas de redistribution.
- **BlueOak-1.0.0** (`glob`, `lru-cache`, `minimatch`, `minipass`,
  `path-scurry`) : permissive, sans condition de publication.
- **Python-2.0** (`argparse`, dependance d'outillage) : permissive.
- **CC-BY-4.0** (`caniuse-lite`, donnees de compatibilite des navigateurs,
  utilisees a la construction) : attribution si les donnees sont
  redistribuees ; elles ne le sont pas, elles servent au build.

Principales dependances directes : `next` 16, `react` 19, `@nestjs/core` 12,
`fastify` 5, `mongoose` 9, `ioredis` 6, `bullmq` 6, `socket.io` 4, `zod` 4,
`zustand` 5, `@tanstack/react-query` 5, `pino` 10 — toutes **MIT** ;
`@aws-sdk/client-s3` — **Apache-2.0**.

## Polices

Auto-hebergees a la construction par `next/font` (phase 2 de la refonte, D6,
D7) : aucun appel a Google a l'execution.

| Police | Licence |
|---|---|
| Inter | SIL Open Font License 1.1 |
| Noto Sans Arabic | SIL Open Font License 1.1 |

L'OFL autorise l'integration dans un site ou une application ; elle interdit
de vendre la police seule et demande que la licence accompagne une
redistribution **des fichiers de police** en tant que tels.

## Icones

Les 63 icones de `packages/ui` (`Icon.tsx`) sont des traces SVG ecrits dans
le depot, sur une grille 24 x 24 commune. **Aucune bibliotheque d'icones
n'est une dependance.** Le source n'attribue aucune provenance externe ; si
certains traces reprennent un jeu existant, l'attribution est a ajouter ici.

## Outils de developpement

Les dependances de developpement (Vitest, Playwright, ESLint, TypeScript,
axe-core…) ne sont pas livrees. `@axe-core/playwright` est MPL-2.0 : il ne
sert qu'aux tests et n'est jamais distribue.

## Regenerer

```
pnpm licenses list --prod --json > docs/design/evidence/phase14/licences-prod.json
```
