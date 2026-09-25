# PHASE 8 (REFONTE) — PAGES SECONDAIRES — PLAN

Date : 2026-09-25. Statut : **plan soumis, implementation en attente du GO**.

Sources lues : `docs/design/PLAN.md` (phase 8), `AUDIT.md`,
`PHASE_7_REPORT.md`, `docs/DECISIONS.md` (62, 65, 70-79),
`docs/ECC_HARDENING_PLAN.md`. Et les cinq ecrans concernes, lus
integralement : `requests/new`, `requests/[id]/match`, `provider/requests`,
`conversations` et `conversations/[id]`, `apps/admin/catalog`.

Competences externes : **non utilisees** (`08_ECC_INTEGRATION.md`). Le design
system est deja choisi, construit et mesure.

## 1. Le vrai sujet de cette phase

Ces cinq ecrans **existent et fonctionnent**. Ils ont ete construits aux
phases 4 a 6 pour prouver que le moteur marchait, et jamais habilles. Le
travail n'est donc ni de la conception ni du branchement : c'est de rendre
lisible ce qui parle aujourd'hui la langue du moteur.

Le symptome se voit en une ligne, sur l'ecran de matching :

```
Statut : ACTIVE          Vagues envoyees : 2
NOTIFIED                 vague 1 · 0.0 km · score 0.78
```

`ACTIVE`, `NOTIFIED`, `score 0.78`, « vagues » : ce sont les mots de
`matching.service.ts`, pas ceux d'un client qui attend un plombier. Aucun de
ces ecrans ne ment — c'est deja beaucoup — mais ils ne se lisent pas.

Critere de sortie : **un client et un artisan comprennent leur ecran sans
qu'on leur explique le moteur**, et aucune donnee affichee n'est inventee
(D2, 03 §2).

## 2. Inventaire, ecran par ecran

| Ecran | Lignes | Etat reel | Travail |
|---|---|---|---|
| `requests/new` | 329 + 3 composants | **deja repris** (M4, Decision 78) | finition seulement |
| `requests/[id]/match` | 252 | enums bruts, vocabulaire moteur | **le plus gros** |
| `provider/requests` | 160 | enums bruts, pas de nom de service | important |
| `conversations` (liste) | 102 | correcte, sobre | leger |
| `conversations/[id]` | 187 + 2 | **la mieux habillee** (composants `Chat` de la phase 4) | leger |
| `apps/admin/catalog` | 339 | outil brut, fonctionnel | moyen |

### 2.1 `requests/[id]/match` — l'ecran d'attente du client

C'est l'ecran ou un client attend, et c'est celui qui lui parle le moins.

A traduire :
- `ACTIVE` / `COMPLETED` / `EXPIRED` -> « Recherche en cours », « Un artisan a
  repondu », « Recherche terminee sans reponse » ;
- `NOTIFIED` / `VIEWED` / `DECLINED` -> « Prevenu », « A vu la demande »,
  « A decline » ;
- « Vagues envoyees : 2 » -> le nombre de vagues est une notion du moteur.
  Ce qui interesse le client, c'est **combien d'artisans ont ete contactes**
  et **jusqu'ou on cherche**. La vague disparait de l'ecran, pas de l'API.
- **`score 0.78` disparait.** Le score de classement est un detail
  d'implementation ; l'afficher invite a le comparer alors qu'il ne veut rien
  dire pour un client. Il reste dans `GET /match/candidates` pour le
  back-office.

A ajouter, avec une source reelle :
- le **nom du service demande** (via `GET /catalog/tree`, comme `/requests`) ;
- l'**avancement** de la recherche : rayon courant et nombre de contactes,
  en une phrase plutot qu'en quatre lignes d'etat.

A ne pas ajouter : estimation de delai, probabilite de reponse, « 3 artisans
regardent votre demande en ce moment ». Rien de tout cela n'existe.

### 2.2 `provider/requests` — la boite de l'artisan

- `URGENT` / `NORMAL` et `NOTIFIED` / `VIEWED` traduits.
- **Le nom du service manque** : la carte montre la description libre du
  client mais pas ce qu'il a choisi dans le catalogue, alors que
  `ProviderMatch` porte `serviceId`, `interventionTypeId` et `complexityId`.
  C'est l'information dont un artisan a le plus besoin pour decider.
- « Zone approximative : 33.51, -7.61 » : meme limite qu'au profil artisan
  (phase 7) — pas de geocodeur inverse, donc pas de nom de ville. La
  formulation peut au moins etre humaine.
- « 2 media(s) joint(s) » -> « 2 photos », accorde.
- L'expiration (`expiresAt`) est dans le contrat et **n'est pas affichee** :
  c'est pourtant ce qui presse l'artisan.

### 2.3 `conversations` et `conversations/[id]`

