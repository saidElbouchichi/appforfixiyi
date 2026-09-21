# PRE-PHASE 6 REPORT

## Date

2026-09-21

## ECC

- Version : v2.2.2
- Scope : User (global), utilise uniquement dans Fixiyi
- Hooks : Minimal
- Statut : Actif
- Documentation d'integration : `docs/prompt/08_ECC_INTEGRATION.md`
  (ajoute en point 8 de l'ordre de lecture obligatoire de
  `docs/prompt/00_README.md`)

### Ecart de nommage a connaitre

Les commandes citees dans la mission (`/ecc:review`, `/ecc:security`,
`/ecc:tdd`, `/ecc:frontend`) **n'existent pas** sous ces noms dans ECC
v2.2.2. La surface reelle utilisee :

| Cite | Reel |
|---|---|
| `/ecc:review` | `/ecc:code-review`, agents `ecc:code-reviewer` / `ecc:typescript-reviewer` |
| `/ecc:security` | `/ecc:security-review`, agent `ecc:security-reviewer` |
| `/ecc:tdd` | `/ecc:tdd-workflow`, agent `ecc:tdd-guide` |
| `/ecc:frontend` | `/ecc:react-review`, agent `ecc:react-reviewer` |

`08_ECC_INTEGRATION.md` garde la liste dictee par l'utilisateur (contenu
impose mot pour mot) ; la correspondance operationnelle est dans
`docs/INSPECTION_ECC_PHASE_0_5.md`.

### Honnetete sur l'execution des agents

Un premier lot de 4 agents ECC lances en parallele (securite, TypeScript,
code review, React) est **mort en cours d'execution** sur une limite de
session de l'API — aucun n'a rendu de resultat. Apres reinitialisation,
l'agent `ecc:security-reviewer` a ete relance seul et a rendu son
rapport ; **chacun de ses findings a ete re-verifie a la main dans le
code** avant d'etre retenu, et les items non confirmes n'apparaissent pas
dans le rapport d'inspection. Le reste de l'inspection (structure, tests,
MongoDB, Redis, Playwright, cause racine du bug frontend) a ete conduit
directement, pas delegue.

## Inspection Phases 0-5

Rapport complet : `docs/INSPECTION_ECC_PHASE_0_5.md`.

| Phase | Verdict | Reserve |
|---|---|---|
| Phase 0 — Audit | **OK** | aucune |
| Phase 1 — Foundation | **OK** | MinIO absent du CI (MEDIUM) |
| Phase 2 — Auth | **OK** | aucune |
| Phase 3 — Marketplace | **OK** | base de test jamais purgee (MEDIUM) |
| Phase 4 — Requests | **OK** | aucune |
| Phase 5 — Matching | **OK avec reserves** | bug token frontend (HIGH), upload non borne (HIGH) |

Verifie sur la donnee reelle et non sur declaration : TTL Mongo
(`expireAfterSeconds` lu en base), index `2dsphere`, bornage du batch de
dispatch a 3 candidats par vague, ecart de score du siege d'exploration
(0,78 vs 0,68), lignes reellement ecrites par le run navigateur
(avant/apres), recoupement `declaredSizeBytes` / `actualSizeBytes` du
pipeline media.

## Design System

Point d'entree unique : `@fixiyi/ui` (composants) + `@fixiyi/ui/css`
(styles, qui importe lui-meme la couche mouvement). Aucune duplication
entre `apps/web` et `apps/admin` : les deux `globals.css` se contentent
d'importer les tokens puis `@fixiyi/ui/css`.

### Composants : 8 -> 11

| Composant | Etat |
|---|---|
| Button, Input, Card, Badge, Loading/Skeleton/Spinner, EmptyState, ErrorState, Modal | existants, affines |
| **Icon** | nouveau — 21 SVG inline |
| **Select** | nouveau — remplace le `<select>` fait main (5 usages) |
| **RadioGroup** | nouveau — remplace les radios nus de l'urgence |

### Icones : 21, en 4 familles

- Navigation : `home`, `search`, `message`, `wallet`, `profile`
- Actions : `add`, `edit`, `delete`, `close`, `check`, `arrow`
- Statut : `success`, `warning`, `error`, `info`, `loading`
- Metier : `wrench`, `tools`, `calendar`, `map`, `star`, `shield`

