# PHASE 14 (REFONTE) — NETTOYAGE — DIAGNOSTIC

Date : 2026-09-27 (verification finale le 2026-09-28). Plan :
`PHASE_14_PLAN.md`. Preuves : `docs/design/evidence/phase14/`.

## 1. Audit mesure

| Instrument | Mesure | Critere |
|---|---|---|
| knip 5 (ponctuel, rien ajoute au depot) | 43 constats bruts | chaque constat verifie a la main |
| `pnpm licenses list --prod` | 368 paquets | aucun copyleft |
| Couverture vitest, sortie brute | 24 `PARSE_ERROR` | 0 |
| Playwright, un seul spec lance | captures nommees avant / apres | aucune supprimee |
| Suites de l'API contre Mongo | avertissements Mongoose | 0 |

## 2. Defauts reels

### 2.1 La couverture excluait toutes les pages

- **Mesure** : 24 `PARSE_ERROR` a chaque passe de couverture, depuis au
  moins la phase 11. Le `tsconfig` partage dit `"jsx": "preserve"` (exige
  par Next) ; Vitest le suit, et un fichier qu'aucun test n'importe est
  remappe depuis du JSX non transforme, qui ne se parse pas. Le fichier sort
  du denominateur **sans faire echouer la commande**.
- **Impact** : `web` annoncait 38 % de 379 lignes ; c'etait 16,4 % de 878.
  `admin` annoncait 64,6 % de 65 ; c'etait 22,3 % de 188. Les phases 11 a 13
  ont cite des chiffres faux, et les planchers de la Decision 74 gardaient
  une mesure qui ne comptait pas les ecrans.
- **Correction** : `oxc: { jsx: { runtime: "automatic" } }` dans les deux
  `vitest.config.mts` ; planchers rebases, Decision 86 ; chiffres corriges
  dans `PROGRESS.md` et `PHASE_13_REPORT.md`.

### 2.2 Lancer un seul spec Playwright supprimait les captures nommees

- **Mesure** : `outputDir: "./screenshots"`. Playwright vide son
  `outputDir` au debut de chaque passe : un `npx playwright test <un spec>`
  effacait les captures des autres specs, committees.
- **Correction** : `outputDir: "./test-results"`. Verifie : 28 captures
  avant un lancement isole, 28 apres, 0 suppression dans `git status`.

### 2.3 Deux dependances mortes

- `react-hook-form` (`web`, `admin`) : importe nulle part ; `README.md` le
  citait encore dans la stack. `source-map-support` (`api`) : cite seulement
  dans `package.json`.
- **Preuve qu'elles etaient mortes** : retirees, gates sans cache, build,
  images reconstruites et Playwright complet verts.

### 2.4 Option Mongoose depreciee

- `new: true` (4 usages, `session.service.ts`, `conversation.service.ts`)
  -> `returnDocument: "after"`. Meme document renvoye ; verifie par les 315
  tests de l'API contre Mongo reel, 0 avertissement.

## 3. Faux defauts

- `tests/browser/audit/playwright.config.ts` : utilise via `--config`.
- `postcss` « non liste » : la configuration ne nomme que le plugin.
- `next` non resolu dans `packages/tsconfig/nextjs.json` : plugin du service
  de langage, pas un import.
- `ResourceOwnerGuard` / `OwnedBy` : prets et testes, sans consommateur a
  dessein (Decision 20).
- 12 exports « inutilises » : tous utilises dans leur propre fichier ; un
  mot-cle `export` en trop, pas du code mort.
- 25 types exportes : signatures publiques.

## 4. Corrections appliquees / retirees / reportees

- Appliquees : §2.1 a §2.4 ; 5 `export` superflus retires dans le perimetre
  de la refonte (polices `web` et `admin`, `SERVICE_NAME` du support des
  tests) ; `LICENSES.md`, `09_DESIGN_SYSTEM_RULE.md`, `README.md`,
  `PROGRESS.md`.
- Reportees : les `export` superflus d'`apps/api` (hors perimetre de la
  refonte, listes dans `evidence/phase14/knip-apres.txt`).

## 5. Reste ouvert

- Couverture unitaire basse de `web` et `admin` : le rendu des pages est tenu
  par Playwright, que Vitest ne compte pas.
- Provenance des 63 icones non attribuee dans le source (`LICENSES.md`).

## 6. Verification ECC

- Gates sans cache : lint, typecheck, test 34/34 (871 tests) ; couverture
  15/15 ; build 10/10 ; mutation 23/23.
- Images reconstruites, Playwright 58/58 ; CI GitHub verte sur `4003031`.
- Securite : aucune entree, route ou secret touche ; `returnDocument` ne
  change ni filtre ni projection.
