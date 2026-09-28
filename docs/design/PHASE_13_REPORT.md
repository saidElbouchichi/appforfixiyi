# PHASE 13 (REFONTE) — TESTS — RAPPORT

Date : 2026-09-27. Statut : **TERMINEE**. Plan : `PHASE_13_PLAN.md`.
Diagnostic : `PHASE_13_DIAGNOSTIC.md`. Preuves : `evidence/phase13/`.

## 1. Objectif et resultat

« Unit, e2e, captures — consolidation » (`PLAN.md`), avec une exigence :
**verifier que les tests mordent**, par la mesure.

- **O1** — la logique critique du client sans test en a un. Trouvee par la
  couverture **par fichier**, pas par paquet : le rafraichissement a un seul
  vol (B1) dans `web` et `admin`, les regles pures du chat, l'ecran de
  depart, les titres de l'admin.
- **O2** — les tests mordent : **2/24 mutants tues avant, 23/23 apres**, plus
  un mutant equivalent que seul le typage peut tuer (et tue).
- **O3** — la suite navigateur ne depend plus de son ordre : en ordre
  inverse, `matching` echouait ; cause lue dans Mongo, corrigee, **58/58**.
- **O4** — planchers de couverture releves : `web` 20,6 -> **38,0 %**,
  `admin` 0 -> **64,6 %**. *Corrige en phase 14 (Decision 86) : ces
  chiffres excluaient les pages (`PARSE_ERROR`) ; mesure honnete `web`
  16,4 %, `admin` 22,3 %.*

Aucune source livree n'a change : seulement des tests, deux configurations
et le support des tests. Les images n'avaient donc pas a etre reconstruites.

## 2. Fichiers

- `apps/web/src/lib/{api-client,use-chat-thread,start-route}.test.ts`
- `apps/admin/src/lib/{api-client,segment-layout}.test.ts`
- `apps/{web,admin}/vitest.config.mts` (planchers ; `passWithNoTests` retire
  de `admin`)
- `scripts/mutation/{run.mjs,mutants.json}`, script racine `test:mutation`
- `tests/browser/support/{journeys,test}.ts` (artisans hors ligne apres
  chaque test)

## 3. Tests

| Suite | Avant | Apres |
|---|---|---|
| `apps/web` (vitest) | 66 | **88** |
| `apps/admin` (vitest) | 0 | **4** |
| Monorepo (vitest) | 849 | **871** |
| Playwright | 58 | 58 — deux passes enchainees **et** une passe en ordre inverse |
| Mutants tues (harnais) | 2/24 | **23/23** + 1 equivalent |

Chaque nouveau test a ete vu rouge : c'est exactement ce que mesure le
harnais « avant » (22 survivants), puis « apres » (0).

## 4. Commandes

```
pnpm turbo run lint typecheck test build --force   # 15/15, 15/15, 14/14, 10/10, 0 avertissement
pnpm test:coverage                                 # 15/15, nouveaux planchers
pnpm test:mutation                                 # 23/23, code de sortie 0
cd tests/browser && npx playwright test            # 58/58 (x2)
for f in $(ls tests | sort -r); do npx playwright test tests/$f; done   # 58/58
```

## 5. Decisions

- **84** — chaque test Playwright passe hors ligne les artisans qu'il a crees.
- **85** — la mutation se mesure par un harnais cible ; Stryker rejete sur
  mesure (il ne voyait pas un kill connu avec Vitest 5).

## 6. Problemes rencontres

- Stryker : 0 tue sur un fichier dont les tests tuent le meme mutant a la
  main. Instrument rejete, preuve gardee.
- Ma premiere hypothese sur l'ordre (reproduire a la main) n'a pas reproduit ;
  la base de donnees a donne la cause.
- Mes nouveaux tests ont d'abord echoue au lint, et bruite la sortie
  (`localStorage` absent en Node). Corriges avant le commit.

## 7. Limitations

- Le harnais de mutation couvre 24 regles choisies, pas tout le code : c'est
  une mesure ciblee, pas un score global.
- `useChatThread` (le crochet) et `realtime.ts` restent couverts par
  Playwright seulement.
- Pas de test de composants React dans `apps/web` (hors perimetre, §6 du
  plan).

## 8. Prerequis et prochaine phase

Gates, couverture, mutation et Playwright verts. Prochaine : **phase 14,
nettoyage** (enchainee, Decision 81), avec trois points deja identifies :
`PARSE_ERROR` de couverture, `outputDir` Playwright partage avec les captures
nommees, depreciation Mongoose.