Tailles `sm`/`md`/`lg`/`xl` = 16/20/24/32 px, toutes dessinees sur une
**seule grille 24x24** pour que l'epaisseur de trait reste optiquement
egale. Couleur : `currentColor` uniquement — aucune couleur codee sur un
`path`. Accessibilite : `aria-hidden` par defaut (l'icone accompagne du
texte), `role="img"` + `aria-label` quand elle porte le sens seule, et
`focusable="false"` pour qu'elle ne devienne jamais un arret de
tabulation. Aucune dependance externe.

### Animations

`packages/ui/src/styles/animations.css` — 6 `@keyframes` (`fx-fade-in`,
`fx-fade-out`, `fx-slide-in-from-bottom`, `fx-slide-in-inline`,
`fx-pulse`, `fx-spin`) et 7 utilitaires `.fx-animate-*`, dont un
`.fx-animate-stagger` qui fait arriver les listes en sequence.

Durees et courbes viennent **exclusivement** des tokens
(`--fixiyi-motion-*`, `--fixiyi-ease-*`) : un test echoue s'il trouve une
duree litterale ou un `cubic-bezier` inline dans le fichier.

Deux points non evidents, tenus par des tests :

- **`prefers-reduced-motion` en une seule regle**, pas une exemption par
  classe. Le test extrait la liste reelle des `.fx-animate-*` du fichier
  et exige que chacune figure dans le bloc : une animation ajoutee plus
  tard sans son exemption casse le build.
