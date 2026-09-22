# PHASE 6 (REFONTE) — NAVIGATION — PLAN

Date : 2026-09-22. Statut : **plan v2 soumis, implementation en attente du
GO**. v2 integre les reponses de l'utilisateur : page Profil minimale
(Decision 67), creation des deux pages de liste, regles ECC (Decision 68),
rollback de 08 (Decision 69).

Sources lues : `docs/design/AUDIT.md`, `PLAN.md`, `PHASE_5_REPORT.md`,
`docs/PROGRESS.md`, `docs/DECISIONS.md` (60-69), `docs/AUDIT_PHASES_0_5.md`,
et le code : `packages/ui/src/components/{Navigation,Layout}.tsx`, les
`layout.tsx` et pages de `apps/web` / `apps/admin`, les controleurs
`auth`, `requests`, `matching`, `chat`, les contrats `User`,
`ServiceRequest`, `Conversation`.

## 1. Objectif

Remplir la `Navbar` (en-tete, bureau) et la `BottomNavigation` (telephone)
livrees vides en phase 5, **par role, avec etat actif, vers des destinations
reelles uniquement** (03_AGENT_PROTOCOL §2, D2). Critere de sortie : depuis
n'importe quel ecran, un utilisateur atteint chacun de ses ecrans **par
l'interface**, sans taper d'URL, et peut se deconnecter.

## 2. Les 6 entrees de navigation

| # | Entree | Icone | Route | Backend | Etat actuel |
|---|---|---|---|---|---|
| 1 | Demander | `add` | `/requests/new` | `POST /requests`, reprise du brouillon | page existante |
| 2 | Mes demandes | liste | `/requests` | `GET /requests/mine` | **page a creer** (§4) |
| 3 | Boite (demandes recues) | boite | `/provider/requests` | `GET /matches/mine` | page existante |
| 4 | Messages | message | `/conversations` | `GET /conversations` | **page a creer** (§4) |
| 5 | Profil | utilisateur | `/profile` | `GET /auth/me`, `POST /auth/logout` | **page a creer** (§5) |
| 6 | Catalogue (admin) | catalogue | `/catalog` (apps/admin) | `/catalog/*` | page existante |

Les icones sont prises dans les 63 icones du Design System ; les noms exacts
seront fixes a l'implementation, sans en ajouter si une existante convient.

Exclu : **Favoris** (planche) — aucune donnee, lien mort (AUDIT §4).

Compteur sur « Messages » : somme des `unreadCount` renvoyes par
`GET /conversations` (source reelle), masque a 0, prononce « N non lus ».

## 3. Modele de navigation par role

Fonction pure `navigationFor(user)` dans `apps/web/src/lib/navigation.ts`
(prolonge `startRouteFor`, Decision 65), et `activeNavHref(pathname, items)`
qui rattache un detail a sa liste.

| Role | Entrees, dans l'ordre | Nombre |
|---|---|---|
| Non connecte | aucune (seule `/login` existe) | 0 |
| Client | Demander · Mes demandes · Messages · Profil | 4 |
| Fournisseur | Boite · Messages · Demander · Mes demandes · Profil | 5 (borne de la barre basse) |
| Admin (`apps/admin`) | Catalogue, dans la `Navbar` ; bouton « Se deconnecter » dans l'en-tete ; pas de barre basse | 1 |

- Un fournisseur garde les entrees client : il peut aussi commander (leve la
  limite de la Decision 65).
- Admin : outil interne a destination unique ; pas de page Profil, donc la
  deconnexion est dans l'en-tete (Decision 67). Sur telephone, la `Navbar`
  est masquee ; le logo mene a `/` et le bouton de deconnexion reste visible.

Etat actif (`aria-current="page"`, pas seulement une couleur) :

| Chemin | Entree active |
|---|---|
| `/requests/new` | Demander |
| `/requests`, `/requests/[id]/match` | Mes demandes |
| `/provider/requests` | Boite |
| `/conversations`, `/conversations/[id]` | Messages |
| `/profile` | Profil |
| `/catalog` (admin) | Catalogue |

## 4. Les 2 pages de liste (nouvelles, volontairement simples)

La finition visuelle reste en phase 8 de la refonte (pages secondaires).

### `/requests` — Mes demandes
- Une carte par demande, du plus recent au plus ancien (ordre de l'API).
- Contenu : nom du service (resolu via `GET /catalog/tree`, deja utilise
  par le formulaire), extrait de la description, urgence, statut en `Badge`,
  date de creation. Rien d'autre : le contrat ne porte ni titre ni prix.
- Cible selon le statut :

| Statut | Cible |
|---|---|
| `DRAFT` | `/requests/new` (reprend deja le brouillon) |
| `REQUESTED`, `MATCHING` | `/requests/[id]/match` |
| `CANCELLED`, `EXPIRED` | pas de lien (aucune action possible) |

- Etats : vide (« Aucune demande » + bouton « Demander »), chargement,
  erreur — composants existants du Design System.

### `/conversations` — Messages
- Une ligne par conversation : nom de l'interlocuteur, son role (client ou
  artisan), date du dernier message, compteur de non-lus, mention « lecture
  seule » si `canSend` est faux. Clic -> `/conversations/[id]`.
