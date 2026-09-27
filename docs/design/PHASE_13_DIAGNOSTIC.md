# PHASE 13 (REFONTE) — TESTS — DIAGNOSTIC

Date : 2026-09-27. Plan : `PHASE_13_PLAN.md`. Preuves :
`docs/design/evidence/phase13/`.

## 1. Audit mesure

| Instrument | Mesure | Critere |
|---|---|---|
| Couverture vitest **par fichier** (`web`, `admin`) | 27 + 9 fichiers | logique critique sans test |
| Stryker 10 (rejete, §4.1) | 767 mutants sur `web/src/lib` | — |
| **Harnais de mutation cible** (`scripts/mutation/`) | 24 mutants, un par regle nommee | chaque mutant tue, ou equivalent justifie |
| Suite Playwright **en ordre inverse**, fichier par fichier | 11 fichiers, 58 scenarios | 58/58 |
| Suite Playwright, ordre normal | 2 passes enchainees | 58/58 |

## 2. Defauts reels

### 2.1 La logique de session du client n'avait aucun test unitaire

- **Mesure** : `web/lib/api-client.ts` 10 % de lignes, `admin/lib/api-client.ts`
  0 %. Harnais « avant » : les **9** mutants de `web` et les **3** de `admin`
  survivent, dont `refreshInFlight ??=` -> `=`, c'est-a-dire le correctif B1
  lui-meme.
- **Impact** : B1 (Decision 51) tient a une ligne. Deux rafraichissements en
  parallele et la detection de rejeu du refresh token **revoque la session**.
  Le seul filet etait `session-refresh.spec.ts`, qui ne peut pas provoquer
  deux 401 au meme instant. Une regression serait passee.
- **Correction** : `api-client.test.ts` dans `web` (9 tests) et `admin` (3),
  contre un faux serveur qui ne connait qu'un jeton valide : un seul refresh
  pour trois appels expires ensemble, un nouveau refresh a l'expiration
  suivante, session videe si le refresh meurt, utilisateur conserve, un 401
  **non authentifie** (mauvais OTP) ne touche jamais la session, en-tete JSON
  seulement avec un corps, code Problem Details conserve, televersement refuse
  = erreur.

### 2.2 Les deux regles pures du chat n'avaient aucun test

- **Mesure** : `upsertMessages` et `applyReceipts`, exportees et pures, 0 %.
  Harnais « avant » : **7** mutants survivent.