- L'exemption pose **`animation: none`** et pas `animation-duration:
  0.01ms`. Les utilitaires sont remplis en `both` ; une duree quasi nulle
  figerait un `fade-in` sur son etat `from` (`opacity: 0`) — l'element
  resterait **invisible** pour l'utilisateur qui vient justement de
  demander moins de mouvement.

RTL : le glissement directionnel passe par `--fx-slide-offset`, negatif
sous `[dir="rtl"]`, au lieu d'un `translateX` fige ; la fleche porte
`fx-icon--directional` et est mirroree sous `[dir="rtl"]` (une fleche
« suivant » non retournee pointe vers l'etape precedente en arabe).

**Verifie sur le vrai build Next.js** et pas seulement dans la source :
les 6 `@keyframes`, les 7 utilitaires, les 2 blocs
`prefers-reduced-motion` et les 2 regles `[dir="rtl"]` sont presents dans
le CSS compile de `apps/web`.

### Tokens

`tokens.css` avait derive de `tokens.ts` : `spacing`, `shadows`,
`typography`, `zIndex` et `motion.easing` n'existaient que cote
TypeScript. Consequence reelle : `styles.css` codait en dur ses ombres,
ses tailles de texte et son `z-index`, tout en se declarant « 100 %
tokens » — l'ancien test d'invariant ne le voyait pas parce qu'il ne
cherchait que des couleurs hexadecimales.

Les 5 familles manquantes sont ajoutees, `styles.css` les consomme, et un
**test de synchronisation bidirectionnelle** parse les deux fichiers :
tout token TS doit avoir sa variable CSS a la meme valeur, et toute
variable CSS doit avoir son token TS. `breakpoints` est exclu
explicitement — une custom property ne peut pas servir dans une `@media`,
l'exposer serait mensonger.

### Style

Ombres, rayons, tailles de texte, graisses, espacements et z-index
viennent desormais tous des tokens. Ajout d'utilitaires de mise en page
(`fx-page`, `fx-page__title`, `fx-page__header`, `fx-stack`, `fx-row`,
`fx-text-muted`) qui remplacent le `text-2xl font-semibold
text-[var(--fixiyi-color-neutral-900)]` recopie dans chacun des 6 ecrans.
Etats `hover` / `active` / `disabled` homogenes, retour tactile de 1 px a
l'enfoncement, anneau de focus unique a `2px` sur tout ce qui est
focusable (WCAG 2.2 AA 2.4.7 / 2.4.11), cibles tactiles a 44 px
(2.5.8).

### Ecrans adaptes : 6 / 6

| Ecran | Changement principal |
|---|---|
| `apps/web/login` | `fx-page__title`, icones, carte en `slide-in` |
| `apps/web/requests/new` | 5 `<select>` faits main -> `Select`, radios nus -> `RadioGroup`, stagger sur la liste de medias |
| `apps/web/requests/[id]/match` | `fx-page`, icones, stagger sur la liste de candidats |
| `apps/web/provider/requests` | `fx-page`, icones, stagger sur la liste de demandes |
| `apps/admin/login` | identique a web (meme composants) |
| `apps/admin/catalog` | **`window.prompt()` -> `Modal` + `Input`** |

Le `window.prompt()` du back-office (accepte en Decision 34 quand
`packages/ui` n'existait pas) est remplace : un prompt natif est
intraduisible — donc incompatible avec fr/en/ar/ary —, instylable,
bloquant, parfois supprime silencieusement par le navigateur, et muet
pour un lecteur d'ecran.

### Tests du design system

| Package | Avant | Apres |
|---|---|---|
| `@fixiyi/ui` | 52 | **102** |
| `@fixiyi/design-tokens` | 3 | **6** |

Repartition des 50 nouveaux tests `ui` : Icon 18, RadioGroup 9, Select 9,
animations 14. Ils testent des invariants verifiables, pas des
apparences : couverture des 4 familles d'icones, absence de couleur en
dur sur chaque `path`, grille 24x24 constante, `aria-hidden` vs
`role="img"`, mirroring RTL, association label/controle, auto-desactivation
du `Select` vide, cible de 44 px du `RadioGroup`, et pour les animations
les invariants du fichier CSS lui-meme (aucun keyframe orphelin, aucune
duree litterale, couverture integrale de `prefers-reduced-motion`,
absence de nom de keyframe portant un cote physique).

## Tests

Tous les gates relances apres la refonte du Design System, sur l'arbre
complet :

| Gate | Resultat | Attendu |
|---|---|---|
| `pnpm lint` | **15 / 15 taches, 0 erreur, 0 warning** | 0 erreur |
| `pnpm typecheck` | **15 / 15 taches, 0 erreur** | 0 erreur |
| `pnpm test` | **13 / 13 taches, 59 fichiers, 373 tests, 0 echec** | 320+ |
| `pnpm build` | **10 / 10 taches, succes** | succes |
| Playwright | **2 / 2 scenarios** | 2+ |

Repartition des 373 tests :

| Package | Tests |
|---|---|
| `@fixiyi/api` | 153 |
| `@fixiyi/ui` | **102** (52 avant) |
| `@fixiyi/contracts` | 69 |
| `@fixiyi/shared-utils` | 27 |
| `@fixiyi/config` | 11 |
| `@fixiyi/design-tokens` | **6** (3 avant) |
| `@fixiyi/i18n` | 3 |
| `@fixiyi/worker` | 2 |

+53 tests par rapport aux 320 de la fin de Phase 5.

**Les 2 scenarios Playwright ont ete rejoues contre des images Docker
`web` et `admin` reconstruites** avec le code redesigne — pas contre les
images de la Phase 5. Sans cette reconstruction, le navigateur aurait
teste l'ancienne interface et le « vert » n'aurait rien prouve.

Verification supplementaire, non demandee mais necessaire : le
remplacement du `window.prompt()` du back-office etait le changement le
plus risque de la session **et le seul sans couverture e2e**. Il a donc
ete verifie par un harnais Playwright temporaire contre l'admin reel
(supprime ensuite) : dialogue in-page avec `aria-modal="true"`, titre
lisible, refus du nom vide affiche dans le champ, fermeture par
`Escape`, creation reellement passee par l'API et noeud apparu dans
l'arbre, et **aucun `window.prompt()` natif declenche**. Le noeud cree
pour ce test a ete desactive ensuite via la vraie API — l'environnement
est rendu dans l'etat ou il a ete trouve.

## Bugs trouves

7 findings, **0 corrige** : une inspection constate, elle ne modifie pas
le code qu'elle evalue. Chacun est documente avec fichier, ligne,
scenario d'echec et correction proposee dans
`docs/INSPECTION_ECC_PHASE_0_5.md`.

| # | Severite | Titre |
|---|---|---|
| **B1** | **HIGH** | Token d'acces jamais rafraichi cote client, aucune recuperation sur 401 — **le bug signale** |
| **B2** | **HIGH** | Upload presigne non borne + objets rejetes jamais supprimes + aucun rate limit |
| B3 | MEDIUM | `User.status` (`DEACTIVATED`) defini mais applique par aucun guard |
| B4 | MEDIUM | `trustProxy` non configure -> rate limiting par IP degenere derriere un proxy |
| B5 | MEDIUM | MinIO absent des `services:` du workflow CI |
| B6 | MEDIUM | Base de test `fixiyi_test` jamais purgee (819 users, 852 sessions accumules) |
| B7 | LOW | `finalize` ne verifie pas que le media appartient a la demande de l'URL |

### B1 en detail — le bug signale

**Reproduit** (`docs/evidence/bug-expired-token-repro.png`) :

```
REPRO: refreshToken persisted in localStorage = true
REPRO: calls to /auth/refresh                 = 0
REPRO: dead session still in localStorage     = true
```

Cause racine : ce n'est pas un bug d'hydratation (celui-la a bien ete
corrige en Phase 5) mais une **fonctionnalite absente**. `apps/web` et
`apps/admin` stockent un `refreshToken` dans `localStorage` et ne
l'utilisent **jamais** — aucun appel a `POST /api/v1/auth/refresh`
n'existe dans le code client, alors que l'endpoint existe cote API,
complet et rate-limite. Passe `JWT_ACCESS_TTL` (15 min), chaque appel
authentifie prend un 401 `"Invalid or expired access token"`
(`auth.guard.ts:39`), et rien ne recupere : la session morte reste dans
`localStorage` et l'utilisateur n'est meme pas renvoye vers `/login`.

Correction proposee, **non appliquee** : rejouer une fois la requete
apres un refresh sur 401, en **serialisant les refresh concurrents**
derriere une seule promesse en vol — N refresh paralleles sur un token
rotatif declencheraient la detection de rejeu (`REUSE_DETECTED`) qui
revoque toute la session, donc le remede naif serait pire que le mal. Et
en **extrayant `api-client.ts` dans un package partage** plutot qu'en
corrigeant deux fichiers identiques : c'est exactement la duplication qui
a deja coute deux corrections separees en Phase 4 (Decision 39).

## Commits de cette session

| Hash | Message |
|---|---|
| `802301e` | chore: ECC integration documentation |
| `38841d4` | chore: ECC integration documentation (mandatory pre-phase reading) |
| `fc5367f` | chore: verify phase 0 audit |
| `06e50af` | chore: verify phase 1 foundation |
| `2e15c29` | chore: verify phase 2 auth |
| `14657ea` | chore: verify phase 3 marketplace |
| `117c913` | chore: verify phase 4 requests |
| `6abf1b3` | chore: verify phase 5 matching + reproduce frontend token bug |
| `6aa81b3` | docs: ECC inspection report phases 0-5 |
| `a3b23dd` | feat: design system unique + animations + icons + adaptation |
| `f7b7c2b` | chore: refresh Playwright screenshots against the redesigned UI |
| `6f4a2e9` | chore: pre-phase 6 validation |

12 commits. Decisions ajoutees : **47 a 50** (`docs/DECISIONS.md`).

## Verdict

**OK — avec 2 HIGH a planifier, aucun bloquant pour demarrer la Phase 6.**

Les Phases 0 a 5 sont conformes a ce que leurs rapports annoncent : aucune
affirmation prise en defaut par la donnee, aucun fichier manquant, aucun
test en echec, aucune regression. Les deux HIGH ne sont pas des
regressions mais des **manques** — B1 une fonctionnalite
d'authentification jamais implementee cote client, B2 un durcissement
jamais fait sur le pipeline media.

## Pret pour Phase 6

- [x] **Oui**, sous une reserve forte : **corriger B1 en ouverture de
      Phase 6, avant le chat lui-meme.**

Raison : la Phase 6 (Chat temps reel) tiendra une connexion longue
authentifiee. Une expiration de token non geree y sera nettement plus
penible que sur un formulaire — une session qui meurt en silence au
milieu d'une conversation, sans reconnexion ni retour a `/login`. Le
corriger apres coup signifierait le corriger dans du code de chat deja
ecrit par-dessus.

## Recommandations pour la Phase 6

1. **Corriger B1 d'abord**, avec la serialisation des refresh concurrents.
2. **Extraire `api-client.ts` et `auth-store.ts` dans un package
   partage** — les deux copies web/admin sont identiques au caractere
   pres ; le faire avant que B1 n'y ajoute une troisieme couche dupliquee.
3. **Traiter B2 avec le pipeline d'attachments du chat** : la Phase 6
   reutilise le pipeline media, c'est le moment de borner la taille a la
   signature, de supprimer les objets rejetes et de poser un rate limit.
4. **Purger `fixiyi_test` entre les runs** (B6) avant d'y ajouter les
   collections de messages, pendant que le volume est encore gerable.
5. **Ajouter MinIO au workflow CI** (B5).
6. Ne pas ajouter de rate limit sur `POST /auth/refresh` : il en a deja un
   (60/h). C'est la boucle client qui devra respecter ce plafond au lieu
   de retenter en rafale.
