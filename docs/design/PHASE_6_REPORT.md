# PHASE 6 (REFONTE) — NAVIGATION — RAPPORT

## Statut : TERMINEE

Debut / fin : 2026-09-22. Plan : `docs/design/PHASE_6_PLAN.md` (valide avant
implementation). Decisions du tour : 67 (page Profil minimale), 68 (regles
ECC), 69 (rollback de `08_ECC_INTEGRATION.md`).

## Objectifs (statut)

- ✅ Navbar et BottomNavigation remplies, par role, etat actif reel.
- ✅ Les 6 entrees prevues, toutes vers une route qui existe.
- ✅ Pages `/requests` et `/conversations` creees.
- ✅ Page `/profile` minimale (Decision 67), avec la **premiere deconnexion
  du produit**.
- ✅ Entree Catalogue et deconnexion dans `apps/admin`.
- ✅ Hauteur du chat corrigee sous la barre basse.
- ✅ Gates sans cache, Playwright contre images reconstruites, captures.

## Ce qui a ete fait

### Modele de navigation (`apps/web/src/lib/navigation.ts`)

Fonctions pures, testees, seule source des destinations :
`navigationFor(user, unreadCount)`, `activeNavHref(pathname, items)`,
`requestHref(request)`, `totalUnread(conversations)`.

| Role | Entrees |
|---|---|
| Non connecte | aucune |
| Client | Demander · Mes demandes · Messages · Profil |
| Fournisseur | Demandes recues · Messages · Demander · Mes demandes · Profil |
| Admin (`apps/admin`) | Catalogue + bouton « Se deconnecter » dans l'en-tete |

Un fournisseur garde les entrees client (leve la limite de la Decision 65).
L'entree active est portee par `aria-current="page"`, pas seulement par la
couleur, et un ecran de detail reste sous sa liste (`/conversations/<id>` ->
Messages) : la correspondance retient le **prefixe le plus long**, sinon
`/requests/new` allumait aussi « Mes demandes ».

### Ecrans crees

- **`/requests`** — service resolu depuis le vrai catalogue, extrait de
  description, urgence, statut, date. Le lien depend du statut : brouillon ->
  le formulaire (qui le reprend deja), `REQUESTED`/`MATCHING` -> l'ecran de
  matching, `CANCELLED`/`EXPIRED` -> **aucun lien** (rien a y faire).
- **`/conversations`** — interlocuteur, role, date du dernier message,
  compteur de non-lus, mention « Lecture seule » quand `canSend` est faux.
  Pas d'apercu du dernier message : le contrat ne le porte pas.
- **`/profile`** — e-mail du compte, « Se deconnecter », « Retour a
  l'accueil ». Rien d'autre (Decision 67). L'e-mail etant nullable (connexion
  par telephone), l'ecran affiche « Aucun e-mail renseigne ».

### Coques

`AppChrome` (web et admin) est le seul endroit qui decide du contenu de la
navigation ; les `layout.tsx` restent des composants serveur. Rien n'est rendu
avant l'hydratation de la session (Decision 46.3).

Compteur de non-lus : une seule requete `["conversations"]` sert la barre
**et** l'ecran Messages ; elle est invalidee par les evenements socket
`messageCreated` et `receiptsUpdated`. Aucun sondage periodique — la socket
notifie, l'API reste la source de verite (#49).

Deconnexion : `POST /auth/logout` puis fermeture de la socket et purge de la
session. L'appel serveur est **best-effort** : une session deja morte doit
quand meme etre nettoyee localement, sinon l'utilisateur reste bloque dessus.

## Defauts trouves et corriges

1. **Le composeur du chat passait sous la barre basse.** `.fx-shell__fill`
   retirait la hauteur de l'en-tete mais pas celle de la barre, alors que la
   coque reserve deja cette place. Corrige, avec un test qui echoue si la
   regle disparait ou si elle reste appliquee au-dessus de 768 px.
