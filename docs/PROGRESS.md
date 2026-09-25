# FIXIYI - PROGRESS

## Derniere mise a jour

2026-09-25 - Refonte design : **phase 10 (Responsive) TERMINEE** —
`docs/design/PHASE_10_REPORT.md`. Audit mesure dans un vrai navigateur (44
mesures, 11 routes x 4 largeurs) et **instrument verifie avant d'etre cru** :
24 constats bruts, 2 defauts reels. Zero debordement de page sur les 44
mesures, donc grille et breakpoints **non touches**. Corriges : un mot
insecable tranche au bord d'une carte, et le champ de fichiers a 20 px.
52 scenarios Playwright.

2026-09-25 - Refonte design : **phase 9 (Etats) TERMINEE** —
`docs/design/PHASE_9_REPORT.md`. Consolidation : le meme ternaire d'erreur
etait ecrit 19 fois, du vocabulaire moteur avait survecu dans deux etats, et
deux erreurs de chargement etaient des impasses sans reprise. Un test lit les
ecrans et echoue si un mot du moteur y reapparait. 57 tests web.

2026-09-25 - Refonte design : **phase 8 (Pages secondaires) TERMINEE** —
`docs/design/PHASE_8_REPORT.md`. Les cinq ecrans parlaient la langue du
moteur (`ACTIVE`, `NOTIFIED`, `score 0.78`, « vagues ») ; ils parlent
desormais celle de leur lecteur. Une table de libelles par enum remplace
trois copies. Cote artisan, le nom du service et le delai pour repondre
s'affichent enfin. 51 tests web, 49 scenarios Playwright.

2026-09-25 - **Renforcement ECC TERMINE** — `docs/ECC_HARDENING_PLAN.md`.
Audit complet puis correction par priorite : lectures publiques et
authentifiees plafonnees (Decisions 72 et 77), configuration assainie
(73 : 17 cles mortes sur 39), couverture mesuree et verrouillee au niveau
atteint (74 : monorepo 82,3 %, api 88 %), `LOG_LEVEL` applique et journal du
worker (75), pagination de `GET /requests/mine` (76), `NewRequestForm`
decoupe (78), mesure des fonctions longues corrigee (79). Reference de
rollback perimee corrigee. Image MinIO remplacee : `quay.io` a cesse de
servir les pull anonymes et cassait la CI **et** tout clone neuf.

2026-09-23 - Refonte design : **phase 7 (Pages principales) TERMINEE** —
`docs/design/PHASE_7_REPORT.md` : accueil sur le vrai catalogue, recherche de
services, profil artisan en vue publique restreinte (Decision 70), plus les
trois changements de contrat qui les rendent possibles
(`PublicProviderProfile`, `icon`/`accentColor` sur le catalogue, badge
`verified`). 48 scenarios Playwright, gates 4/4 verts.

2026-09-22 - Refonte design : **phase 6 (Navigation) TERMINEE** —
`docs/design/PHASE_6_REPORT.md`. Depot pousse sur GitHub
(`origin/main`, https://github.com/saidElbouchichi/appforfixiyi). **CI
GitHub Actions verte** (`a46fa28`) : le workflow ne demarrait pas MinIO, que
`docker-compose.yml` fournit en dev — les 11 suites e2e de `apps/api`
echouaient au boot sur `ECONNREFUSED :9000`. Phase 7 de la refonte : plan
ecrit (`docs/design/PHASE_7_PLAN.md`), **implementation en attente du GO**.

## Phase actuelle

Produit : Phase 6 - Chat - **TERMINEE** (la Phase 7 ne demarre qu'apres la
refonte design). Refonte Design System V2 : phases 1 a **10 TERMINEES** ;
STOP, en attente de "GO PHASE 11" de la refonte (accessibilite, audit
WCAG 2.2 AA — passe de consolidation).

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
- **Phase 5 (Layout) TERMINEE** — `docs/design/PHASE_5_REPORT.md` : AppShell,
  Header, Logo (texte D4), Navbar, BottomNavigation, Footer, Page,
  LinkProvider (next/link) ; coque appliquee a web et admin ; 692 tests +
  29 Playwright.
- **Phase 6 (Navigation) TERMINEE** — `docs/design/PHASE_6_REPORT.md` :
  navigation par role (6 entrees, toutes vers une route reelle), etat actif
  reel, ecrans `/requests`, `/conversations` et `/profile` (premiere
  deconnexion du produit), compteur de non-lus en temps reel, entree
  Catalogue et deconnexion dans l'admin ; 731 tests (dont `apps/web`, qui
  recoit vitest : 20) + 38 Playwright. 4 defauts reels corriges, dont le
  composeur du chat qui passait sous la barre basse et la barre elle-meme
  trop courte de 4 px a cinq entrees (token 64 -> 72 px).
