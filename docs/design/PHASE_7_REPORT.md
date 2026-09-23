# PHASE 7 (REFONTE) — PAGES PRINCIPALES — RAPPORT

Date : 2026-09-23. Statut : **TERMINEE**. Plan suivi :
`docs/design/PHASE_7_PLAN.md`. Decisions de cette phase : **70** (vue
publique de `GET /providers/:id`) et **71** (pas de route de liste
d'artisans — option (a), reporter).

## 1. Ce qui est livre

Trois ecrans, et les trois changements de contrat sans lesquels ils
n'existaient pas.

| Ecran | Route | Source reelle |
|---|---|---|
| Accueil | `/` | `GET /catalog/tree` (public) |
| Recherche de services | `/services` | le meme arbre, filtre en memoire |
| Profil artisan | `/providers/[id]` | `GET /providers/:id`, vue publique |

### 1.1 `PublicProviderProfile` — la vue publique (Decision 70)

`GET /providers/:id` renvoyait le `ProviderProfile` **entier**. Le telephone
et l'e-mail vivent sur `User` et n'en faisaient deja pas partie ; la fuite
reelle etait ailleurs et elle etait serieuse : `serviceAreas[].center`, le
point GPS **exact** du fournisseur — souvent son domicile ou son atelier —
et `userId`, qui designe la personne derriere le profil.

La route renvoie desormais un schema distinct, `.strict()`, qui **rejette**
toute cle inconnue. C'est le garde-fou : re-elargir la route fait echouer les
tests de contrat au lieu de fuiter en silence. La zone est rendue par
`approximateCoordinates()` — le meme flou que le moteur de matching applique
deja a l'adresse du client avant qu'un fournisseur la voie
(01_SPEC_PRODUCT.md #17). `GET /providers/me` garde la vue complete : c'est
son propre profil.

**Trois champs de la liste autorisee n'ont ete affiches nulle part**, faute
de source :

- **photo** : aucun champ — avatar a initiales (D4) ;
- **ville** : aucun champ ville, `MAP_PROVIDER=dev`, `reverseGeocode()` sans
  appelant — la zone est rendue en coordonnees floutees et en rayon, avec la
  mention explicite « Zone approximative » ;
- **reputation** : ni note, ni avis, ni compteur d'interventions n'existent
  en base — **rien n'est affiche**, et un test verifie que la page ne
  contient ni « avis », ni « /5 ».

### 1.2 `icon` et `accentColor` sur les noeuds du catalogue (Decision 62 / D3)

Validee le 2026-09-21, **jamais implementee** — la grille ne pouvait pas
exister sans. Deux listes **fermees** dans `@fixiyi/contracts` (13 icones
metier, les 10 cles de la palette metiers), des champs optionnels qui
laissent valides tous les noeuds deja stockes, et un **heritage resolu a la
lecture** : un noeud sans valeur prend celle de son ancetre le plus proche.

L'heritage est calcule, jamais copie — poser la couleur d'un domaine une fois
atteint une categorie creee plus tard, et renommer ou deplacer un noeud ne
laisse pas de copie perimee derriere.

Consequence decouverte a l'implementation : le back-office doit voir la
valeur **brute**, pas la valeur heritee. Un editeur pre-rempli avec la
couleur heritee l'aurait reecrite comme valeur propre du noeud au premier
enregistrement, cassant en silence l'heritage dont l'administrateur se
servait. D'ou `GET /catalog/tree?rawDisplay=true`, que `apps/admin` utilise,
et un test e2e qui compare les deux reponses.

### 1.3 Badge de verification

`verified` derive du `VerificationCase` au statut `VERIFIED`. Un booleen
seul : ni le dossier, ni la piece, ni la date ne sortent. Aucun cas approuve
-> `false` et **aucun badge** — pas de badge « non verifie », qui serait une
accusation.

## 2. Ce que les captures ont montre

`docs/design/evidence/phase7/` — 360, 768, 1440 et RTL.

- **L'accueil affiche 3 tuiles**, pas les 10 de la planche : le catalogue
  reel contient deux domaines (Electricite, Plomberie) plus un `Test Manuel`
  cree a la main en developpement. C'etait annonce au plan §4. Aucune tuile
  fictive n'a ete ajoutee pour remplir la maquette.
- `Test Manuel` n'a ni icone ni couleur, et s'affiche donc avec une pastille
  neutre et **vide**. C'est le comportement voulu : rien n'est invente pour
  combler.
- **Deux defauts corriges apres examen des captures** :
  - le bouton affichait « **+** Se connecter » — le plus appartient a la
    creation d'une demande, pas a une connexion ;
  - a 360 px la grille tombait a **une seule colonne** (`minmax(9rem, 1fr)`
    ne tenait pas dans le rembourrage de la carte) ; ramenee a `7.5rem`, elle
    en affiche deux.
- **RTL** : la premiere capture etait identique a la LTR — `dir` pose par
  `addInitScript` est ecrase par le rendu serveur de React. Repris **apres**
  hydratation, comme le fait deja `navigation.spec.ts`. Le miroir est
  correct : logo, en-tete, grille et champ de recherche.
- La recherche montre pourquoi le chemin d'ascendance etait necessaire :
  « Panne electrique » apparait **deux fois**, une categorie et un service,
  que seuls le chemin et le badge distinguent.

## 3. Tests

| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/api` | 286 | **294** |
| `@fixiyi/contracts` | 92 | **110** |
| `@fixiyi/design-tokens` | 49 | **59** |
| `@fixiyi/web` | 20 | **33** |
| Playwright | 38 | **48** |

Les plus utiles :

- le contrat **rejette** `userId`, `serviceAreas`, `phone`, `email`,
  `updatedAt`, et refuse le `ProviderProfile` complet en bloc ;
- en e2e, le centre renvoye **differe** du centre stocke — un test qui
  echoue si le flou saute ;
- les 10 paires icone/pastille sont **mesurees** (>= 3:1, seuil objet
  graphique) par le test de contrastes existant, via `contrastPairs` ;
- un test relie les listes fermees du contrat au Design System : renommer une
  icone ou retirer une couleur metier fait echouer la suite au lieu de livrer
  une tuile qui ne dessine rien. Il vit dans `apps/web` parce que
  `@fixiyi/contracts` ne depend que de zod et ne peut pas se verifier
  lui-meme.

## 4. Ce qui a resiste, et pourquoi

### 4.1 Le cycle de dependances — `forwardRef` refuse

Le badge demandait que `ProviderService` interroge `VerificationService`, qui
depend deja de `ProviderService`. J'ai d'abord pose un `forwardRef` des deux
cotes : Nest l'accepte, **le depot non** — `import-x/no-cycle` a fait echouer
le lint. Fixiyi prime : le choix architectural du depot passe avant le
raccourci du framework.

Repris en `PublicProviderModule`, un module de **lecture** qui depend des deux
et dont aucun ne depend. Le graphe reste acyclique, et le nom dit ce que
c'est : une vue, pas un domaine. `GET /providers/me` (statique) reste servi
avant `GET /providers/:id` (parametre) — Fastify donne la priorite au
segment statique quel que soit l'ordre d'enregistrement.

### 4.2 Trois tests existants reposaient sur l'ancienne redirection

`/` etait une redirection nue. `create-request`, `session-refresh` et deux
tests de `navigation` faisaient `goto("/")` en comptant dessus pour atteindre
`/login` ou l'ecran fournisseur. Mis a jour vers la route explicite : le
changement de comportement est voulu et documente, ce sont les tests qui
devaient suivre.

### 4.3 La suite navigateur depassait un plafond de debit

Apres l'ajout de mes scenarios, des specs **sans rapport** echouaient. Deux
causes distinctes, toutes deux reelles :

1. **`ratelimit:refresh:ip` a 67 pour une limite de 60.** Le `global-setup`
   ne purgeait que `ratelimit:otp-*` ; la suite a grossi et s'est mise a
   heurter `refresh`, que ce motif laissait derriere — et l'echec se
   presentait comme un `401` sortant de `setUpProvider`, ce qui ne ressemble
   en rien a un plafond de debit. Motif elargi a `ratelimit:*`, comme le fait
   deja l'aide e2e de `apps/api`.
2. **Pollution du lot de dispatch.** Mes trois fournisseurs de test etaient
   crees `AVAILABLE` a Casablanca sur le service seme : ils entraient donc en
   concurrence dans le lot borne a 3 candidats et en chassaient celui du test
   de matching. `setUpProvider` accepte desormais un statut initial, et les
   fournisseurs qui n'existent que pour etre **regardes** sont crees
   `OFFLINE`.

La suite passe **deux fois de suite** a 48/48, ce qui est le vrai critere :
c'est la repetabilite qui etait cassee, pas une execution.

## 5. Gates

`pnpm lint` 15/15, `pnpm typecheck` 15/15, `pnpm test` 14/14, `pnpm build`
10/10 — 0 erreur, 0 warning. Images `api`, `web` et `admin` reconstruites,
Playwright 48/48 contre la stack Docker reelle.

Note : un `docker compose build api web admin` en une seule commande a echoue
une fois sur `admin` ; les trois images reconstruites **sequentiellement**
passent. Contention de ressources a la construction parallele, pas un defaut
du Dockerfile.

## 6. Hors perimetre, et assume

- **Annuaire d'artisans** : reporte (Decision 71). La recherche porte sur les
  **services**.
- **Entree « Accueil » dans la navigation** : le plan §4 en prevoyait une. La
  `BottomNavigation` est bornee a 5 entrees et un fournisseur en a deja 5 ;
  une sixieme aurait casse le composant. Le **logo** mene a `/` et reste
  visible a tous les breakpoints — c'est l'affordance d'accueil, et elle
  existait deja.
- **Zone en coordonnees** : « Environ 30 km autour de 33.51, -7.61 » est
  honnete mais aride. Un nom de ville demande un geocodeur inverse reel ; a
  reprendre quand `MAP_PROVIDER` en aura un.
- Reservation, suivi, avis, paiement (D2) ; profil entreprise ; edition du
  profil par l'artisan (phase 8) ; traduction des libelles.

## 7. Restes signales, non traites

- **`GET /providers/:id` est public et sans limite de debit** : la vue
  publique rend les profils enumerables. La Decision 68 a ecarte le rate
  limit sur les routes de lecture ; l'enumeration de profils merite peut-etre
  une exception. **Signale, pas decide seul.**
- **`STORAGE_PROVIDER` reste un parametre mort** (`docs/PROGRESS.md`).
- Le catalogue de developpement contient des noeuds de test (`Test Manuel`,
  et ceux que les e2e creent sans les nettoyer) qui apparaissent dans la
  grille. Donnee de developpement, a nettoyer par l'administrateur.
