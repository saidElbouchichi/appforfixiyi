# PHASE 13 (REFONTE) — TESTS — PLAN

Date : 2026-09-27. Enchainee sans GO intermediaire (Decision 81).

Sources lues : `docs/PROGRESS.md`, `docs/DECISIONS.md` (74, 81 a 83),
`PHASE_12_REPORT.md` et `PHASE_12_DIAGNOSTIC.md`, `PLAN.md` (ligne 24 :
« Tests | unit, e2e, captures — consolidation »), `AUDIT.md`.

## 1. Point de depart (mesure du 2026-09-27)

849 tests unitaires, 58 scenarios Playwright, 11 suites e2e d'API. Couverture
par paquet de 88 a 100 %, sauf `web` (20,6 %) et `admin` (0 %), que la
Decision 74 explique : ils sont exerces par Playwright, que vitest ne voit pas.

Mais le detail par fichier dit autre chose que « c'est de l'interface » :

| Fichier | Lignes | Couvert | Ce qu'il porte |
|---|---|---|---|
| `web/lib/api-client.ts` | 40 | **10 %** | le rafraichissement a un seul vol (B1, Decision 51) : deux en parallele et la detection de rejeu revoque la session |
| `admin/lib/api-client.ts` | 37 | **0 %** | le meme, en copie (Decision 51) |
| `web/lib/use-chat-thread.ts` | 174 | **0 %** | `upsertMessages` et `applyReceipts`, **exportees et pures** : pas de doublon, pas de retour en arriere, jamais un accuse qui recule |
| `admin/lib/segment-layout.tsx` | 3 | 0 % | releve LOW en phase 11 |
| `web/lib/start-route.ts` | 2 | 0 % | ecran de depart par role (Decision 65) |

Ce ne sont pas des composants : c'est de la logique, testable en `node`, et
precisement celle qu'un scenario navigateur declenche mal (deux 401 au meme
instant, un accuse perime qui arrive en retard).

## 2. Objectifs

- **O1** — chaque regle critique du client listee au §1 a un test unitaire
  qui la nomme.
- **O2** — **les tests mordent**, mesure et non affirme : score de mutation
  (Stryker 10, lance ponctuellement, rien ajoute au depot) sur
  `apps/web/src/lib` avant et apres ; chaque mutant survivant est examine.
- **O3** — **la suite navigateur ne depend pas de son ordre** : les onze
  fichiers rejoues en ordre inverse, un par un. Les phases 11 et 12 ont trouve
  trois dependances cachees (vagues AUTO, connexion rendue trop tot, quota) ;
  il n'y a pas de raison qu'il n'y en ait plus.
- **O4** — planchers de couverture releves au niveau atteint (Decision 74 :
  seulement vers le haut).

## 3. Methode et criteres

| # | Mesure | Critere |
|---|---|---|
| O1 | liste du §1 | un test par regle, vu rouge contre une mutation de la regle |
| O2 | score Stryker par fichier de `web/lib` | chaque survivant est tue par un test, ou justifie (mutant equivalent) |
| O3 | suite en ordre inverse, fichier par fichier | 58/58 |
| O4 | `pnpm test:coverage` | planchers `web` et `admin` releves ; aucun baisse |

L'instrument est verifie avant d'etre cru : un score de mutation n'a de sens
que si Stryker execute bien les tests du paquet (nombre de tests lus dans sa
sortie, et un mutant connu tue).

## 4. Ordre

1. Mesure O2 « avant » et O3.
2. Tests O1, un fichier a la fois, chacun vu rouge par mutation manuelle.
3. Mesure O2 « apres » ; tuer ou justifier les survivants.
4. O4, gates sans cache, Playwright complet, diagnostic, rapport, commit.

## 5. Risques

- **Tester l'implementation plutot que la regle** : les tests portent sur ce
  qu'un utilisateur perdrait (sa session, un message, un accuse), pas sur la
  forme du code.
- `auth-store` utilise `localStorage` via `persist` : en `node`, le magasin
  fonctionne en memoire ; ce qu'il persiste est deja couvert par Playwright.
- Stryker est lourd : borne a `apps/web/src/lib`.

## 6. Hors perimetre

Tests de composants React de `apps/web` (pas de DOM dans sa configuration de
test ; les composants sont testes dans `packages/ui` et par Playwright).