- Prochaine : Phase 7 (pages principales : accueil sur le vrai catalogue,
  recherche de services, profil artisan en vue publique).

## Audit complet des phases livrees (2026-09-21)

Journal detaille : `docs/AUDIT_PHASES_0_5.md`. Agents ECC utilises :
`ecc:code-reviewer`, `ecc:security-reviewer`, `ecc:react-reviewer` ; chaque
constat reverifie dans le code, chaque correction prouvee par un test ecrit
d'abord ou une mutation.

- **12 corrections**, dont 4 HIGH : liste des membres d'une entreprise
  ouverte a tous ; rotation du refresh non atomique (7 refresh concurrents
  sur 8 reussissaient) ; **30 routes d'ecriture sur 46 sans rate limit**
  (Decision 63, garde-fou par test de couverture) ; upload de piece
  d'identite sans limite de taille ni de type (taille signee dans l'URL).
- 3 MEDIUM : secrets d'exemple acceptes en production (Decision 64) ;
  **route orpheline** — la boite fournisseur n'etait accessible qu'en
  tapant l'URL (Decision 65) ; `aria-controls` manquant sur les boutons qui
  ouvrent une zone.
- 5 LOW : validation complete de la session a la connexion, `x-trace-id`
  assaini, JWT epingle en HS256, commentaire faux sur le stockage des
  jetons, README et PROGRESS obsoletes.
- Gates : **avant** 15/15, 15/15, 13/13 (692 tests), 10/10 — **apres**
  15/15, 15/15, 13/13 (**709 tests**), 10/10, 0 erreur, 0 avertissement.
