# PHASE 15 (REFONTE) — TESTS VISUELS — RAPPORT

Date : 2026-09-28. Plan : `PHASE_15_PLAN.md`, diagnostic :
`PHASE_15_DIAGNOSTIC.md`. Derniere phase de la refonte Design System V2.

## 1. Objectif et resultat

- **O1 — references** : 34 ecrans compares a une reference Linux
  (`tests/browser/visual/`) : les 13 galeries du design system, les parcours
  (connexion, demande, matching, chat, navigation) et, nouveaux, les trois
  ecrans publics a 360 et 1440 px. Aucune tolerance en pixels : les donnees
  generees sont masquees.
- **O2 — un seul moteur de rendu** (Decision 87, choix de l'utilisateur) :
  image `tests/browser/Dockerfile`, `pnpm test:visual` en local, job CI
  `browser` qui lance **toute** la suite navigateur, pour la premiere fois en
  CI.
- **O3 — instrument verifie** : 1 px de padding en plus sur les badges fait
  echouer la galerie qui les contient, et elle seule.
- **O4 — deux vrais defauts trouves en chemin** : l'ecran « Demande envoyee »
  affichait `REQUESTED` / `NORMAL` ; et un 401 tardif lancait un second
  rafraichissement de session (`web` et `admin`), vu sous Linux 1 fois sur 5,
  corrige et verrouille par test et mutants.

## 2. Fichiers

- `tests/browser/support/visual.ts` (`capture()`), `support/visual.css`
  (comparaisons seulement), `playwright.config.ts` (`snapshotPathTemplate`),
  les specs (captures, masques, `Envoyee`).
- `tests/browser/Dockerfile` et `Dockerfile.dockerignore`,
  `scripts/visual/run.mjs`, script `test:visual`, job `browser` de
  `.github/workflows/ci.yml`.
- `tests/browser/visual/` (34 references) ; 6 nouvelles captures nommees.
- `apps/web/src/app/requests/new/page.tsx` (libelles).
- `apps/web/src/lib/api-client.ts` et `.test.ts`, idem `apps/admin`
  (401 tardif) ; `scripts/mutation/mutants.json` (2 mutants, 1 recible).
- `docs/DECISIONS.md` (87), `docs/prompt/09_DESIGN_SYSTEM_RULE.md` §8,
  `README.md`, `docs/PROGRESS.md`.

## 3. Tests

- Gates sans cache : lint, typecheck, test 34/34 ; couverture 15/15 (0
  `PARSE_ERROR`) ; build 10/10.
- Mutation : **25/25** tues (1 equivalent). Le mutant
  `api-retry-after-refresh` visait la ligne modifiee : le harnais l'a signale
  invalide au lieu de le compter tue ; recible, tue.
- Unitaires ajoutes : 401 tardif, `web` et `admin`, vus rouges avant le
  correctif.
- Suite navigateur complete : **58/58 sous Linux avec comparaison**, 58/58
  sous Windows. `session-refresh` 10/10 repete sous Linux apres correctif.
- Stabilite des references : chaque spec a masques rejoue 2 a 3 fois de
  suite, identique au pixel.

## 4. Commandes

    pnpm turbo run lint typecheck test --force --concurrency=1
    pnpm test:coverage --force
    pnpm turbo run build --force
    pnpm test:mutation
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
    pnpm test:visual
    cd tests/browser && npx playwright test

## 5. Decisions

- **87** — references Linux, comparees dans une seule image, en local et en
  CI.

## 6. Problemes rencontres

Voir le diagnostic : masques dont la largeur bougeait, masque qui cachait
l'accuse de lecture, un echec `motion` non reproduit dont le message a ete
perdu, timeouts de workers Vitest sous charge.

## 7. Limitations

- Les references ne se comparent que sous Linux ; la suite Windows ecrit ses
  captures sans les comparer.
- Les listes des captures 11 a 13 sont masquees (contenu dependant de la
  base).
- Un echec `motion` de la premiere passe reste non explique (§5 du
  diagnostic).

## 8. Suite

La refonte Design System V2 est terminee (15 phases). Reste la Phase 7
**produit** (Offers), qui devra appeler `ConversationService.unlockContact`
a l'acceptation d'une offre, et les decisions ouvertes de `PROGRESS.md`
(« Blocages »).
