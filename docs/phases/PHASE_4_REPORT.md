# PHASE 4 - REQUESTS

## Statut

**TERMINEE**

## Date debut / fin

2026-09-20 / 2026-09-20

## Objectifs (statut par objectif)

- [x] Creation de demande par le client (texte, service depuis le
  catalogue, urgence, localisation) — 01_SPEC_PRODUCT.md #10.
- [x] Pipeline media generique reel (upload MinIO reel, scan de
  signature binaire, extraction de metadonnees) — 02_SPEC_ENGINEERING.md
  #124.
- [x] Machine a etats `ServiceRequest`, volontairement reduite
  (Decision 35).
- [x] Localisation : position exacte stockee, approximation preparee
  mais non branchee (Decision 36).
- [x] Premier ecran client reel dans `apps/web` (login OTP + creation de
  demande complete).
- [x] Nouveau workspace `tests/browser` (Playwright installe et pilote
  reellement, captures d'ecran).
- [x] Tests unitaires + e2e reels (Mongo/Redis/MinIO Docker).
- [x] Gates monorepo verts (lint/typecheck/test/build).
- [x] Verification manuelle : curl direct, MongoDB reel, MinIO reel, ET
  navigateur reel (Playwright).
- [ ] IA de structuration de la demande (#11) — hors perimetre, prevu
  Phase 11 (V2), fallback formulaire classique utilise.

## Ce qui a ete fait

### 1. `packages/contracts` — nouveaux schemas + deplacement d'une primitive

- `common.ts` : `GeoPointSchema` deplace depuis `provider.ts` (2
  consommateurs reels desormais).
- `location.ts` (nouveau) : `RequestLocationSchema`/`RequestLocationInputSchema`.
- `media.ts` (nouveau) : `MediaTargetTypeSchema`, `MediaKindSchema`,
  `MediaStatusSchema`, `MEDIA_KIND_BY_CONTENT_TYPE`,
  `MEDIA_MAX_SIZE_BYTES`, `MediaSchema`, `CreateUploadSessionInputSchema`,
  `CreateTargetMediaUploadSessionInputSchema`,
  `CreateUploadSessionOutputSchema`.
- `request.ts` (nouveau) : `RequestUrgencySchema`, `RequestStatusSchema`,
  `ServiceRequestSchema`, `UpdateServiceRequestInputSchema`.
- `@fixiyi/shared-utils` : `geo.ts` — `approximateCoordinates()`, pure,
  testee, non branchee (Decision 36).

### 2. `apps/api/src/media/` — pipeline generique, sans controleur

- `schemas/media.schema.ts` — `MediaEntity` (`targetType`/`targetId`,
  mirroring Decision 28).
- `media-signature.ts` (+ 13 tests) — verification reelle des magic
  bytes (JPEG/PNG/WEBP, MP4/WEBM, MP3/WAV/OGG), ecrite a la main.
- `media-metadata.ts` — extraction reelle des dimensions image via
  `image-size` (nouvelle dependance, zero dependance transitive).
- `media.service.ts` — `createUploadSession`, `finalize` (Scan
  signature + taille reelle -> Process metadonnees -> Finalize),
  `listReadyIdsForTarget`, `listForTarget`. Rejet automatique
  (`REJECTED` + raison) si Scan echoue — decision system-driven, pas
  humaine (different de `VerificationCase`, documente Decision 37).
- `media.module.ts` — pas de controleur (voir Decision 37) ; exporte
  `MediaService`, consomme par `RequestModule`.

### 3. `apps/api/src/requests/` — demandes client

- `schemas/service-request.schema.ts` — `ServiceRequestEntity`
  (localisation embedded, index `2dsphere` prepare pour la Phase 5, non
  interroge).
- `request.service.ts` — `create`, `listMine`, `getById`, `update`
  (revalide toute la chaine catalogue service/type/complexite a chaque
  modification), `createMediaUploadSession`, `finalizeMedia`,
  `listMedia`, `submit` (`DRAFT -> REQUESTED`, exige tous les champs),
  `cancel` (`DRAFT`/`REQUESTED -> CANCELLED`).
- `request.controller.ts` — possede aussi les routes media
  (`POST/GET /requests/:id/media`, `POST .../media/:mediaId/finalize`)
  pour centraliser la validation de propriete/editabilite avant tout
  appel au pipeline generique.
- `apps/api/src/catalog/catalog.service.ts` : nouvelle methode
  `getById()` (non-throwing), reutilisee pour valider la chaine
  parent-enfant service -> type d'intervention -> complexite.
- `apps/api/src/infrastructure/storage/storage.service.ts` : nouvelles
  methodes `headObject()`, `readObjectPrefix()` ; second `S3Client`
  (`publicClient`) pour signer les URLs presignees contre un hote
  joignable par le navigateur (Decision 39).

### 4. `apps/web` — premier ecran client reel

- `src/lib/config.ts`, `auth-store.ts` (Bearer + zustand, Decision 38),
  `api-client.ts` (+ `uploadFile()` pour le PUT direct vers MinIO).
- `src/app/login/page.tsx` — login OTP (meme flux que `apps/admin`).
- `src/app/requests/new/page.tsx` — creation de demande complete :
  selection en cascade dans le vrai catalogue (Domaine -> Categorie ->
  Service -> Type -> Complexite), description, urgence, position reelle
  (Geolocation API du navigateur), upload de fichiers reel (pipeline
  media complet cote client), soumission.
- `src/app/page.tsx` — redirection selon session (meme pattern
  qu'`apps/admin`).

### 5. `tests/browser/` — nouveau workspace Playwright

- `tests/` etait reserve depuis la Phase 1 (jamais rempli) — rempli ici.
- `@playwright/test` installe, Chromium telecharge reellement
  (`npx playwright install chromium`).
- `tests/create-request.spec.ts` — scenario complet reel : login OTP
  (lecture du `devCode` affiche a l'ecran), remplissage du formulaire,
  geolocalisation (permission + coordonnees simulees Playwright),
  upload d'un vrai fichier PNG, soumission, verification du statut
  `REQUESTED` et du compteur de medias. Captures d'ecran a 4 etapes cles
  (`tests/browser/screenshots/01-*.png` a `04-*.png`).

## Fichiers crees / modifies (principaux)

- `packages/contracts/src/{common,location,media,provider,request}.ts` (+
  tests correspondants)
- `packages/shared-utils/src/geo.ts` (+ test)
- `apps/api/src/media/**`, `apps/api/src/requests/**`
- `apps/api/src/catalog/catalog.service.ts` (ajout `getById`)
- `apps/api/src/infrastructure/storage/storage.service.ts` (ajout
  `headObject`, `readObjectPrefix`, second client de signature)
- `apps/api/src/app.module.ts` (ajout `MediaModule`, `RequestModule`)
- `apps/api/src/main.ts` (CORS explicite)
- `apps/api/test/request.e2e.test.ts` (nouveau, 7 tests)
- `packages/config/src/env-schema.ts` (`STORAGE_PUBLIC_ENDPOINT`)
- `docker-compose.dev.yml` (`STORAGE_PUBLIC_ENDPOINT` pour `api`)
- `.env.example` (documentation de la nouvelle variable)
- `apps/web/**` (nouveau contenu), `apps/web/package.json`
  (`@fixiyi/contracts`)
- `apps/admin/src/lib/api-client.ts` (meme correction Content-Type que
  `apps/web`, bug latent partage)
- `tests/browser/**` (nouveau workspace), `pnpm-workspace.yaml`

## Tests

- `packages/contracts` : 57 -> 65 tests (+8 : `location`, `media`,
  `request`).
- `packages/shared-utils` : 22 -> 25 tests (+3 : `geo`).
- `apps/api` : 114 -> 121 tests apres ajout de `media-signature.test.ts`
  (13 tests) et `request.e2e.test.ts` (7 tests reels, incluant un vrai
  upload/rejet MinIO).
- `tests/browser` : 1 scenario Playwright reel, execute avec succes
  contre la stack Docker complete.

## Commandes lancees et resultats (extraits)

```
pnpm --filter @fixiyi/api test        -> 21 fichiers, 121 tests, PASS
pnpm lint                              -> 13/13 taches, PASS
pnpm typecheck                         -> 13/13 taches, PASS
pnpm test                              -> 11/11 taches, PASS
pnpm build                             -> 9/9 taches, PASS
npx playwright test (tests/browser)    -> 1/1, PASS
```

Verification manuelle par `curl` direct contre l'API Docker (port 4000) :
OTP request/verify -> creation DRAFT -> PATCH complet (chaine
catalogue + description + urgence + localisation) -> creation de
session d'upload -> PUT reel vers l'URL presignee MinIO
(`http://localhost:9000/...`, 200) -> finalize (`READY`,
`actualSizeBytes: 45`, `width/height: 1/1`) -> submit (`REQUESTED`,
`mediaIds` peuple).

Verification MongoDB reelle (`docker exec fixiyi-mongodb mongosh`) :
document `service_requests` et `media` inspectes directement, coherents
avec les reponses API.

Verification MinIO reelle (`docker exec fixiyi-minio mc stat ...`) :
objet reellement present dans le bucket, taille et content-type
corrects.

## Decisions prises

Voir `docs/DECISIONS.md`, Decisions 35 a 39 :
35. Machine a etats `ServiceRequest` reduite.
36. Localisation exacte stockee, approximation preparee non branchee.
37. Pipeline media generique (`targetType`/`targetId`, scan par
    signature, `image-size`).
38. `apps/web` : meme auth Bearer qu'`apps/admin` ; `tests/browser`
    (Playwright).
39. Trois bugs reels trouves uniquement par le test navigateur reel.

## Problemes rencontres

Format Symptome / Cause racine / Correction appliquee / Re-test :

1. **Symptome** : `POST /requests` (creation de brouillon, sans corps)
   echoue avec `Body cannot be empty when content-type is set to
   'application/json'`, visible uniquement depuis le navigateur reel
   (Playwright), jamais depuis les tests e2e `apps/api` (qui utilisent
   `supertest`, pas `fetch`).
   **Cause racine** : `apiFetch` (`apps/web` et `apps/admin`,
   code duplique) envoyait toujours l'en-tete `Content-Type:
   application/json`, meme quand aucun corps n'etait envoye ; Fastify
   rejette cette combinaison. `POST /requests` est le premier appel
   sans corps du projet cote client.
   **Correction appliquee** : `Content-Type` n'est ajoute que si
   `options.body !== undefined`, dans les deux apps.
   **Re-test** : scenario Playwright complet, PASS.

2. **Symptome** : `PATCH /requests/:id` echoue avec une erreur CORS
   navigateur ("Method PATCH is not allowed by
   Access-Control-Allow-Methods in preflight response"), invisible en
   `supertest` (aucun vrai preflight OPTIONS).
   **Cause racine** : `app.enableCors()` sans options laisse
   Fastify/`@fastify/cors` deviner automatiquement les methodes
   autorisees ; verification par `curl -X OPTIONS` : le serveur ne
   renvoyait que `GET,HEAD,POST`. Latent depuis la Phase 3 (les actions
   PATCH/DELETE du back-office admin auraient echoue pareillement,
   jamais exercees par un vrai navigateur jusqu'ici).
   **Correction appliquee** : `app.enableCors({ methods: ["GET", "HEAD",
   "POST", "PATCH", "PUT", "DELETE"] })` explicite dans `main.ts`.
   **Re-test** : `curl -X OPTIONS` renvoie desormais
   `GET, HEAD, POST, PATCH, PUT, DELETE` ; scenario Playwright complet,
   PASS.

3. **Symptome** : l'upload reel vers MinIO echoue avec
   `net::ERR_NAME_NOT_RESOLVED` sur `http://minio:9000/...`, uniquement
   depuis le navigateur (jamais depuis les tests e2e `apps/api`, qui
   tournent sur l'hote avec `STORAGE_ENDPOINT=http://localhost:9000`
   pour les deux usages).
   **Cause racine** : le conteneur `api` (Docker) genere ses URLs
   presignees avec `STORAGE_ENDPOINT=http://minio:9000` (nom de service
   interne, correct pour ses propres appels HeadObject/GetObject), mais
   cette URL est ensuite donnee au navigateur (sur la machine hote), qui
   ne peut pas resoudre `minio`.
   **Correction appliquee** : nouvelle variable optionnelle
   `STORAGE_PUBLIC_ENDPOINT` ; `StorageService` garde un second
   `S3Client` (signature uniquement, pas d'appel reseau) pour les URLs
   presignees, defaut a `STORAGE_ENDPOINT` si absente.
   `docker-compose.dev.yml` la fixe a `http://localhost:9000` pour
   `api`.
   **Re-test** : `curl -X PUT` reel vers l'URL presignee, 200 ; scenario
   Playwright complet, PASS ; verifie aussi par `mc stat` sur l'objet
   reel dans MinIO.

Les 3 bugs ci-dessus n'auraient **jamais** ete detectes sans un vrai
navigateur pilotant la vraie stack Docker — confirmation directe de la
demande explicite de l'utilisateur en debut de Phase 4.

## Limitations / TODO documentes

- `MATCHING`/`EXPIRED` : etats definis, aucune transition automatique
  (Phase 5 / job planifie absent).
- Approximation de localisation : fonction prete, non branchee (aucun
  lecteur fournisseur avant la Phase 5).
- Scan de fichier : verification de signature binaire reelle, PAS un
  antivirus (aucun service de ce type provisionne).
- Extraction de metadonnees limitee aux dimensions d'image (pas de
  duree audio/video — necessiterait ffprobe, hors perimetre).
- `UpdateServiceRequestInputSchema` ne permet pas de "vider" un champ
  deja rempli (seulement de le remplacer) — accepte, flux lineaire de
  saisie.

## Prerequis pour la phase suivante

- `ServiceRequest` en statut `REQUESTED` : source de donnees prete pour
  le moteur de matching (Phase 5).
- Index `2dsphere` deja present sur `location.point` (non interroge).
- `approximateCoordinates()` prete a etre appelee par le futur endpoint
  de lecture cote fournisseur.

## Prochaine phase

Phase 5 - Matching (eligibility, ranking, dispatch progressif, expansion
rayon) — **STOP, en attente de "GO PHASE 5"**.
