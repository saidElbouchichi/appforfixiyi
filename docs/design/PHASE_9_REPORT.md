# PHASE 9 (REFONTE) — ETATS — RAPPORT

Date : 2026-09-25. Statut : **TERMINEE**. Plan : `docs/design/PHASE_9_PLAN.md`.

Passe de **consolidation** (`PLAN.md`) : les etats existaient deja sur les 14
ecrans. Cette phase a enleve leurs divergences, pas comble un manque.

## 1. Ce que l'audit a trouve

Les 14 `page.tsx` de `apps/web` et `apps/admin`, mesures.

**Deja bon, et confirme** : chaque ecran qui charge a un `Skeleton`, un
`ErrorState`, et un `EmptyState` quand une liste peut etre vide. Les libelles
de chargement suivaient deja une meme forme. Rien a rattraper.

**Quatre divergences, toutes corrigees** :

### A. Le meme ternaire, dix-neuf fois

```tsx
error instanceof ApiError ? error.message : "Impossible de charger X."
```

L'audit en annoncait onze : il n'avait compte que les `message=` d'un
`ErrorState`. Il y en avait aussi dans des `setError(...)`. **Dix-neuf
copies**, dans treize fichiers.

Remplacees par `errorMessage(error, fallback)`. Le helper prefere le message
de l'API — « Cette demande n'existe plus » vaut mieux que « Impossible de
charger » — et se rabat sur le repli pour tout le reste, parce qu'une panne
reseau porte de l'anglais de developpeur (`Failed to fetch`) qui n'a rien a
faire sur un ecran. Un test le verifie, y compris le cas ou l'API repond avec
un message vide.

Deux copies du helper, une par app : les deux applications ne partagent pas
de code hors `packages` (Decision 51) et chacune a son propre `ApiError`.

### B. Du vocabulaire moteur avait survecu dans les etats

La phase 8 a nettoye les ecrans. Elle n'a pas regarde leurs **etats** :

- `label="Chargement du matching…"`
- `"Impossible de charger le matching."`

Le meme defaut, un cran plus bas que la ou tout le monde avait regarde.

### C. Reessayer, la ou reessayer sert

L'audit annoncait cinq `ErrorState` sans reprise. **Il se trompait** : son
analyseur s'arretait au premier `>` et ratait les props ecrites sur
plusieurs lignes. Repris avec un parcours qui equilibre les accolades, il en
restait bien cinq — mais pas les memes.

Trois ont **raison** de ne pas proposer de reprise : « Acces refuse » (x2) et
« Profil introuvable ». Reessayer ne changera pas un droit ni un profil
absent ; un bouton y serait une fausse promesse.

Deux etaient de vraies impasses, et sont corrigees :

- le **fil de discussion** : un premier chargement rate laissait l'ecran mort.
  `useChatThread` expose desormais `reload()` ;
- le **formulaire de demande** : si la recherche du brouillon echouait, le
  formulaire restait inutilisable sans aucun recours.

### D. Deux formulations pour un meme vide

« Aucune demande » et « Aucune demande pour le moment » disaient la meme
chose de deux facons.

En revanche « Catalogue vide » (admin) et « Catalogue en cours de
constitution » (visiteur) **restent differents**, volontairement : un
operateur qui doit remplir le catalogue et un visiteur qui le consulte n'ont
pas besoin de la meme phrase. Harmoniser n'est pas uniformiser.

## 2. Le test qui verrouille

`states.test.ts` lit les ecrans et echoue si une chaine montree a un lecteur
(`label`, `title`, `message`, `hint`, `placeholder`) contient un mot du
moteur : `matching`, `dispatch`, `batch`, `candidate`, `payload`.

**Il a ete verifie en le faisant echouer** : en remettant
`label="Chargement du matching…"`, la suite passe de 2 verts a 1 echec, en
nommant le fichier. Un test qui ne peut rien attraper est du theatre ; celui-ci
attrape.

Meme principe que `env-usage.test.ts` pour la configuration : les deux regles
portent sur ce qui est **absent** d'un fichier, et rien d'autre ne peut le
voir.

## 3. Tests

| Suite | Avant | Apres |
|---|---|---|
| `apps/web` | 51 | **57** |
| Playwright | 49 | **49**, sans modification |

Couverture `apps/web` : 18,98 % -> **20,22 %**. Planchers tenus.

## 4. Gates

`pnpm lint` 15/15 **sans warning**, `typecheck` 15/15, `test` 14/14,
`build` 10/10. Images `web` et `admin` reconstruites (sequentiellement —
troisieme phase de suite ou la construction parallele echoue par contention),
Playwright 49/49.

## 5. Ce que la phase n'a pas fait

Aucun etat ajoute la ou il n'en manquait pas. Aucune refonte des composants
`Skeleton` / `ErrorState` / `EmptyState`, qui datent de la phase 4 et sont
testes. Aucun vide rempli : un vide reste un vide.

## 6. Note de methode

Deux fois dans cette phase, mon propre audit s'est trompe — sur le nombre de
ternaires (onze annonces, dix-neuf reels) et sur la liste des erreurs sans
reprise (bon compte, mauvais fichiers). Dans les deux cas, c'est en
implementant que l'ecart est apparu. C'est la troisieme fois de suite
(phase 8 : `COMPLETED` qui n'existe pas ; audit ECC : `enabledIndexes` a une
ligne et non 142). Un audit fait au `grep` donne une direction, pas un
compte ; le compte vient du travail.