- Pas d'apercu du dernier message : le contrat ne le porte pas, on n'invente
  rien.
- Etats : vide, chargement, erreur.
- La meme requete TanStack `["conversations"]` alimente la page et le
  compteur de la navigation.

## 5. La page Profil minimale (`/profile`, Decision 67)

Contenu, et rien d'autre :
- l'email de l'utilisateur (`GET /auth/me`) ; s'il est absent (`email` est
  nullable, la connexion se fait par telephone) : « Aucun e-mail renseigne » ;
- bouton « Se deconnecter » : `POST /auth/logout`, puis `clearSession()`,
  fermeture du socket du chat, retour a `/login` ;
- lien « Retour a l'accueil » vers `/` (qui redirige deja vers l'ecran de
  depart selon le role).

Aucune edition, aucune fonctionnalite metier. Page provisoire, remplacee
plus tard par la vraie page Profil.

## 6. Integration dans les coques

- Composant client `AppNavigation` (web) : lit la session (`useAuthStore`,
  `useAuthHydrated` — rien n'est rendu avant l'hydratation, Decision 46.3) et
  `usePathname()`, construit les entrees, les passe au `Header`
  (`navigation`) et a l'`AppShell` (`bottomNavigation`). Les `layout.tsx`
  restent des composants serveur.
- Admin : meme principe avec l'entree Catalogue et le bouton de deconnexion
  dans les `actions` du `Header`.
- Compteur : requete `["conversations"]` invalidee sur les evenements socket
  `messageCreated` et `receiptsUpdated`, et au retour de focus. Aucun
  sondage periodique.
- Deconnexion : une seule fonction partagee par la page Profil (web) et
  l'en-tete (admin), dans chaque `lib/` (les deux apps n'ont pas de code
  commun hors packages, comme `api-client.ts`, Decision 51).
- Chat sur telephone : `.fx-shell__fill` doit soustraire la hauteur de la
  barre basse, sinon la zone de saisie passe dessous (a verifier en capture).
- Aucune modification de `@fixiyi/ui` prevue ; si une retouche s'impose, test
  ajoute dans le package.

## 7. Tests

- **Unitaires** : `apps/web` n'a aucun lanceur de tests. Ajout de `vitest`
  en devDependency (deja utilise par tout le monorepo, meme version ; pas une
  nouvelle categorie — decision autonome, 05_DECISION_POLICY) pour tester
  `navigationFor` (4 roles), `activeNavHref` (table du §3), la cible d'une
  demande par statut, la somme des non-lus.
- **Playwright** (`navigation.spec.ts` etendu), par l'interface uniquement :
  1. client : Demander -> soumettre -> « Mes demandes » -> la demande y
     figure -> clic -> ecran de matching, « Mes demandes » en `aria-current` ;
  2. fournisseur sur telephone (360 px) : barre basse, passe par ses 5
     entrees ;
  3. deux navigateurs : un message recu fait apparaitre le compteur, la
     lecture le fait disparaitre ;
  4. Profil : email ou « Aucun e-mail renseigne » ; « Se deconnecter » ->
     `/login`, rechargement toujours deconnecte, ancien refresh token refuse
     par l'API ; « Retour a l'accueil » -> ecran de depart ;
  5. admin : Catalogue actif, deconnexion depuis l'en-tete ;
  6. tous les liens internes rendus repondent (< 400) — controle existant,
     applique aux nouvelles pages.
- Les 38 `data-testid` existants restent stables ; les 33 scenarios actuels
  passent sans modification de leurs assertions.
- Decision 68 : pas de mesure de couverture imposee ; pas de `console.log`,
  fonctions de moins de 50 lignes dans le code ecrit.

## 8. Ordre des taches

1. `vitest` dans `apps/web` ; `navigation.ts` et ses tests (rouge puis vert).
2. Pages `/requests`, `/conversations`, `/profile`.
3. `AppNavigation` et compteur (web) ; entree Catalogue et deconnexion
   (admin).
4. Ajustement de la hauteur du chat sur telephone.
5. Playwright ; gates `lint`, `typecheck`, `test`, `build` **sans cache** ;
   images `web` et `admin` reconstruites ; Playwright complet.
6. Captures examinees : 360 px, 768 px, 1440 px, RTL.
7. `docs/design/PHASE_6_REPORT.md`, `docs/PROGRESS.md`, mise a jour du
   rollback de `08_ECC_INTEGRATION.md` vers le commit de fin de phase
   (Decision 69), commit dedie `feat(design): phase 6 - navigation`, push.

## 9. Hors perimetre

Vraie page Profil (edition, sessions, email), favoris, notifications,
recherche globale, finition visuelle des listes (phase 8), pagination (voir
risques), traduction des libelles (l'i18n n'est branchee dans aucun ecran ;
libelles en francais comme le reste de l'interface).

## 10. Risques

- **Listes non paginees** : `GET /requests/mine` et `GET /conversations`
  renvoient tout. Sans consequence au volume actuel ; a borner cote API
  avant la production (changement de contrat, hors phase).
- Debordement sur la phase 8 : limite par le choix « listes simples ».
- Barre basse et chat sur telephone (§6).
- Machine chargee : tests jsdom lents en phase 5 (`--concurrency=2`).
