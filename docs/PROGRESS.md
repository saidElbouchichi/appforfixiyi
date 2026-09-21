# FIXIYI - PROGRESS

## Derniere mise a jour

2026-09-21 - Inspection ECC des Phases 0-5 + refonte du Design System.
Phase 5 reste la derniere phase TERMINEE ; Phase 6 non demarree.

## Phase actuelle

Phase 5 - Matching - **TERMINEE**. STOP, en attente de "GO PHASE 6".

## Phases terminees

- Phase 0 - Audit (2026-09-19) - voir `docs/phases/PHASE_0_REPORT.md`
- Phase 1 - Foundation (2026-09-19 / 2026-09-20) - voir
  `docs/phases/PHASE_1_REPORT.md`
- Phase 2 - Auth (2026-09-20) - voir `docs/phases/PHASE_2_REPORT.md` et
  `docs/VERIFICATION_PHASE_1_2.md`
- Phase 3 - Marketplace (2026-09-20) - voir
  `docs/phases/PHASE_3_REPORT.md` : catalogue administrable, profils
  fournisseur, entreprises, verification (upload MinIO reel),
  back-office minimal (`apps/admin`)
- Phase 4 - Requests (2026-09-20) - voir `docs/phases/PHASE_4_REPORT.md` :
  creation de demande client, pipeline media generique reel, machine a
  etats reduite, premier ecran client (`apps/web`), workspace
  `tests/browser` (Playwright)
- Phase 5 - Matching (2026-09-20) - voir `docs/phases/PHASE_5_REPORT.md` :
  dispatch progressif reel (eligibility -> ranking -> batch borne ->
  attente par job BullMQ differe -> expansion de rayon), ponderations
  administrables en base, services geo/transport, matching hybride
  AUTO/DIRECT, localisation approximative cote fournisseur, suivi client
  et **premier ecran fournisseur**, plus le design system partage
  `packages/ui` (bonus).

## Etat detaille de la phase actuelle (Phase 5 - Matching - TERMINEE)

**320 tests** sur le monorepo : 153 `apps/api` (23 fichiers, dont
`matching.e2e.test.ts` — 11 tests d'integration reels sur Mongo/Redis,
index `2dsphere` et BullMQ — et `ranking.test.ts` — 19 tests sur la
fonction de score pure), 69 `packages/contracts`, 52 `packages/ui`
(nouveau), 27 `shared-utils`, 11 `config`, 3 `i18n`, 3 `design-tokens`,
2 `worker`. Plus 2 scenarios Playwright reels contre la stack Docker.
`pnpm lint && pnpm typecheck && pnpm test && pnpm build` : 15/15, 15/15,
13/13, 10/10 taches, 0 erreur, 0 warning.

Le moteur est verifie par la donnee reelle et non par des affirmations :
sur le match cree par le scenario navigateur, MongoDB montre **3
candidats exactement** alors que davantage de fournisseurs etaient
eligibles, et le siege d'exploration est visible (nouveau fournisseur a
0,78 contre 0,68 pour des fournisseurs identiques par ailleurs mais deja
exposes).

4 bugs reels trouves et corriges (detail : `docs/phases/PHASE_5_REPORT.md`
et Decision 46), dont deux qui depassaient le perimetre de la phase :
`RolesGuard` ignorait silencieusement un `@Roles` pose au niveau classe
(un controleur entier serait reste ouvert a tout utilisateur
authentifie) ; les pages authentifiees de `apps/web` **et** `apps/admin`
redirigeaient vers `/login` avant l'hydratation de zustand, donc tout
rafraichissement deconnectait une session valide. Les deux autres :
BullMQ refuse un id de job contenant `:` (chaque dispatch AUTO renvoyait
une 500), et les fournisseurs globaux d'un test e2e remplissaient le
batch du test suivant.

