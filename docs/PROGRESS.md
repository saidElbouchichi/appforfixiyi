# FIXIYI - PROGRESS

## Derniere mise a jour

2026-09-21 - Phase 6 (Chat) TERMINEE.

## Phase actuelle

Phase 6 - Chat - **TERMINEE**. STOP, en attente de "GO PHASE 7".

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
- Phase 6 - Chat (2026-09-21) - voir `docs/phases/PHASE_6_REPORT.md` :
  conversations liees a une candidature reelle, anti-contact
  (`ContactDetectionService`), temps reel Socket.IO (HTTP ecrit, la socket
  notifie), accuses, reponses, reactions, edition/suppression controlees,
  pieces jointes, recherche, ecran de chat dans `apps/web`.

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

## Correctifs B1 et B2 (2026-09-21)

Les 2 HIGH de l'inspection sont corriges :

- **B1** `13895a3` — `apiFetch` (web et admin) rafraichit une fois sur 401
  puis rejoue la requete, avec **un seul refresh en vol** (sinon la
  detection de rejeu du refresh token rotatif revoquerait la session) ;
  en cas d'echec, session videe et retour a `/login`. Prouve rouge contre
  l'ancien client, vert contre le nouveau (Decision 51).
- **B2** `e9cf329` — la taille declaree est signee dans l'URL presignee
  (MinIO renvoie 403 sur un PUT de taille differente, rien n'est ecrit),
  et un media rejete voit son objet supprime (Decision 52). La
  verification de taille declaree demandee existait deja depuis la
  Phase 4. **Limite** : les uploads de *verification* restent non bornes
  (leur contrat ne porte pas de taille).

Tests : **375** (api 153 -> 155), Playwright **4/4** (2 nouveaux).
Gates : lint 15/15, typecheck 15/15, test 13/13, build 10/10.

## Etat detaille de la Phase 6 - Chat - TERMINEE

**Critere de sortie atteint** : un numero de telephone est masque avant
acceptation et visible apres, prouve a trois niveaux — reponse a
l'expediteur, lecture par l'autre partie, et **document MongoDB** (le
numero n'est jamais ecrit). Verifie aussi en base de dev apres le scenario
navigateur : 0 numero brut dans les messages stockes.

Le point cle : « avant/apres acceptation » renvoie aux offres, qui sont la
Phase 7. La protection est levee par une seule methode de service,
`ConversationService.unlockContact`, **non exposee en HTTP** — c'est ce que
l'acceptation d'offre appellera (Decision 53).

**542 tests** (375 avant) : api 278, ui 125, contracts 90, shared-utils
27, config 11, design-tokens 6, i18n 3, worker 2. Playwright **5/5** dont
un nouveau scenario a deux navigateurs. Gates sans cache : lint 15/15,
typecheck 15/15, test 13/13, build 10/10, 0 erreur, 0 warning.

Six bugs reels trouves et corriges (Decision 61), dont un indicateur de
frappe persistant repere **dans les captures Playwright**, et des tests qui
passaient **a vide** a cause d'un `dist` perime.

**Validation humaine en attente** : conservation des messages supprimes
(Decision 59) — defaut reversible retenu, a confirmer.

## Refonte Design System V2 — mission hors protocole (2026-09-21)

Demandee explicitement par l'utilisateur, hors 06_SCOPE, avec ses propres
documents sous `docs/design/`. **La Phase 7 ne demarre pas avant la fin de
la refonte.**

- Audit : `docs/design/AUDIT.md`, ecarts : `docs/design/AUDIT_NOTES.md`.
- 7 decisions validees : `docs/design/DECISIONS.md` (et Decision 62 pour
  le modele du catalogue).
- Master prompt recu en entier (parties 1 a 3B) ; demarrage sur
  « continue la refonte avec ces placeholders » (logo texte, D4).
- Plan : `docs/design/PLAN.md` (14 phases).
- **Phase 1 (Design tokens) TERMINEE** — `docs/design/PHASE_1_REPORT.md` :
  palette par roles, 31 contrastes testes, 576 tests. Une decision attendue :
  couleur de Domotique.
- **Phase 2 (Typographie) TERMINEE** — `docs/design/PHASE_2_REPORT.md` :
  Inter + Noto Sans Arabic auto-hebergees par `next/font`, tout le texte sur
  l'echelle V2, 582 tests + 9 Playwright.
- **Phase 3 (Espacements, rayons, ombres) TERMINEE** —
  `docs/design/PHASE_3_REPORT.md` : roles de forme et d'elevation, grille
  de 4 px partout, Tailwind branche sur les tokens, 592 tests + 9 Playwright.
- **Phase 4 (Composants primitifs) TERMINEE** — `docs/design/PHASE_4_REPORT.md` :
  13 -> 36 composants (6 variantes et 4 tailles de bouton, 23 nouveaux dont
  Toast, Tabs, Menu, BottomSheet, CommandPalette), 63 icones, banc d'essai
  navigateur ; 681 tests + 25 Playwright. Icones sociales reportees en phase 5
  (D4 : pas de logos non fournis).
- Prochaine : Phase 5 (layout : Header, Footer, Navbar, BottomNavigation).

## Derniere action effectuee

Phase 6 complete : plan, contrats, detecteur, module chat, temps reel,
primitives de design system, ecran de chat, 3 suites e2e API + 1 scenario
Playwright, gates sans cache, verification en base, Decisions 53 a 61,
`docs/phases/PHASE_6_REPORT.md`, mise a jour de ce fichier, de
`CURRENT_STATE.md` et de `IMPLEMENTATION_PLAN.md`.

## Prochaine action exacte

**Aucune** — la Phase 6 est terminee. STOP, attendre `GO PHASE 7` de
l'utilisateur (Phase 7 = Offers : offres, contre-offres, negociation,
acceptation, price lock). La Phase 7 devra appeler
`ConversationService.unlockContact` a l'acceptation d'une offre.

## Blocages

Aucun blocage technique. Une decision attend l'utilisateur (Decision 59),
sans bloquer la Phase 7.

## Validation humaine requise

- [x] pour demarrer Phase 0 (recue avant Phase 0)
- [x] pour demarrer Phase 1 ("GO PHASE 1" recu)
- [x] pour demarrer Phase 2 ("GO PHASE 2" recu)
- [x] pour demarrer Phase 3 ("GO PHASE 3" recu)
- [x] pour demarrer Phase 4 ("GO PHASE 4" recu)
- [x] pour demarrer Phase 5 ("GO PHASE 5" recu)
- [x] pour demarrer Phase 6 ("GO PHASE 6" recu)
- [ ] pour demarrer Phase 7 (en attente — Phase 6 terminee, "GO PHASE 7"
  pas encore recu)
- [ ] conservation des messages supprimes (Decision 59 — choix juridique)

## Prompt de reprise pour la prochaine session

```
Reprise Fixiyi

Lis dans l'ordre :
1. docs/PROGRESS.md (ce fichier)
2. docs/DECISIONS.md (Decisions 53 a 61 = choix techniques Phase 6)
3. docs/phases/PHASE_6_REPORT.md

Contexte : la Phase 6 (Chat) est TERMINEE : conversations liees a une
candidature reelle, anti-contact avant acceptation, temps reel Socket.IO
(HTTP ecrit, la socket notifie), ecran de chat. 542 tests, 5 scenarios
Playwright, gates verts. La protection des coordonnees n'est levee que par
ConversationService.unlockContact — la Phase 7 doit l'appeler a
l'acceptation d'une offre. N'attends que "GO PHASE 7" de l'utilisateur ;
si ce prompt est relance sans ce signal explicite, ne commence PAS la
Phase 7 - redemande confirmation.

Verifie d'abord que Docker tourne toujours (`docker compose -f
docker-compose.yml -f docker-compose.dev.yml ps` depuis la racine).
```
