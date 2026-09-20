# PHASE 5 - MATCHING

## Statut

**TERMINEE**

## Date debut / fin

2026-09-20 / 2026-09-20

## Objectifs (statut par objectif)

- [x] `Match`, `MatchCandidate`, `DispatchBatch` (02_SPEC_ENGINEERING.md #98).
- [x] `Eligibility -> Ranking -> petit batch -> attente -> batch suivant ->
  expansion de rayon` (01_SPEC_PRODUCT.md #15), avec une vraie queue
  differee.
- [x] Ponderations administrables (01_SPEC_PRODUCT.md #97) — 5 signaux
  reels actifs, 4 a 0 faute de donnees (Decision 40).
- [x] `GeoService`/`DistanceService`/`TravelTimeService`/
  `TransportPricingService` + abstraction `MapProvider`.
- [x] Matching hybride AUTO / DIRECT (01_SPEC_PRODUCT.md #14).
- [x] Localisation approximative cote fournisseur (#17) — premier vrai
  consommateur d'`approximateCoordinates()` (Decision 36).
- [x] Statut de disponibilite fournisseur (#16), restreint (Decision 42).
- [x] Ecran client (suivi + expansion manuelle) et **premier ecran
  fournisseur**, scenario Playwright reel.
- [x] **Bonus** : `packages/ui`, design system partage (#82), 8
  composants, branche dans `apps/web` et `apps/admin`.
- [ ] Notification reelle d'un fournisseur dispatche — hors perimetre
  (aucun canal de notification n'existe) ; le fournisseur consulte ses
  demandes dans son ecran.

**Criteres de sortie** : dispatch progressif teste (jamais d'envoi a
tous) ✅ ; expansion de rayon fonctionnelle ✅ ; gates verts ✅.

## Ce qui a ete fait

### 0. `packages/ui` — design system (bonus demande)

8 composants (`Button`, `Input`, `Card`, `Badge`, `Loading`/`Spinner`/
`Skeleton`, `EmptyState`, `ErrorState`, `Modal`), 52 tests. Tokens
`@fixiyi/design-tokens`, RTL par proprietes logiques, WCAG 2.2 AA
(focus visible, cibles >= 24px, `prefers-reduced-motion`, labels/erreurs
lies, dialogue avec piege de focus et restauration). Trois de ces
garanties sont verifiees par `styles.test.ts` plutot qu'affirmees
(Decision 45). Consomme par les 5 ecrans existants de `apps/web` et
`apps/admin`.

### 1. `packages/contracts` / `@fixiyi/shared-utils`

`matching.ts` (`Match`, `MatchCandidate`, `DispatchBatch`,
`ScoreBreakdown`, `ProviderMatch` — DTO fournisseur distinct, sans score
ni position exacte), `configuration.ts` (`MatchingWeights`,
`MatchingConfig`, `TransportConfig`), `transport.ts` (`TransportQuote`),
`provider.ts` (`ProviderAvailabilityStatus` + statuts auto-reglables).
`haversineDistanceKm()` rejoint `approximateCoordinates()` dans
`shared-utils/geo.ts`.

### 2. `apps/api/src/configuration/` — configuration administrable

`SystemConfiguration` (singleton Mongo), semee via `SeedLockService`,
**revalidee par Zod a chaque lecture et avant chaque ecriture**,
`GET`/`PATCH /configuration` reserves a ADMIN/MANAGER (Decision 44).

### 3. `apps/api/src/geo/` — distance, temps de trajet, transport

`GeoService` (haversine reel), `MapProvider` + `DevMapProvider` (estime
la duree depuis la distance et la vitesse moyenne administrable, fail-fast
si `MAP_PROVIDER` n'est pas `dev`/`fake`), `TransportPricingService`
(gratuit sous le seuil, tarif au km plafonne, fonction de calcul pure
testable — le fournisseur ne fixe jamais ce prix, #19).

### 4. `apps/api/src/matching/` — le moteur

- `EligibilityService` : filtres durs uniquement (service offert,
  **toutes** les competences requises — Decision 41 —, statut
  `AVAILABLE`, requete dans le rayon de recherche ET dans le rayon de
  deplacement declare par le fournisseur). Premiere utilisation reelle de
  l'index `2dsphere` prepare en Phase 3.
- `ranking.ts` : **fonction pure** (aucun Mongo, aucune horloge, aucun
  hasard) — 5 signaux reels, 4 a 0, tri deterministe, et `selectBatch`
  qui reserve des sieges d'exploration aux fournisseurs peu exposes (#15).
- `DispatchService` : batch borne, attente reelle (job BullMQ differe),
  expansion de rayon jusqu'au maximum administrable, expiration reelle
  des candidatures, arret propre si la demande quitte `MATCHING`.
- `MatchingService` / `MatchingController` : deux publics, deux DTO —
  le client voit qui a ete contacte et avec quel score, le fournisseur ne
  voit que sa propre dépêche et une position **approximee**.
- `MatchingProcessor` : premiere vraie queue metier du projet, hebergee
  dans `apps/api` (Decision 43).
- `RequestService.markMatching()` : transition `REQUESTED -> MATCHING`,
  laissee prete en Phase 4 (Decision 35) et branchee ici.

### 5. `apps/web` — suivi client et premier ecran fournisseur

`/requests/[id]/match` (statut, rayon, vagues, fournisseurs contactes
avec score, elargissement manuel du rayon) et `/provider/requests`
(demandes recues, zone approximative, devis de deplacement, refus).

## Tests

| Niveau | Ou | Resultat |
|---|---|---|
| Unit | `packages/ui` | 52 tests (8 composants + invariants CSS) |
| Unit | `packages/contracts` (matching, configuration) | +11 tests |
| Unit | `@fixiyi/shared-utils` (haversine) | +5 tests |
| Unit | `apps/api` `ranking.test.ts` (fonction pure) | 19 tests |
| Unit | `apps/api` `roles.guard.test.ts` (non-regression) | +2 tests |
| **Integration reelle** (Mongo+Redis+geo+BullMQ) | `test/matching.e2e.test.ts` | 11 tests |
| **Navigateur reel** | `tests/browser/matching.spec.ts` | 1 scenario, 4 captures |

`apps/api` : 121 -> **153 tests** (23 fichiers). `packages/contracts` :
58 -> **69**. `shared-utils` : 22 -> **27**. `packages/ui` : **52**
(nouveau). Total monorepo : **320 tests**.

> Correction d'inexactitude : `PHASE_4_REPORT.md` et `PROGRESS.md`
> annoncaient "65 tests contracts" et "25 shared-utils" a la fin de la
> Phase 4. Les chiffres reels etaient 58 et 22 (comptage verifie
> fichier par fichier). Les deux documents ont ete corriges.

## Commandes lancees et resultats

```
pnpm lint       -> 15/15 taches, 0 erreur
pnpm typecheck  -> 15/15 taches, 0 erreur
pnpm test       -> 13/13 taches (320 tests)
pnpm build      -> 10/10 taches
npx playwright test (tests/browser) -> 2/2 scenarios
```

Verification MongoDB reelle (`docker exec fixiyi-mongodb mongosh`) sur le
match cree par le scenario navigateur :

```
match : status ACTIVE, mode AUTO, radius 10km, batches 1,
        nextBatchAt 2026-09-20T21:24:30Z   (job differe reel)
candidats : 3 exactement, alors que plus de 3 fournisseurs etaient eligibles
  - nouveau fournisseur  score 0.78  (exploration 1)   -> DECLINED via l'UI
  - fournisseur existant score 0.68  (exploration 0)
  - fournisseur existant score 0.68  (exploration 0)
batch 0 : radiusKm 10, 3 candidats
```

L'ecart 0.78 / 0.68 est exactement le siege d'exploration de
01_SPEC_PRODUCT.md #15 : le fournisseur jamais dispatche passe devant
des fournisseurs identiques par ailleurs.

## Decisions prises

`docs/DECISIONS.md`, Decisions 40 a 46 : poids a 0 pour les signaux sans
donnees (40), competences requises en filtre dur (41), statuts de
disponibilite restreints (42), queue dans `apps/api` (43), configuration
en base + endpoint admin (44), design system `packages/ui` (45), et les
quatre bugs reels de la phase (46).

## Problemes rencontres

Format Symptome / Cause racine / Correction / Re-test — detail complet
dans la Decision 46.

1. **`@Roles` au niveau classe silencieusement ignore** par `RolesGuard`
   (lecture de `getHandler()` seul) : un controleur entier serait reste
   ouvert a tout utilisateur authentifie. Revele par TypeScript, corrige
   par `getAllAndOverride([handler, class])` + test de non-regression.
2. **BullMQ refuse un id de job contenant `:`** : chaque dispatch AUTO
   renvoyait une 500 apres avoir insere ses candidats. Corrige
   (`-batch-` comme separateur), re-teste par les 11 tests e2e.
3. **Redirection vers `/login` avant hydratation de zustand** : tout
   rafraichissement d'une page authentifiee deconnectait une session
   valide (`apps/web` ET `apps/admin`). Corrige par `useAuthHydrated()`,
   re-teste par le scenario Playwright fournisseur.
4. **Interference de donnees entre tests e2e** (fournisseurs globaux
   remplissant le batch du test suivant) : chaque test cree desormais son
   propre sous-arbre catalogue via la vraie API admin.

## Limitations / TODO documentes

- Aucun **canal de notification** : un fournisseur dispatche doit ouvrir
  son ecran. `Notification` n'est prevu par aucune phase du MVP.
- Aucun etat de succes du matching : une reponse de fournisseur est une
  `Offer` (Phase 7). `MATCHING` reste donc l'etat terminal cote demande
  en Phase 5.
- `TravelTimeService` **estime** (distance / vitesse moyenne) : aucun
  fournisseur de routage n'est provisionne (`MAP_PROVIDER=dev`).
- `MapProvider` ne declare que `estimateRoute` — `geocode`/
  `reverseGeocode` n'ont aucun appelant, `displayMap` est une
  preoccupation frontend.
- `TransportQuote` est purement informatif : rien n'est facture
  (Payment = Phase 9).
- Pas d'ecran d'administration de la configuration (Phase 12) ; pas
  d'`AuditLog` sur ses modifications (Phase 10/12) — seulement
  `updatedBy`/`updatedAt`.
- Pas d'onboarding fournisseur en UI : profil, services, zones et
  competences se configurent par l'API (les endpoints existent depuis la
  Phase 3). Le scenario Playwright fait donc cette preparation par API.
- Les candidatures expirent lors du passage d'un batch, pas a la seconde
  pres (aucun planificateur dedie).

## Prerequis pour la phase suivante

- `MatchCandidate` en `NOTIFIED`/`VIEWED` est exactement le point
  d'accroche des offres (Phase 7) : un fournisseur dispatche est le seul
  legitime a proposer un prix.
- `TransportQuote` fournit deja le cout de deplacement calcule par le
  systeme, sur lequel une offre pourra se baser.
- La configuration administrable est en place : `commissionRules`,
  `cancellationRules`, etc. n'auront qu'a s'y ajouter.

## Prochaine phase

Phase 6 - Chat (realtime, messages, attachments, anti-contact) —
**STOP, en attente de "GO PHASE 6"**.