2. **Icones desalignees dans la barre basse** (capture reelle, 360 px) : a
   cinq entrees, « Demandes recues » et « Mes demandes » prennent deux
   lignes, et chaque lien etant centre sur sa propre hauteur, les icones ne
   s'alignaient plus. Corrige : alignement en haut, avec un retrait.
3. **La barre basse etait trop courte de 4 px** pour deux lignes de libelle
   (8 + 24 + 4 + 2x16 = 68 > 64). `bottomNavHeight` passe a **72 px** dans
   `tokens.ts` **et** `tokens.css` (le test de synchronisation impose les
   deux). Playwright verifie desormais que chaque entree tient dans la barre
   et garde 44 px de cible.
4. **Quota OTP epuise par les relances.** `otp-verify` est limite a 30/h par
   IP et les compteurs Redis survivent a une execution : rejouer la suite
   dans l'heure faisait echouer des scenarios sans rapport
   (« Too many requests »). Meme classe que la Decision 32. Corrige par un
   `globalSetup` Playwright qui vide les cles `ratelimit:otp-*` du **stack de
   dev** avant la suite, exactement ce que fait deja `apps/api`
   (`rate-limit-test-helper.ts`). Les limites elles-memes sont inchangees.

## Tests

| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/web` (nouveau : `vitest`) | 0 | **20** |
| `@fixiyi/ui` | 232 | **235** (hauteur de fill sous la barre) |
| `@fixiyi/api`, `contracts`, autres | inchangees | inchangees |
| **Monorepo** | 709 | **731** |
| Playwright | 33 | **38** |

Les 5 nouveaux scenarios navigateur, tous **par l'interface** :

1. un client atteint « Mes demandes » depuis la barre, la demande y figure au
   bon statut, le lien ouvre l'ecran de matching, et l'entree reste active ;
2. un fournisseur sur telephone (360 px) : barre basse visible, navbar
   masquee, 5 entrees, chacune tient dans la barre avec 44 px de cible ;
3. tablette 768 px et RTL : la navbar reprend la main, la barre basse
   disparait, la mise en miroir tient ;
4. Profil : e-mail affiche, deconnexion — et la session est **morte cote
   serveur** (l'ancien refresh token renvoie 401, l'access token aussi) ;
5. compteur de non-lus entre deux navigateurs : il apparait sans rechargement
   quand l'artisan ecrit, et disparait quand le client lit le fil.

## Commandes et resultats

```
pnpm lint --force                  -> 15/15, 0 erreur, 0 avertissement
pnpm typecheck --force             -> 15/15, 0 erreur
pnpm test --concurrency=2          -> 14/14 taches, 731 tests
pnpm build --force                 -> 10/10
docker compose ... up -d --build web admin   -> 7 services sains
playwright test                    -> 38/38
```

Captures examinees : `30-bottom-nav-phone.png` (360 px), `31-navbar-desktop.png`
(1280 px), `32-nav-tablet.png` (768 px), `33-nav-rtl.png`.

## Limitations

- **Listes non paginees** : `GET /requests/mine` et `GET /conversations`
  renvoient tout. Sans effet au volume actuel ; a borner cote API avant la
  production (changement de contrat, hors phase).
- Finition visuelle des listes : phase 8 (pages secondaires).
- La page Profil est provisoire (Decision 67) ; pas d'edition, pas de
  gestion des sessions.
- Libelles en francais en dur, comme le reste de l'interface : l'i18n n'est
  branchee dans aucun ecran a ce jour.
- Le back-office n'a qu'une destination ; son tableau de bord reste la
  Phase 12.

## Prochaine phase

Phase 7 de la refonte — pages principales (accueil sur le vrai catalogue,
recherche de services, profil artisan en vue publique). Deux decisions
ouvertes a trancher a ce moment-la : la vue publique de `GET /providers/:id`
(fuite des coordonnees) et les champs `icon`/`accentColor` du catalogue
(D3 / Decision 62, validee, non implementee).