- Playwright : **avant 29/29, apres 33/33** (nouveau
  `navigation.spec.ts` : parcours par l'interface, liens internes suivis).
- 7 services Docker reconstruits, sains ; `/health` et `/api/docs` : 200.
- Decision ouverte : jetons de `apps/web` dans `localStorage` (Decision 66).

## Derniere action effectuee

Phase 6 de la refonte design (Navigation) : navigation par role, ecrans
`/requests`, `/conversations`, `/profile`, deconnexion (web et admin),
compteur de non-lus en temps reel, 4 defauts corriges, Decisions 67 a 69,
`docs/design/PHASE_6_REPORT.md`, gates et Playwright 100 % verts, commit
dedie pousse sur `origin/main`.

## Prochaine action exacte

**Aucune** — STOP, attendre `GO PHASE 11` de la **refonte** (accessibilite,
audit WCAG 2.2 AA, passe de consolidation). Pour cette phase, la competence
`design:accessibility-review` est prevue en second regard
(`08_ECC_INTEGRATION.md`). Le renforcement ECC est termine ; ce qu'il a laisse ouvert est
dans « Blocages ». Apres la refonte seulement, la Phase 7 **produit**
(Offers), qui devra appeler `ConversationService.unlockContact` a
l'acceptation d'une offre.

## Blocages

Aucun blocage technique. Decisions attendues de l'utilisateur : stockage des
jetons de `apps/web` (Decision 66), conservation des messages supprimes
(Decision 59), couleur de Domotique, URL des comptes sociaux, logo.

Laisse ouvert par le renforcement ECC du 2026-09-25 :

- **`trustProxy`** (Decision 60) doit etre regle **avant la production** :
  les plafonds par IP des Decisions 72 et 77 comptent l'adresse du proxy tant
  qu'il ne l'est pas. Les deux vont ensemble.
- **Compteur de non-lus denormalise** : sans lui, `GET /conversations` ne
  peut pas etre pagine sans rendre la pastille fausse (Decision 76). C'est
  une modification du modele de donnees, donc soumise a validation.
- **`apps/web` 16,6 % et `apps/admin` 0 %** de couverture unitaire. Les deux
  sont exerces par 48 scenarios Playwright, que la couverture vitest ne voit
  pas ; les planchers sont verrouilles a ce niveau et ne montent que vers le
  haut (Decision 74).

A traiter avant la production : pagination de `GET /requests/mine` et
`GET /conversations` (non bornees), `trustProxy` (Decision 60),
**`STORAGE_PROVIDER` est un parametre mort** — declare dans
`packages/config/src/env-schema.ts:48`, lu nulle part : `STORAGE_PROVIDER=fake`
dans `.env.test.example` ne desactive rien, `StorageService` construit son
client S3 et cree son bucket dans tous les cas. C'est ce qui a masque
l'absence de MinIO dans la CI jusqu'au 2026-09-22. A implementer ou a retirer
du schema ; **pas bloquant pour la phase 7** (decide par l'utilisateur le
2026-09-22).

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
- [ ] stockage des jetons de `apps/web` (Decision 66 — architecture d'auth)
- [x] phase 6 de la refonte design ("GO PHASE 6" recu le 2026-09-22)
- [x] phase 7 de la refonte design ("GO PHASE 7" recu le 2026-09-22, GO
  d'implementation le 2026-09-22) — **TERMINEE**
- [x] vue publique de `GET /providers/:id` (Decision 70)
- [x] route de liste d'artisans (mode DIRECT) : reportee (Decision 71)
- [x] phase 8 de la refonte design ("GO PHASE 8" recu le 2026-09-25)
- [x] phase 9 de la refonte design ("GO PHASE 9" recu le 2026-09-25)
- [x] phase 10 de la refonte design ("GO PHASE 10" recu le 2026-09-25)
- [ ] phase 11 de la refonte design ("GO PHASE 11" pas encore recu)

## Prompt de reprise pour la prochaine session

```
Reprise Fixiyi

Lis dans l'ordre :
1. docs/PROGRESS.md (ce fichier)
2. docs/DECISIONS.md (70 et 71 = choix du dernier tour)
3. docs/design/PHASE_7_REPORT.md et docs/design/PLAN.md

Contexte : deux numerotations coexistent. Produit : phases 0 a 6 terminees,
la Phase 7 (Offers) attend la FIN de la refonte ; elle devra appeler
ConversationService.unlockContact a l'acceptation d'une offre. Refonte
design : phases 1 a 7 terminees (la 6 = navigation par role ; la 7 = accueil
sur le vrai catalogue, recherche de services, profil artisan en vue publique
restreinte, Decisions 70 et 71). 782 tests, 48 scenarios Playwright, gates
verts, depot pousse sur origin/main, CI GitHub Actions verte.

La suite est la phase 8 de la REFONTE (pages secondaires : creation de
demande, matching, boite fournisseur, chat, admin). N'attends que
"GO PHASE 8" de l'utilisateur, et fais-lui preciser refonte ou produit ;
sans ce signal explicite, ne commence rien - redemande confirmation.

Verifie d'abord que Docker tourne toujours (`docker compose -f
docker-compose.yml -f docker-compose.dev.yml ps` depuis la racine).
```
