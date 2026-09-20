# PHASE 4 - REQUESTS - PLAN

## Objectif

Creation de demande par le client (01_SPEC_PRODUCT.md #10, #13, #17-19,
#33, 02_SPEC_ENGINEERING.md #98/#124), sans IA (fallback formulaire
classique), avec pipeline media reel et localisation.

## Decisions de perimetre (validees par l'utilisateur avant "GO PHASE 4")

- **Machine a etats `ServiceRequest` reduite** : `DRAFT -> REQUESTED`
  (soumission client), plus `CANCELLED` (a tout moment avant matching)
  et `EXPIRED` (etat defini dans le schema, **aucune transition
  automatique implementee** - necessiterait un job planifie, hors
  perimetre). `MATCHING` reste un etat valide du schema **mais aucune
  transition Phase 4 n'y mene** - c'est la Phase 5 (Matching) qui fera
  `REQUESTED -> MATCHING` quand son moteur existera. Aller jusqu'a
  `NEGOTIATING`/`PRICE_AGREED`/`CONFIRMED` maintenant serait un faux
  workflow (03_AGENT_PROTOCOL.md #2) : aucune Offre/Intervention n'existe
  encore pour piloter ces transitions.
- **Localisation** : `RequestLocation` stocke la position **exacte**
  (`GeoPoint`, deplace de `provider.ts` vers `common.ts` - primitive
  partagee). `approximateCoordinates()` (arrondi a 2 decimales, ~1km)
  ajoutee a `@fixiyi/shared-utils`, testee, **non branchee** sur un
  endpoint de lecture - aucun fournisseur ne peut encore consulter une
  demande (Phase 5+). Meme statut que `ResourceOwnerGuard` (Decision 20).
- **Perimetre etendu (valide)** : ajout d'un ecran client minimal
  `apps/web` (login OTP + creation de demande) et d'un nouveau workspace
  `tests/browser/` (Playwright, reel, captures d'ecran) - symetrique au
  back-office admin de la Phase 3.

## Pipeline media generique (`apps/api/src/media/`)

`CreateUploadSession -> SignedUpload -> ObjectStorage -> Scan -> Process
-> Finalize` (02_SPEC_ENGINEERING.md #124), reutilise `StorageService`
(MinIO reel, Phase 3) :

1. **CreateUploadSession** (`POST /media/upload-sessions`) : cree un
   `Media` (`PENDING_UPLOAD`), valide le type MIME/taille declares contre
   une liste blanche, retourne une URL PUT presignee.
2. **SignedUpload / ObjectStorage** : le client PUT les octets
   directement vers MinIO (aucun code serveur, comme Decision 29).
3. **Scan** (`POST /media/:id/finalize`, 1ere sous-etape) : verification
   **reelle** de l'existence de l'objet (`HeadObject`) et de sa signature
   binaire (magic bytes des premiers octets, lus via `GetObject` range)
   contre le type MIME declare - detecte un fichier deguise. **Pas
   d'antivirus** (aucun service de ce type provisionne dans cet
   environnement) - limitation documentee.
4. **Process** : extraction reelle de metadonnees (dimensions image via
   une librairie legere, zero dependance transitive).
5. **Finalize** : statut `READY` (ou `REJECTED` avec raison si Scan/
   Process echoue).

## Perimetre retenu

- `packages/contracts` : `request.ts`, `media.ts`, `location.ts` (+
  `GeoPointSchema` deplace dans `common.ts`).
- `packages/shared-utils` : `approximateCoordinates()`.
- `apps/api/src/media/` : pipeline ci-dessus.
- `apps/api/src/requests/` : `ServiceRequestEntity`, `RequestService`
  (state machine, validation des refs catalogue en chaine parent-enfant
  reelle), `RequestController`.
- `apps/web` : premier ecran client reel (login OTP reutilisant
  `/api/v1/auth`, creation de demande : service depuis le catalogue,
  description, urgence, upload media).
- `tests/browser/` (nouveau workspace pnpm - `tests/` etait reserve
  depuis la Phase 1, jamais rempli) : Playwright, pilotage reel de
  `apps/web`, captures d'ecran a chaque etape cle.

## Hors perimetre (documente comme limitation)

- Matching reel (Phase 5) : `MATCHING` reste un etat prepare, non
  exploite.
- Approximation de localisation appliquee a la lecture : Phase 5+ (aucun
  lecteur fournisseur n'existe encore).
- Antivirus/scan de contenu avance : pas de service provisionne.
- Transition automatique vers `EXPIRED` : necessiterait un job planifie.
- IA de structuration de la demande (#11) : Phase 11 (V2).

## Nouvelle dependance

- `image-size` (`apps/api`) : lecture des dimensions d'image depuis les
  octets, zero dependance transitive, tres maintenue - alternative
  raisonnable a un parsing binaire JPEG/PNG/WEBP ecrit a la main (risque
  de bugs subtils, contrairement aux cookies/CSRF de la Decision 18).
- `@playwright/test` (nouveau workspace `tests/browser/`) - installation
  explicitement demandee et autorisee par l'utilisateur pour verifier
  reellement `apps/web` dans un navigateur headless.

## Ordre d'implementation

1. `packages/contracts` (+ deplacement `GeoPointSchema`), `shared-utils`
   (`approximateCoordinates`).
2. `apps/api/src/media/` (schema, service, controller, module).
3. `apps/api/src/requests/` (schema, service, controller, module).
4. Tests unitaires + e2e reels (Mongo/Redis/MinIO Docker, upload reel).
5. `apps/web` : lib partagees (auth-store, api-client - meme pattern que
   Phase 3), ecran login + creation de demande.
6. `tests/browser/` : setup Playwright, scenario complet avec captures
   d'ecran, verification MongoDB + MinIO en aval du scenario.
7. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
8. `docs/phases/PHASE_4_REPORT.md`, mise a jour `PROGRESS.md`/`DECISIONS.md`.
9. STOP, attendre `GO PHASE 5`.
