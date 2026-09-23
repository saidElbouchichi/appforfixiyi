# PHASE 7 (REFONTE) — PAGES PRINCIPALES — PLAN

Date : 2026-09-22. Statut : **plan soumis, implementation en attente du GO**.
Integre la reponse de l'utilisateur sur la vue publique de
`GET /providers/:id` (Decision 70).

Sources lues : `docs/design/PLAN.md` (phase 7), `AUDIT.md` §4 et son tableau
de correspondance, `DECISIONS.md` (D1-D7), `PHASE_6_PLAN.md` et
`PHASE_6_REPORT.md`, `docs/DECISIONS.md` (62, 65, 70), `docs/PROGRESS.md`.
Et le code : `providers/provider.controller.ts` et `provider.service.ts`,
`catalog/catalog.controller.ts` et `catalog.seed.ts`, les contrats
`provider.ts`, `catalog.ts`, `matching.ts`, `verification.ts`,
`packages/design-tokens/src/colors.ts`, `packages/ui/src/components/`,
`apps/web/src/app/page.tsx`, `lib/start-route.ts`, `lib/catalog.ts`.
Catalogue reel interroge en direct sur la stack Docker
(`GET /api/v1/catalog/tree`).

## 1. Objectif

Les trois ecrans « principaux » de la planche, habilles du Design System V2
et **branches sur la donnee reelle uniquement** (03_AGENT_PROTOCOL §2, D2) :

1. **Accueil** — grille du vrai catalogue ;
2. **Recherche de services** — sur ce meme catalogue ;
3. **Profil artisan** — vue publique de `GET /providers/:id`.

Critere de sortie : un visiteur atteint un service du catalogue depuis
l'accueil ou la recherche, et un client ouvre le profil public d'un artisan
depuis son ecran de matching — par l'interface, sans URL tapee, sans qu'un
seul chiffre affiche soit invente.

## 2. Ce que la donnee reelle permet — et ce qu'elle interdit

C'est la section qui commande tout le reste. Elle confronte la liste
autorisee par l'utilisateur (Decision 70) a ce qui existe en base.

| Champ autorise | Source reelle | Verdict |
|---|---|---|
| Nom | `ProviderProfile.displayName` | **OK** |
| Photo | **aucun champ** nulle part | Avatar a **initiales** sur fond de couleur metier (D4). Jamais de photo inventee. |
| Type (bricoleur, technicien, expert) | `ProviderProfile.type` | **OK** |
| Type « entreprise » | n'est **pas** un `ProviderType` : c'est `Company`, contrat et collection separes | **Hors perimetre** de cet ecran (§10) |
| Competences et services | `skillIds` / `serviceIds` -> noms via `GET /catalog/tree` | **OK** (meme resolution que `/requests`) |
| Zone approximative (ville) | `serviceAreas[].center` — point **exact** + rayon | **Partiel** : aucun champ ville, `MAP_PROVIDER=dev`, `reverseGeocode()` sans appelant. Rendu par `approximateCoordinates()` + rayon, **sans nom de ville**. |
| Verifications (badges) | `VerificationCase` (prive, lie par `targetId`) | **Demande un champ public** `verified` — §3.3 |
| Reputation (note, interventions) | **aucune source** — ni note, ni avis, ni compteur | **RIEN NE SERA AFFICHE.** D2 et 03 §2 l'interdisent ; c'est la Phase 10 produit. |
| Disponibilite | `availability` (creneaux) + `availabilityStatus` | **OK** |
| Langues | `languages` | **OK** |

Cote interdits, l'etat des lieux est plus favorable que redoute : le
telephone et l'e-mail vivent sur `User` et **ne sont deja pas** renvoyes par
`GET /providers/:id`. La fuite reelle est ailleurs — la route renvoie
aujourd'hui le `ProviderProfile` entier, donc `serviceAreas[].center`, le
**point GPS exact** du fournisseur, et `userId`. C'est ce que corrige §3.1.

## 3. Le perimetre backend de cette phase — trois changements de contrat

La phase 7 n'est pas une phase purement visuelle : les trois ecrans sont
impossibles sans ces trois ajouts. Chacun est teste avant d'etre affiche.