- **Impact** : ce sont elles qui rendent sans danger un evenement recu deux
  fois, en retard ou dans le desordre (#49, #50) : pas de doublon, pas de
  retour a une version plus ancienne, jamais un accuse qui recule.
- **Correction** : `use-chat-thread.test.ts`, 10 tests.

### 2.3 `startRouteFor` (Decision 65) et `pageTitle` de l'admin sans test

- 2 + 1 mutants survivaient. `start-route.test.ts` (3 tests),
  `admin/lib/segment-layout.test.ts` (1). Le second etait releve LOW en
  phase 11.

### 2.4 La suite navigateur dependait de son ordre

- **Mesure** (`ordre-inverse-avant.txt`) : en ordre inverse,
  `matching.spec.ts` echoue ; seul, il passe.
- **Cause lue dans Mongo** : le match AUTO de ce test (description « …
  demande de Playwright Pro 9255 ») a envoye son premier lot de 3 a **Nav Pro,
  Nav RTL, Nav Phone**, crees et laisses disponibles par `navigation.spec.ts`
  juste avant. Son propre artisan n'est arrive qu'au lot suivant, deux minutes
  plus tard. Le moteur a raison : des artisans neufs gagnent la place
  d'exploration. La suite, elle, laissait des artisans disponibles derriere
  elle — **282** accumules dans la base de dev.
- **Correction** : `setUpProvider` enregistre chaque artisan cree ; la
  fixture de `support/test.ts` les passe hors ligne a la fin de chaque test
  (Decision 84). Les 282 artisans de test restants ont ete passes hors ligne
  une fois ; leurs identifiants sont gardes
  (`artisans-test-remis-offline.json`), l'operation est reversible.
- **Apres** : ordre inverse 58/58, **0** artisan disponible apres la passe.

## 3. Mutants : avant / apres

| Groupe | Mutants | Avant | Apres |
|---|---|---|---|
| `web` api-client | 9 | 0 tue | 9 |
| `admin` api-client + titre | 4 | 0 | 4 |
| chat (`upsertMessages`, `applyReceipts`) | 7 (+1 equivalent) | 0 | 7 |
| `arrivals` (phase 12) | 2 | **2** | 2 |
| `startRouteFor` | 2 | 0 | 2 |
| **Total** | **24 (+1)** | **2/24** | **23/23** + 1 equivalent |

Les deux mutants de `arrivals`, tues des l'« avant », sont le **controle** du
harnais : il voit un kill la ou il y a un test.

**Le mutant equivalent** (`chat-receipts-deleted`, retrait de la garde
`deliveryStatus === null`) : a l'execution `STATUS_RANK[null]` vaut
`undefined` et `2 > undefined` est faux — meme comportement. Aucun test ne
peut le distinguer ; **le typage, si** : TS2538, donc la gate `typecheck` le
tue. Marque `equivalent` dans `mutants.json`, avec cette raison.

## 4. Faux defauts et instruments rejetes

### 4.1 Stryker : un instrument qui ne voit pas un kill connu

Stryker 10 (`@stryker-mutator/vitest-runner`, installe hors du depot) sur
`web/src/lib` : 767 mutants, **score 7,4 %**, et **0 tue sur les 16 mutants
de `arrivals.ts`**, dont les 7 tests verifient les valeurs exactes.

- Premiere erreur de ma part : le bac a sable place sous `node_modules/`, que
  Vitest exclut — « No tests were found ». Corrige.
- Ensuite, 62 tests executes, et toujours 0 tue, meme en
  `coverageAnalysis: off`.
- **Controle manuel** : le meme mutant (`current !== null` -> `false`)
  applique a la main fait echouer un test. Le test mord ; l'instrument ne voit
  pas qu'il mord. Les seuls « tues » de Stryker etaient dans des tables
  evaluees au chargement du module : l'activation a l'execution ne passe pas
  avec Vitest 5.
- **Rejete.** Sorties gardees (`stryker-instrument-faux.*`) comme preuve.
  Remplace par un harnais cible et transparent, verifie par son controle.

### 4.2 Une premiere hypothese fausse sur l'ordre

`navigation` puis `matching`, rejoues a la main : vert. Le depart a egalite
entre artisans neufs rend l'echec intermittent ; c'est la base, pas la
reproduction, qui a donne la cause.

### 4.3 Mes propres tests, pris par les gates

La premiere passe de lint a echoue sur **mes** nouveaux tests
(`require-await`, assertion inutile), et `persist` de zustand ecrivait un
avertissement par test faute de `localStorage` en Node (risque annonce au
plan). Corriges : faux `fetch` sans `async` inutile, stockage en memoire
installe avant le magasin.

## 5. Corrections appliquees / retirees / reportees

- **Faites** : §2.1 a §2.4 ; planchers releves ; `test:mutation` a la racine
  (sort en erreur si un mutant survit) ; `passWithNoTests` retire de
  `admin`, qui a maintenant des tests (un fichier de test supprime ferait
  echouer la suite au lieu de passer en silence).
- **Non fait, volontairement** : tests de composants React de `apps/web`
  (pas de DOM dans sa configuration ; couverts par `packages/ui` et
  Playwright).
- **Reporte en phase 14** : 24 `PARSE_ERROR` dans la sortie de couverture de
  `web` et `admin` (deja presents en phases 11 et 12, sans effet sur le
  chiffre ni sur la sortie) ; `outputDir` Playwright partage avec les
  captures nommees ; avertissement de depreciation Mongoose (`new` ->
  `returnDocument`).

## 6. Reste ouvert

- `useChatThread` lui-meme (le crochet : sockets, minuteries) reste couvert
  par `chat.spec.ts` seulement ; ses deux regles pures le sont desormais par
  des tests unitaires.
- `realtime.ts` (reconnexion avec un seul refresh) : 0 % unitaire, exerce par
  Playwright. Il partage la promesse de `refreshSession`, desormais testee.

## 7. Verification ECC

| Regle | Resultat |
|---|---|
| `console.log` en production | aucun ; le harnais ecrit sur `stdout`, c'est sa sortie |
| Fonctions < 50 lignes | harnais : `runMutant` 16 lignes ; tests courts |
| Fichiers < 800 lignes | le plus long ajoute : `api-client.test.ts`, 148 |
| `any` | aucun |
| Couverture | `web` 20,6 % -> **38,0 %**, `admin` 0 % -> **64,6 %** ; planchers releves (37/36/29/46 et 64/63/50/53) |
| Rate limiting | aucune route touchee |
| Regle 3bis | Stryker essaye d'abord (outil reconnu), rejete sur mesure ; axe de phase 11 : meme principe « rien ajoute au depot » |
