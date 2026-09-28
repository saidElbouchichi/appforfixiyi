# PHASE 14 (REFONTE) — NETTOYAGE — RAPPORT

Date : 2026-09-27 (verification finale le 2026-09-28). Enchainee sans GO
intermediaire (Decision 81). Plan : `PHASE_14_PLAN.md`.

## 1. Objectif et resultat

Retirer le code mort et les dependances inutiles, documenter les licences,
verifier la coherence, ecrire la regle du design system.

- **O1 — code mort** : knip, 43 constats bruts verifies un a un. 2
  dependances mortes retirees (`react-hook-form` dans `web` et `admin`,
  `source-map-support` dans `api`), 5 `export` superflus retires dans le
  perimetre de la refonte. Ce qui reste est documente (§7).
- **O2 — la couverture mentait** : 24 `PARSE_ERROR` sortaient **toutes les
  pages** du denominateur. Corrige ; mesure honnete `web` **16,4 %** (et non
  38 %), `admin` **22,3 %** (et non 64,6 %). Planchers rebases (Decision 86).
- **O3 — captures protegees** : lancer un seul fichier Playwright vidait
  `screenshots/` (c'etait l'`outputDir`). Separe : 28 captures avant, 28
  apres un lancement isole.
- **O4 — Mongoose** : `new: true` (deprecie) -> `returnDocument: "after"`,
  4 usages ; 0 avertissement dans les suites de l'API.
- **O5 — documents** : `docs/LICENSES.md` (368 paquets de production, aucun
  copyleft), `docs/prompt/09_DESIGN_SYSTEM_RULE.md` (point 9 de
  `00_README.md`), `README.md` et `PROGRESS.md` remis a jour.

Aucun comportement livre n'a change.

## 2. Fichiers

- `apps/web/vitest.config.mts`, `apps/admin/vitest.config.mts` : JSX
  transforme par les tests, planchers rebases.
- `apps/web/package.json`, `apps/admin/package.json`, `apps/api/package.json`,
  `pnpm-lock.yaml` : dependances mortes retirees.
- `apps/web/src/app/fonts.ts`, `apps/admin/src/app/fonts.ts`,
  `tests/browser/support/journeys.ts` : `export` superflus.
- `apps/api/src/auth/session/session.service.ts`,
  `apps/api/src/chat/conversation.service.ts` : `returnDocument`.
- `tests/browser/playwright.config.ts`, `.gitignore` : `outputDir` separe.
- `docs/LICENSES.md`, `docs/prompt/09_DESIGN_SYSTEM_RULE.md`,
  `docs/prompt/00_README.md`, `README.md`, `docs/PROGRESS.md`,
  `docs/DECISIONS.md` (86), `PHASE_13_REPORT.md` (chiffre corrige).
- Preuves : `evidence/phase14/` (knip avant/apres, licences, mutation).

## 3. Tests

- Gates **sans cache** : lint, typecheck, test — 34/34 taches, 871 tests
  unitaires.
- Couverture : 15/15, **0 `PARSE_ERROR`**, planchers verts.
- Build : 10/10.
- Mutation : **23/23** tues (1 equivalent, non compte).
- API contre Mongo reel : 31 fichiers, 315/315, 0 avertissement de
  depreciation.
- Images Docker reconstruites (`web` et `admin` perdent une dependance),
  7 services sains ; Playwright complet **58/58**.

## 4. Commandes

    pnpm turbo run lint typecheck test --force
    pnpm test:coverage --force
    pnpm turbo run build --force
    pnpm test:mutation
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
    cd tests/browser && npx playwright test

## 5. Decisions

- **86** — planchers de couverture rebases sur le vrai denominateur.

## 6. Problemes rencontres

- **La mesure d'avant etait fausse.** Les `PARSE_ERROR` s'affichaient depuis
  la phase 11 sans faire echouer la couverture ; les pourcentages des phases
  11 a 13 excluaient les pages. Trouve en cherchant la cause des erreurs, pas
  en lisant les pourcentages : la regle 7 de `09_DESIGN_SYSTEM_RULE.md`
  (verifier l'instrument) s'applique aussi a la couverture.
- **Premiere passe des gates rouge** (`@fixiyi/ui`, 11 « Timeout waiting for
  worker ») pendant le demarrage de Docker Desktop, toutes les taches en
  parallele. Aucun test en echec ; relancee seule puis en concurrence 2 :
  verte. Contention de la machine, pas un defaut.

## 7. Limitations

- Restent dans knip, a dessein : `ResourceOwnerGuard` / `OwnedBy`
  (Decision 20), les faux positifs du plan (§2), les `export` superflus
  d'`apps/api` (hors perimetre de la refonte, signales) et 25 types exportes
  qui decrivent des signatures publiques.
- La couverture unitaire de `web` et `admin` reste basse : le rendu des pages
  est tenu par Playwright, que Vitest ne compte pas.
- Icones : aucune provenance externe attribuee dans le source (`LICENSES.md`).

## 8. Prerequis et prochaine phase

Phase 15 (tests visuels, `toHaveScreenshot`), enchainee sans arret
(Decision 81). La regle 8 de `09_DESIGN_SYSTEM_RULE.md` l'annonce deja.