Le fil de discussion est le mieux traite du lot — il utilise deja
`MessageBubble`, `ReplyQuote`, `TypingIndicator`. Travail leger :
- etats vide / erreur homogenes avec le reste ;
- la liste affiche « lecture seule » quand `canSend` est faux, sans dire
  **pourquoi** (la candidature n'est plus active) ;
- verifier la tenue a 360 px sous la barre basse (deja corrige en phase 6,
  a re-verifier apres retouches).

### 2.4 `apps/admin/catalog`

Outil interne, et c'est un choix (06_SCOPE : le vrai back-office est la
phase 12). Le minimum pour qu'il soit utilisable :
- l'arbre est une suite de lignes plates a `marginInlineStart` croissant ;
  une hierarchie lisible aiderait l'administrateur qui doit poser une icone
  au bon niveau (phase 7) ;
- les niveaux (`DOMAIN`, `CATEGORY`…) restent en anglais **volontairement** :
  c'est le vocabulaire du contrat, et l'ecran s'adresse a un operateur.
  A confirmer (§5).

## 3. Ce que cette phase **n'ajoute pas**

Rappel, parce que c'est la ou la pression est la plus forte sur des ecrans
« secondaires » qui paraissent vides :

- ni note, ni avis, ni compteur d'interventions (D2, Decision 70) ;
- ni photo d'artisan (D4 — avatars a initiales) ;
- ni prix « a partir de », ni delai estime, ni « X personnes regardent » ;
- ni reservation, ni suivi de mission (phases produit 7 a 10) ;
- ni carte (`MAP_PROVIDER=dev`).

Si un ecran parait vide apres traduction, c'est que la donnee n'existe pas.
On l'ecrit dans le rapport ; on ne le remplit pas.

## 4. Un moyen, pas cinq

Les libelles traduits sont aujourd'hui **dupliques** : `/requests` a sa table
`STATUS_LABEL`, `/match` a la sienne, `provider/requests` en a une troisieme
implicite. Trois tables pour les memes enums, c'est trois occasions de
diverger.

Proposition : une table par enum dans `apps/web/src/lib/labels.ts`, testee,
**exhaustive par construction** (`Record<Enum, string>` — ajouter une valeur
a l'enum casse la compilation tant que le libelle manque). C'est le meme
principe que `logLevelsFor` (Decision 75) : la table dit tout, une fois.

## 5. Decisions a prendre

1. **Le score de classement** : je propose de le **retirer** de l'ecran
   client. Il reste dans l'API et dans les tests. A confirmer.
2. **Les vagues de dispatch** : je propose de les retirer de l'ecran client
   au profit de « N artisans contactes, jusqu'a X km ». A confirmer.
3. **L'admin en anglais** : je propose de garder `DOMAIN`/`CATEGORY` tels
   quels (vocabulaire du contrat, operateur averti). A confirmer.

Rien d'autre n'est ouvert : le reste est de la traduction et de la mise en
forme sur des donnees qui existent deja.

## 6. Tests

- **Unitaires** (`apps/web`) : la table de libelles est exhaustive pour
  chaque enum, et aucun libelle n'est vide. C'est le test qui empeche
  qu'un `NOTIFIED` reapparaisse a l'ecran.
- **Playwright**, par l'interface :
  1. client : apres soumission, l'ecran d'attente affiche le **nom du
     service** et un statut en francais — et **ne contient ni `ACTIVE`, ni
     `NOTIFIED`, ni `score`** ;
  2. artisan : sa boite montre le nom du service et le temps restant ;
  3. lecture seule : une conversation fermee dit pourquoi ;
  4. 360 px : les cinq ecrans tiennent, chat compris ;
  5. les 48 scenarios existants passent **sans modification de leurs
     assertions** — les `data-testid` ne bougent pas.
- Contrastes mesures pour toute paire nouvelle (regle de fin de phase).
- Planchers de couverture inchanges ou en hausse (Decision 74).

## 7. Ordre des taches

1. `labels.ts` et ses tests (rouge puis vert).
2. `requests/[id]/match` — le plus gros.
3. `provider/requests` — nom du service, expiration.
4. `conversations` et `conversations/[id]` — finitions.
5. `apps/admin/catalog` — hierarchie lisible.
6. Gates sans cache, images reconstruites, Playwright complet.
7. Captures 360 / 768 / 1440 / RTL examinees.
8. `PHASE_8_REPORT.md`, `PROGRESS.md`, **reference de rollback mise a jour**
   (Decision 69 — c'est une etape de la phase, pas une intention), commit,
   push, CI verte.

## 8. Risques

- **Traduire n'est pas decider** : remplacer `ACTIVE` par « Recherche en
  cours » suppose que je comprends l'etat comme le moteur le produit. Chaque
  libelle sera adosse a la machine a etats reelle, pas devine.
- **Retirer le score** est une perte d'information pour qui debuggait avec.
  Il reste dans l'API et dans `GET /match/candidates`.
- **L'admin peut deborder** : la phase 12 est le vrai back-office. Limite
  posee au §2.4 — lisibilite de l'arbre, rien de plus.
- **Ecrans qui paraissent vides** : c'est le risque de la phase. La reponse
  est au §3, et elle ne bouge pas.