**Bonus livre** : `packages/ui`, design system partage
(01_SPEC_PRODUCT.md #82) — 8 composants accessibles (WCAG 2.2 AA),
compatibles RTL, bases sur les design tokens, avec 52 tests dont des
tests d'invariants CSS qui verifient reellement les promesses RTL/tokens/
accessibilite. Il est consomme par les 5 ecrans existants de `apps/web`
et `apps/admin`.

Images Docker `api`, `web` et `admin` reconstruites avec le code de la
Phase 5.

> Note d'exactitude : les chiffres de tests annonces en fin de Phase 4
> pour `packages/contracts` (65) et `shared-utils` (25) etaient errones ;
> les vrais etaient 58 et 22. `PHASE_4_REPORT.md` a ete corrige.

## Inspection ECC des Phases 0-5 (2026-09-21)

Inspection complete des Phases 0 a 5 sous ECC v2.2.2 — voir
`docs/INSPECTION_ECC_PHASE_0_5.md`. Les 6 phases sont **conformes a leurs
rapports** : 320/320 tests, 2/2 scenarios Playwright, gates 15/15 15/15
13/13 10/10, 0 regression. Verifie sur la donnee reelle et non sur
declaration (TTL Mongo, index 2dsphere, bornage du batch a 3, ecart de
score d'exploration, lignes ecrites par le run navigateur).

**7 findings, aucun corrige** (une inspection constate, elle ne modifie
pas) — dont 2 HIGH a planifier avant la production :

- **B1 (HIGH)** — le bug signale par l'utilisateur. `apps/web` et
  `apps/admin` stockent un `refreshToken` mais n'appellent **jamais**
  `POST /api/v1/auth/refresh`. Passe `JWT_ACCESS_TTL` (15 min), toute page
  authentifiee affiche « Invalid or expired access token » et la session
  morte reste dans `localStorage` sans redirection vers `/login`.
  Reproduit sous Playwright ; correction proposee, non appliquee.
- **B2 (HIGH)** — upload presigne non borne en taille, objets rejetes
  jamais supprimes de MinIO, aucun rate limit sur les routes de demande.

## Design System unifie (2026-09-21)

`packages/ui` passe de 8 a **11 composants** (ajout de `Icon`, `Select`,
`RadioGroup`) et de **52 a 102 tests** ; `packages/design-tokens` de 3 a
**6 tests**. Total monorepo : **373 tests** (contre 320).

- **Animations** : nouvelle couche `packages/ui/src/styles/animations.css`
  (6 `@keyframes`, 7 utilitaires `.fx-animate-*`), durees et courbes
  exclusivement issues des tokens, glissement directionnel sur l'axe
  inline et retourne sous `[dir="rtl"]`. `prefers-reduced-motion` est
  traite par **une seule regle** couvrant tous les utilitaires, avec un
  test qui echoue si une animation ajoutee plus tard n'y figure pas
  (Decision 49).
- **Icones** : 21 SVG inline, aucune dependance externe, une grille 24x24
  commune, 4 tailles (16/20/24/32), `currentColor`, `aria-hidden` par
  defaut et `role="img"` + `aria-label` quand l'icone porte le sens seule.
- **Tokens** : `tokens.css` avait derive de `tokens.ts` (spacing, shadows,
  typography, z-index, easing manquants — d'ou les ombres et tailles de
  texte codees en dur dans `styles.css`). Les 5 familles sont ajoutees et
  un test de synchronisation bidirectionnelle fait desormais echouer le
  build en cas de divergence (Decision 48).
- **Ecrans** : les 6 ecrans existants adaptes. Le `window.prompt()` du
  back-office catalogue est remplace par un vrai `Modal` + `Input`
  (Decision 47, revient sur la Decision 34).
- Verifie sur le **vrai build Next.js** (keyframes, utilitaires, blocs
  `prefers-reduced-motion` et regles `[dir="rtl"]` presents dans le CSS
  compile) et par les **2 scenarios Playwright** rejoues contre les images
  Docker reconstruites.

Gates apres refonte : `pnpm lint` 15/15, `pnpm typecheck` 15/15,
`pnpm test` 13/13 (373 tests), `pnpm build` 10/10 — 0 erreur.

## Derniere action effectuee

Gates complets du monorepo (tous verts), verification manuelle par
`mongosh` du match/candidats/batchs/configuration reellement ecrits, deux
scenarios Playwright reels avec captures d'ecran, redaction de
`docs/phases/PHASE_5_REPORT.md` et des Decisions 40 a 46, correction des
chiffres de la Phase 4, mise a jour de ce fichier.

## Prochaine action exacte

**Aucune** — la Phase 5 est terminee. STOP, attendre `GO PHASE 6` de
l'utilisateur (Phase 6 = Chat : realtime, messages, attachments,
anti-contact).

## Blocages

Aucun. Phase 5 terminee sans blocage technique residuel.

## Validation humaine requise

- [x] pour demarrer Phase 0 (recue avant Phase 0)
- [x] pour demarrer Phase 1 ("GO PHASE 1" recu)
- [x] pour demarrer Phase 2 ("GO PHASE 2" recu)
- [x] pour demarrer Phase 3 ("GO PHASE 3" recu)
- [x] pour demarrer Phase 4 ("GO PHASE 4" recu)
- [x] pour demarrer Phase 5 ("GO PHASE 5" recu)
- [ ] pour demarrer Phase 6 (en attente — Phase 5 terminee, "GO PHASE 6"
  pas encore recu)

## Prompt de reprise pour la prochaine session

```
Reprise Fixiyi

Lis dans l'ordre :
1. docs/PROGRESS.md (ce fichier)
2. docs/DECISIONS.md (Decisions 40 a 46 = choix techniques Phase 5)
3. docs/phases/PHASE_5_REPORT.md

Contexte : la Phase 5 (Matching) est TERMINEE : dispatch progressif reel
(batch borne, attente par job differe, expansion de rayon), ponderations
administrables en base, services geo/transport, AUTO et DIRECT,
localisation approximative cote fournisseur, ecrans client et
fournisseur, design system packages/ui. Tout teste reellement (320 tests,
2 scenarios Playwright, gates verts). N'attends que "GO PHASE 6" de
l'utilisateur ; si ce prompt est relance sans ce signal explicite, ne
commence PAS la Phase 6 - redemande confirmation.

Verifie d'abord que Docker tourne toujours (`docker compose -f
docker-compose.yml -f docker-compose.dev.yml ps` depuis la racine).
```
