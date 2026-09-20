# PHASE 3 - MARKETPLACE

## Statut

**TERMINEE** — catalogue administrable, profils fournisseur, entreprises
et cycle de verification complets, testes reellement (101 tests
`apps/api`, dont un upload MinIO reel), back-office minimal fonctionnel.

## Date debut / fin

Debut : 2026-09-20 (immediatement apres reception de "GO PHASE 3")
Fin : 2026-09-20 (meme session)

## Objectifs (statut par objectif)

- ✅ Service Catalog hierarchique et administrable (`Domain > Category >
  Service > InterventionType > Complexity` + `Skill`) — modelise en une
  collection generique (voir Decision 26), seed realiste
  (Electricite/Plomberie, suivant l'exemple `01_SPEC_PRODUCT.md #235/#264`)
- ✅ Profils fournisseur (bricoleur/technicien/expert) — `ProviderProfile`
  avec competences, services, disponibilites, zones geospatiales
  (Decision 27)
- ✅ `VerificationCase` avec les etats documentes (`DRAFT, IN_REVIEW,
  NEEDS_CORRECTION, VERIFIED, REJECTED, SUSPENDED, EXPIRED`), decisions
  historisees, generique pour individus et entreprises (Decision 28)
- ✅ `Company`, `CompanyMember` (invitation/acceptation/retrait, regle du
  dernier OWNER)
- ✅ Onboarding progressif : le compte cree en Phase 2 devient fournisseur
  (deja possible) puis cree son `ProviderProfile` — pas de second compte
- ✅ Upload reel de documents de verification via MinIO (URL presignee +
  verification d'existence reelle avant de marquer "uploade" — Decision 29)
- ✅ **Premier branchement reel de `RolesGuard`** (`@Roles("ADMIN",
  "MANAGER")` sur l'ecriture du catalogue) et de `RateLimitService`
  reutilise tel quel
- ✅ Back-office minimal (`apps/admin`) : login OTP + ecran catalogue
  (creer/desactiver/reactiver des noeuds) — critere de sortie explicite
  de `docs/IMPLEMENTATION_PLAN.md`

**Criteres de sortie** : catalogue modifiable depuis un back-office
minimal ✅ ; cycle de verification complet teste ✅ (creation -> upload
reel -> confirmation -> soumission -> decision -> etat final) ; build
gates verts ✅.

## Ce qui a ete fait

### 1. `packages/contracts` — 4 nouveaux fichiers de schemas Zod

`catalog.ts` (`CatalogLevelSchema`, `CATALOG_PARENT_LEVEL`,
`CatalogNodeSchema`, `CatalogTreeNodeSchema` recursif, DTOs create/update),
`provider.ts` (`ProviderTypeSchema`, `GeoPointSchema`, `ServiceAreaSchema`,
`AvailabilitySlotSchema`, `ProviderProfileSchema` + DTOs), `company.ts`
(`Company`/`CompanyMember` + DTOs, invite limite a `MEMBER`/`TECHNICIAN`),
`verification.ts` (`VerificationCase`/`Document`/`Decision` + DTOs upload/
decision). 26 nouveaux tests.

### 2. `apps/api/src/catalog/` — module generique + RBAC reel

`CatalogNodeEntity` (1 collection, `level` discriminant), `CatalogService`
(CRUD + validation de la regle de parente + validation des
`requiredSkillIds`), `CatalogController` (`GET /tree` et `/skills`
publics, `POST/PATCH/DELETE /nodes` proteges par
`AuthGuard + RolesGuard(@Roles("ADMIN","MANAGER")) + CsrfGuard`),
`CatalogSeedService` (seed idempotent et **race-safe**, voir Decision 31).

### 3. `apps/api/src/providers/` — profils self-service

`ProviderProfileEntity` (4 sous-agregats embarques, index `2dsphere` sur
les zones), `ProviderService`, `ProviderController` (`GET /:id` public,
`POST/PATCH /me` proteges par `@Roles("PROVIDER")` — le role accorde en
Phase 2).

### 4. `apps/api/src/companies/` — entreprises

`CompanyEntity`/`CompanyMemberEntity`, `CompanyService` (creation avec
OWNER automatique, invitation par telephone d'un utilisateur **deja
inscrit**, acceptation, retrait avec regle "jamais retirer le dernier
OWNER actif"), `CompanyController`.

### 5. `apps/api/src/verification/` + `apps/api/src/infrastructure/storage/`

`StorageService` (SDK S3 officiel contre MinIO, `forcePathStyle: true`,
creation idempotente du bucket au demarrage, URL PUT presignee, `HeadObject`
pour verifier une vraie existence avant de marquer un document `UPLOADED`),
`VerificationCaseEntity`/`DocumentEntity`/`DecisionEntity`,
`VerificationService` (machine a etats validee, ownership generique
provider/company), `VerificationController`
(`@Roles("VERIFICATION_AGENT","ADMIN")` sur la decision — 2e branchement
reel de RBAC).

### 6. `apps/admin` — premier ecran metier reel

`src/lib/auth-store.ts` (zustand, premier usage reel depuis son
installation Phase 1), `src/lib/api-client.ts` (fetch + Bearer token,
Decision 33), `src/app/login/page.tsx` (OTP), `src/app/catalog/page.tsx`
(arbre du catalogue via TanStack Query — premier usage reel depuis son
installation Phase 1 -, creation/desactivation de noeuds).

## Fichiers crees / modifies

Resume : 4 fichiers `packages/contracts/src/` (+4 tests), ~30 fichiers
`apps/api/src/{catalog,providers,companies,verification,common/seed,
infrastructure/storage}/`, 6 nouveaux fichiers de test e2e
(`test/{catalog,provider,company,verification}.e2e.test.ts`,
`test/otp-test-helper.ts`, `test/rate-limit-test-helper.ts`), 6 fichiers
`apps/admin/src/{lib,app/login,app/catalog}/`, modifications ciblees
(`apps/api/src/{app.module.ts,auth/auth.module.ts,catalog/catalog.service.ts,
providers/provider.service.ts,companies/company.service.ts},
apps/api/package.json, apps/api/vitest.config.mts, apps/admin/{package.json,
src/app/page.tsx}`).

## Tests

| Niveau | Ou | Resultat |
|---|---|---|
| Unit | `packages/contracts` (catalog/provider/company/verification) | 26 nouveaux tests OK |
| **Integration reelle** (Mongo+Redis+HTTP) | `test/catalog.e2e.test.ts` | 9 tests OK — RBAC reel, validation de parente, soft-delete |
| **Integration reelle** | `test/provider.e2e.test.ts` | 5 tests OK — role PROVIDER, refs catalogue, geospatial |
| **Integration reelle** | `test/company.e2e.test.ts` | 6 tests OK — invite/accept/remove, dernier OWNER |
| **Integration reelle + MinIO reel** | `test/verification.e2e.test.ts` | 2 tests OK — cycle complet avec vrai PUT HTTP sur URL presignee |

**Total `apps/api` : 101 tests, tous passent** (19 fichiers). Monorepo
complet : `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -> 13/13,
13/13, 11/11, 9/9 taches, 0 erreur, 0 warning.

## Commandes lancees et resultats (extraits)

```
$ pnpm --filter @fixiyi/api test
 Test Files  19 passed (19)
      Tests  101 passed (101)

$ curl -X PUT "<url presignee MinIO>" -H "Content-Type: application/pdf" --data-binary @cin.pdf
HTTP 200   # upload reel verifie par HeadObject avant confirmation

$ curl -H "Origin: http://localhost:3005" -X POST http://localhost:4000/api/v1/auth/otp/request ...
HTTP 201, access-control-allow-origin: *   # confirme le flux Bearer cross-origin de l'admin
```

## Decisions prises

Voir `docs/DECISIONS.md`, Decisions 26 a 34 :

26. Catalogue : 1 collection Mongo generique au lieu de 6.
27. `ProviderProfile` embarque ses 4 sous-agregats.
28. `VerificationCase` generique sur `targetType` (couvre aussi
    `CompanyVerification`).
29. Upload de documents de verification : MinIO reel, pas le pipeline
    media generique de la Phase 4.
30. Nouvelle dependance `@aws-sdk/client-s3` + `s3-request-presigner`.
31. Bug reel : race condition sur le seed du catalogue, corrige par un
    verrou distribue en 2 phases (`SeedLockService`).
32. Bug reel : rate limiting partage entre fichiers de test e2e, corrige
    par execution sequentielle (`fileParallelism: false`) + nettoyage
    systematique.
33. Back-office admin : authentification par Bearer token en memoire
    (zustand), pas par cookies.
34. Back-office : creation de noeud via `window.prompt()`, pas un
    formulaire modal.

## Problemes rencontres

**6 bugs reels trouves et corriges**, en plus des 2 decisions-bugs
26/31/32 deja detaillees ci-dessus :

1. **Race condition sur le seed du catalogue** (Decision 31) — plusieurs
   instances Nest de test bootant en parallele contre la meme base vide
   creaient des doublons (`E11000`). Corrige par un verrou distribue en
   2 phases (acquisition + attente de completion par les perdants).
2. **Rate limiting partage entre fichiers e2e** (Decision 32) — memes
   compteurs Redis, meme IP loopback, exécution parallele par Vitest.
   Corrige par `fileParallelism: false` + nettoyage systematique dans un
   helper de test partage.
3. **`z.infer` vs `z.input` sur les champs `.default()`** — `order`
   (catalogue) et `languages` (provider) devenaient obligatoires dans le
   type TypeScript exporte (`z.infer` = type de sortie, post-defaut) alors
   que l'API les accepte optionnels. Corrige en remplacant `.default(x)`
   par `.optional()` dans les schemas d'entree, le defaut etant applique
   explicitement dans le service (`input.order ?? 0`).
4. **Prefixe de telephone de test invalide** — `+2129...` (choisi pour
   varier le prefixe entre fichiers de test) n'est pas un prefixe mobile
   marocain reel (seuls 6/7 le sont) ; `libphonenumber-js` le rejetait
   reellement (400). Corrige en revenant a `+2126...` partout.
5. **`Next.js`/Turbopack resout les imports relatifs differemment de
   `apps/api`** — les fichiers `apps/admin` ecrits avec des imports
   suffixes `.js` (convention NodeNext utilisee dans `apps/api`) echouaient
   au build (`Module not found`) : le preset `packages/tsconfig/nextjs.json`
   utilise `moduleResolution: "Bundler"`, qui attend des imports relatifs
   **sans extension**. Corrige en retirant le suffixe `.js` de tous les
   imports relatifs de `apps/admin`.
6. **`fetch()` et `exactOptionalPropertyTypes`** — passer `body: undefined`
   a `fetch()` echouait au typecheck (`RequestInit.body` est
   `BodyInit | null`, pas `| undefined`). Corrige en passant `null`.

Tous corriges et re-testes ; gates complets verts apres chaque correction.

## Limitations / TODO documentes

- Back-office : pas d'edition de `description`/`order`, pas de gestion de
  `requiredSkillIds` depuis l'UI (Decision 34) — l'API les supporte deja.
- `ResourceOwnerGuard` : toujours prepare, non branche (aucune ressource
  au sens strict du guard generique - les ownership checks reels de cette
  phase, provider/company, sont des lookups DB inline, pas juste une
  comparaison directe de parametre).
- Pas de scan antivirus sur les documents de verification (Decision 29) -
  a revisiter avec le pipeline media generique de la Phase 4.
- Pas d'ecran client (`apps/web`) pour parcourir le catalogue ou creer un
  profil - uniquement les endpoints API (coherent, aucun ecran client
  n'existe encore dans le produit).
- Regle d'expiration (`EXPIRED`) du cycle de verification : etat present
  dans le schema, aucune logique automatique de passage a cet etat
  (necessiterait un job planifie, hors perimetre Phase 3).
- Suite de tests `apps/api` plus lente (fichiers e2e sequentiels,
  Decision 32) - ~30-60s au lieu de ~15-20s, juge acceptable.

## Prerequis pour la phase suivante

Tous remplis pour demarrer la Phase 4 (Requests) :

- Catalogue de services reel et interrogeable (`GET /catalog/tree`) pour
  qu'une demande puisse referencer un `Service`/`InterventionType`/
  `Complexity` reel.
- Profils fournisseur et entreprises operationnels - une demande pourra
  etre matchee (Phase 5) a de vrais `ProviderProfile`.
- `StorageService` (MinIO reel, URL presignees) directement reutilisable
  pour les medias de `ServiceRequest` for pipeline generique de la Phase 4
  (`CreateUploadSession -> ... -> Finalize`).
- `RolesGuard` et `RateLimitService` ont maintenant plusieurs
  consommateurs reels au-dela de l'auth - le pattern est valide.

## Prochaine phase

**Phase 3 - Marketplace TERMINEE.** Conformement a `06_SCOPE.md` (regle
d'arret absolue : jamais de phase suivante sans validation humaine
explicite), **STOP et attente de "GO PHASE 4"**.
