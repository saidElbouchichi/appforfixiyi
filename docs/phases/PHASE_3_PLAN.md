# PHASE 3 - MARKETPLACE - PLAN

## Objectif

Catalogue de services administrable, profils fournisseur, entreprises,
verification progressive (01_SPEC_PRODUCT.md #7-8, #22-25,
02_SPEC_ENGINEERING.md #98).

## Simplifications de modelisation (decisions a documenter dans
DECISIONS.md au fil de l'implementation)

Le data model de reference (#98) liste 15 agregats pour ce perimetre :
`ServiceDomain, ServiceCategory, Service, InterventionType, Complexity,
Skill`, `ProviderProfile, ProviderSkill, ProviderService,
ProviderAvailability, ProviderServiceArea`, `Company, CompanyMember,
CompanyVerification`, `VerificationCase, VerificationDocument,
VerificationDecision`. Consolidations retenues (memes 5 niveaux de
donnees reelles, moins de collections Mongo separees) :

1. **Catalogue = 1 collection generique** `catalog_nodes` (champ `level`
   discriminant : `DOMAIN/CATEGORY/SERVICE/INTERVENTION_TYPE/COMPLEXITY/
   SKILL`, `parentId` nullable). Les 5 niveaux hierarchiques + `Skill`
   partagent exactement la meme forme (nom, description, ordre, actif,
   parent) - une seule collection/service/controller CRUD generique
   valide les regles de parente par niveau, plutot que 5 modules
   quasi-identiques. `RequiredSkill` = champ `requiredSkillIds` sur les
   noeuds `COMPLEXITY` (pas une collection separee).
2. **`ProviderProfile` embarque ses 4 sous-agregats** (`skillIds`,
   `serviceIds`, `availability[]`, `serviceAreas[]` avec index
   `2dsphere`) plutot que 4 collections separees - toujours lus/ecrits
   avec le profil, aucun cycle de vie independant en Phase 3.
3. **`VerificationCase`/`VerificationDocument`/`VerificationDecision`
   generiques sur `targetType` (`PROVIDER`/`COMPANY`)** - couvrent aussi
   `CompanyVerification` (meme machine a etats, pas de 2e implementation
   parallele).

## Perimetre retenu

- `packages/contracts` : schemas Zod pour catalogue, provider profile,
  company/companyMember, verification (case/document/decision).
- `apps/api/src/catalog/` : CRUD generique par niveau, lecture publique
  (`GET /catalog/tree`), ecriture protegee **RBAC reel**
  (`@Roles(ADMIN, MANAGER)` - premier branchement reel de `RolesGuard`
  depuis sa preparation en Phase 2), seed realiste (Electricite, suivant
  l'exemple `01_SPEC_PRODUCT.md #235/#264).
- `apps/api/src/providers/` : `ProviderProfile` (self-service, proprietaire
  = `AuthGuard` + verification d'ownership manuelle sur `userId`), types
  bricoleur/technicien/expert, disponibilites, zones geospatiales reelles
  (index `2dsphere`, non exploitees par une recherche avant la Phase 5 -
  meme statut "prepare" que `ResourceOwnerGuard` en Phase 2).
- `apps/api/src/companies/` : `Company` (creation par un `PROVIDER`),
  `CompanyMember` (invitation/adhesion/retrait, roles OWNER/MEMBER/
  TECHNICIAN).
- `apps/api/src/verification/` : `VerificationCase` (etats DRAFT ->
  IN_REVIEW -> NEEDS_CORRECTION/VERIFIED/REJECTED, VERIFIED -> SUSPENDED),
  decisions historisees (jamais ecrasees), upload de documents via MinIO
  reel (URL presignee - S3 SDK, nouvelle dependance justifiee : aucune
  alternative maison raisonnable pour une signature S3).
- `apps/admin` : premier ecran metier reel (login OTP reutilisant
  `/api/v1/auth`, puis CRUD catalogue) - **minimal**, pas le dashboard
  complet (reserve a la Phase 12 selon `06_SCOPE.md`).

## Hors perimetre (documente comme limitation)

- Recherche/matching par proximite geospatiale : Phase 5.
- Pipeline media generique (`CreateUploadSession -> Scan -> Process ->
  Finalize`, antivirus) : Phase 4, reutilisable ensuite par la
  verification si pertinent - Phase 3 n'implemente que l'essentiel reel
  (upload presigne + confirmation) pour les documents de verification.
- Onboarding UI mobile/web complet : Phase 3 livre les endpoints API
  self-service (devenir bricoleur/technicien/expert, creer un profil) ;
  pas d'ecran `apps/web` dedie (aucun ecran client n'existe encore en
  Phase 3, coherent avec le reste du produit).
- Back-office complet (dashboard, moderation, finance, audit) : Phase 12.

## Nouvelle dependance

- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (`apps/api`) :
  URLs presignees S3-compatibles (MinIO) pour l'upload de documents de
  verification. Decision autonome (05_DECISION_POLICY.md) : SDK officiel
  AWS, tres maintenu, aucune alternative maison raisonnable pour la
  signature de requetes S3.

## Ordre d'implementation

1. `packages/contracts` : catalogue, provider, company, verification.
2. `apps/api/src/catalog/` (schema generique, service, controller, seed,
   RBAC reel) + tests.
3. `apps/api/src/providers/` (profil, ownership, geospatial) + tests.
4. `apps/api/src/companies/` (Company/CompanyMember) + tests.
5. `apps/api/src/verification/` (state machine + MinIO upload) + tests.
6. `apps/admin` : login OTP + ecran catalogue minimal.
7. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
8. Verification manuelle (curl reel + Docker) des parcours cles.
9. `docs/phases/PHASE_3_REPORT.md`, mise a jour `PROGRESS.md`/`DECISIONS.md`.
10. STOP, attendre `GO PHASE 4`.