### 3.1 `PublicProviderProfile` (Decision 70)

Nouveau schema dans `packages/contracts/src/provider.ts`, sur le modele
**deja en vigueur** de `ProviderMatchSchema` — « vue restreinte deliberee »
face a `MatchCandidateSchema` (commentaire de `matching.ts:85`).

Champs conserves : `id`, `type`, `displayName`, `bio`, `languages`,
`experienceYears`, `skillIds`, `serviceIds`, `availability`,
`availabilityStatus`, `createdAt`, plus deux champs derives —
`serviceZones: [{ approximateCenter, radiusKm }]` (via
`approximateCoordinates()`) et `verified: boolean` (§3.3).

Champs retires par rapport a `ProviderProfile` : `userId`, `serviceAreas`
(centres exacts), `updatedAt`.

- `GET /providers/:id` renvoie **la vue publique** ; `GET /providers/me`
  garde la vue complete (c'est son propre profil).
- Test e2e explicite : la reponse de `GET /providers/:id` **ne contient
  aucune** des cles interdites, et le centre renvoye **differe** du centre
  stocke. Un test qui echoue si quelqu'un re-elargit la route un jour.

### 3.2 `icon` et `accentColor` sur les noeuds du catalogue (D3 / Decision 62)

Deja **validee par l'utilisateur le 2026-09-21**, jamais implementee — et la
grille de l'accueil ne peut pas exister sans. Champs optionnels sur
`CatalogNode`, donc retro-compatibles.

- `icon` : liste **fermee**, les icones du Design System (`Icon.tsx`) ;
- `accentColor` : liste **fermee**, les cles de `colors.trade`
  (`electrician`, `plumber`, `hvac`, `locksmith`, `painter`, `carpenter`,
  `appliance`, `it`, `cleaning`, `gardening`) — jamais une couleur libre, la
  conformite AA des paires ayant ete mesuree en phase 1 ;
- **heritage** : un noeud sans valeur prend celle de son ancetre le plus
  proche ; sans ancetre porteur, une tuile neutre (pas d'icone inventee) ;
- editables dans `apps/admin` (`PATCH /catalog/nodes/:id`), seul endroit ou
  l'administrateur est maitre de l'affichage.
- Domotique n'a toujours pas de couleur (decision ouverte de la phase 1) :
  elle n'est pas dans le catalogue reel, donc cela ne bloque pas.

### 3.3 Badge de verification

`verified` derive du `VerificationCase` **approuve** du fournisseur. Booleen
seul : ni le type de piece, ni la date, ni le dossier — rien de ce qui
regarde l'instruction du dossier ne sort. Si aucun cas approuve : `false`,
et **aucun badge** (pas de badge « non verifie », qui serait une accusation).

## 4. Accueil — `/`

Aujourd'hui `/` est une **redirection pure** vers `startRouteFor(user)`
(Decision 65). La phase 7 en fait un vrai ecran.

- **Visiteur non connecte** : l'accueil, avec la grille du catalogue et
  « Se connecter ». Aujourd'hui il est renvoye sur `/login` ; la grille
  fonctionne sans session (`GET /catalog/tree` est public, sans `AuthGuard`).
- **Utilisateur connecte** : l'accueil aussi. `startRouteFor()` **reste** la
  destination d'apres-connexion — la Decision 65 portait sur « ou l'on
  atterrit en se connectant », pas sur « ce que `/` affiche ». Une entree
  **Accueil** s'ajoute a la navigation des deux roles (l'AUDIT la juge
  legitime, contrairement a Favoris).
- **Contenu** : une tuile par DOMAIN actif (icone + couleur de §3.2, nom),
  qui mene a la recherche filtree sur ce domaine. Signature « Trouvez.
  Reservez. Reparez. » : **non** — « Reservez » promet la reservation, qui
  n'existe pas (D2).
- **Realite du volume** : le catalogue reel contient **2 domaines**
  (Electricite, Plomberie) plus un `Test Manuel` cree a la main en dev. La
  grille affichera donc 2 a 3 tuiles, pas les 10 de la planche. C'est voulu :
  elle grandira quand l'administrateur remplira le catalogue. Aucune tuile
  fictive ne sera ajoutee pour « remplir » la maquette.
- Etats : chargement, erreur, vide (« catalogue en cours de constitution »).

## 5. Recherche de services — `/services`

- Recherche **sur le catalogue**, pas sur les artisans (§7) : `SearchBar`
  existante, filtrage de l'arbre deja charge (`CATALOG_TREE_KEY`), donc
  aucune route API nouvelle et aucune latence reseau par frappe.
- Correspondance sur le nom a tous les niveaux, resultat groupe par
  DOMAIN > CATEGORY > SERVICE, chemin complet affiche (« Electricite ›
  Panne electrique › Panne electrique ») — sans quoi deux « Simple »
  homonymes seraient indiscernables.
- Un resultat de niveau SERVICE mene a `/requests/new` **preselectionne** sur
  ce service. C'est le seul lien qui a du sens : la demande est le seul
  parcours qui existe.
- `FilterBar` : filtre par domaine. Par urgence **non** — l'urgence
  n'appartient pas au catalogue mais a la demande.
- Etats : vide (« aucun service ne correspond »), chargement, erreur.
- Pas de « populaires », pas de « a partir de X DH », pas de favoris (D2).

## 6. Profil artisan — `/providers/[id]`

- Alimente par `GET /providers/:id` (vue publique de §3.1) et par
  `GET /catalog/tree` pour les noms de competences et de services.
- Bloc d'identite : avatar a initiales, nom, type, badge verifie si
  `verified`, statut de disponibilite.
- Bloc zone : centre approximatif + rayon, **sans nom de ville**, avec la
  mention explicite « zone approximative » — ne jamais laisser croire a une
  adresse. Pas de carte : `MAP_PROVIDER=dev`, aucun fournisseur reel.
- Blocs competences / services / langues / experience / creneaux.
- **Aucun bloc note, avis, interventions, prix.** Aucun bouton
  « Reserver » (n'existe pas) ni « Contacter » (une conversation naitra
  d'une candidature reelle, Phase 6 produit).
- **Point d'entree** : l'ecran de matching du client
  (`/requests/[id]/match`) liste deja ses candidats avec `providerId` et
  `providerDisplayName` — chaque nom devient un lien vers le profil. Sans ce
  point d'entree, la page serait une route orpheline.
- Etats : chargement, 404 (« ce profil n'existe pas »), erreur.

## 7. Decision ouverte — route de liste d'artisans (mode DIRECT)

`PLAN.md` la posait pour cette phase. Elle est **ouverte**, et j'ai besoin de
ta reponse.

Le backend sait deja faire du DIRECT : `StartMatchInput` accepte
`mode: "DIRECT"` avec un `providerId`. Mais **aucune route ne liste ni ne
cherche les fournisseurs** — `providers` n'expose que `me` et `:id`. Un
client ne peut donc designer un artisan que s'il connait deja son
identifiant. Le parcours « annuaire + reservation directe » est par ailleurs
declare **hors perimetre** par D2 et l'audit §4.

| Option | Contenu | Cout | Risque |
|---|---|---|---|
| **(a) Reporter** *(recommande)* | La phase 7 livre la recherche **de services** ; le DIRECT reste atteignable depuis le matching. Rien de neuf cote API. | nul | l'ecran « liste d'artisans » de la planche reste absent |
| (b) `GET /providers` filtre | Nouvelle route publique paginee (service, zone, disponibilite). | eleve : route publique de donnees personnelles, pagination, rate limit, index geo, tri a justifier | expose la base fournisseurs a tout visiteur ; un tri sans donnee de reputation serait arbitraire |
| (c) Liste des seuls candidats | Aucune route nouvelle : on ne liste que les fournisseurs deja dispatches sur une demande. | faible | ce n'est pas un annuaire ; recouvre l'ecran de matching existant |

Je recommande **(a)**, pour la raison qui a fait ecarter les ecrans 4 a 6 :
un annuaire sans reputation, sans photo et sans prix serait une liste de noms
que rien ne permet de departager — et (b) est une decision d'exposition de
donnees personnelles qui merite sa propre phase, pas un effet de bord d'une
phase de design.

## 8. Tests

- **Contrats** (`packages/contracts`) : `PublicProviderProfileSchema` rejette
  les cles interdites ; `icon`/`accentColor` bornes aux listes fermees ;
  retro-compatibilite (un noeud sans ces champs reste valide).
- **API e2e** : `GET /providers/:id` ne renvoie ni `userId`, ni
  `serviceAreas`, ni coordonnees exactes — et le centre renvoye differe du
  centre stocke ; `verified` vrai seulement avec un cas approuve ;
  `GET /providers/me` garde la vue complete ; heritage `icon`/`accentColor`.
- **Unitaires web** (vitest, ajoute en phase 6) : filtrage et groupement de
  la recherche, chemin complet d'un resultat, resolution des noms de
  competences, rendu de la zone approximative, tuile sans `icon` ni
  `accentColor` (cas neutre).
- **Playwright**, par l'interface :
  1. visiteur non connecte : accueil -> tuile de domaine -> recherche
     filtree ;
  2. recherche : frappe -> resultat -> `/requests/new` preselectionne ;
  3. client : ecran de matching -> nom du candidat -> profil public ; la page
     ne contient **ni** telephone, **ni** e-mail, **ni** note ;
  4. administrateur : pose une icone et une couleur sur un domaine, la tuile
     de l'accueil change ;
  5. les liens internes rendus repondent (< 400) — controle existant etendu.
- Contrastes **mesures** pour toute paire couleur/texte nouvelle (regle de
  fin de phase de `PLAN.md`).
- Decision 68 : pas de seuil de couverture impose ; pas de `console.log`,
  fonctions de moins de 50 lignes.

## 9. Ordre des taches

1. Contrats : `PublicProviderProfile`, `icon`/`accentColor`, `verified` —
   tests rouges d'abord.
2. API : vue publique de `GET /providers/:id`, heritage catalogue, derivation
   de `verified` ; e2e verts.
3. `apps/admin` : edition de l'icone et de la couleur d'un noeud.
4. Accueil `/` + entree « Accueil » dans la navigation des deux roles.
5. Recherche `/services`.
6. Profil `/providers/[id]` + liens depuis l'ecran de matching.
7. Gates `lint`, `typecheck`, `test`, `build` **sans cache** ; images Docker
   reconstruites ; Playwright complet ; captures 360 / 768 / 1440 / RTL
   examinees.
8. `docs/design/PHASE_7_REPORT.md`, `docs/PROGRESS.md`, commit dedie, push,
   **CI verte verifiee** (elle l'est depuis `a46fa28`).

## 10. Hors perimetre

Reservation, suivi, avis, paiement (D2 — phases produit 7 a 10) ; annuaire
d'artisans si l'option (a) est retenue (§7) ; profil **entreprise**
(`Company`, contrat separe) ; edition du profil artisan par lui-meme
(phase 8 de la refonte) ; carte (aucun fournisseur reel) ; traduction des
libelles (l'i18n n'est branchee dans aucun ecran) ; couleur de Domotique
(absente du catalogue reel).

## 11. Risques

- **Phase la plus lourde en backend de toute la refonte** : trois
  changements de contrat avant la premiere ligne d'interface. Attenuation :
  l'ordre du §9 les livre et les teste d'abord.
- **Catalogue reel quasi vide** (2 domaines) : l'accueil paraitra pauvre
  a cote de la planche. C'est un constat sur la donnee, pas un defaut de
  l'ecran ; le remplissage est un acte d'administration.
- **`GET /providers/:id` est public et non limite en debit** : la vue
  publique le rend enumerable. A verifier a l'implementation — un rate limit
  de lecture n'a pas ete adopte (Decision 68), mais l'enumeration de profils
  merite peut-etre une exception ; je le signalerai plutot que de le decider
  seul.
- **Rupture possible** pour qui avait `/` en marque-page comme redirection :
  comportement change, assume et documente.
- `Test Manuel` traine dans le catalogue de dev et apparaitra dans la
  grille : donnee de dev, a nettoyer par l'administrateur, pas par le code.
