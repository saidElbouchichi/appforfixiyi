# PHASE 8 (REFONTE) — PAGES SECONDAIRES — RAPPORT

Date : 2026-09-25. Statut : **TERMINEE**. Plan suivi :
`docs/design/PHASE_8_PLAN.md`. Trois decisions tranchees par l'utilisateur
avant l'implementation : retirer le score, remplacer les vagues, garder
l'admin en anglais.

## 1. Ce que la phase a change, en une image

`docs/design/evidence/phase8/client-match-1440.png`, l'ecran d'attente du
client.

**Avant** :

```
Statut : ACTIVE
Rayon de recherche : 10 km
Vagues envoyees : 2
Fournisseurs contactes : 3
Playwright Pro 4763  NOTIFIED  vague 1 · 0.0 km · score 0.78
```

**Apres** :

```
Ou en est votre demande
[Recherche en cours]
3 artisans contactes, jusqu'a 10 km
Service demande : Panne electrique
Playwright Pro 4763  [Prevenu]  a 0.0 km
```

Le second dit la meme chose au meme moment. Il ne contient plus `ACTIVE`,
`NOTIFIED`, `score`, ni « vague » — et il ajoute le **nom du service**, que
le client avait choisi et que l'ecran ne lui rappelait pas.

## 2. Livre

| Ecran | Ce qui a change |
|---|---|
| `requests/[id]/match` | statuts traduits, score et vagues retires, nom du service ajoute, progression en une phrase |
| `provider/requests` | statuts traduits, **nom du service** ajoute, **temps restant** affiche, zone reformulee, « media(s) joint(s) » accorde |
| `conversations` | la mention « lecture seule » dit desormais **pourquoi** |
| `apps/admin/catalog` | arbre hierarchique lisible au lieu d'une liste plate poussee par une marge |

### 2.1 Une table de libelles, pas trois

`/requests`, `/match` et `provider/requests` portaient chacun leur table
pour les **memes** enums. `apps/web/src/lib/labels.ts` les remplace : un
`Record<Enum, string>` par enum, donc **ajouter une valeur au contrat casse
la compilation** tant que son libelle manque. Les tests couvrent ce que le
type ne peut pas : aucun libelle vide, aucun libelle egal a la valeur brute.

### 2.2 Ce que la traduction a revele

Le plan proposait de traduire `COMPLETED` par « Un artisan a repondu ».
**`COMPLETED` n'existe pas.** `MatchStatus` vaut `ACTIVE | EXHAUSTED |
CANCELLED`, et le contrat explique pourquoi : repondre a un dispatch, c'est
faire une **offre**, qui n'existe pas avant la Phase 7 **produit**.

`EXHAUSTED` ne veut donc pas dire « personne n'a voulu » ni « recherche
reussie » : le moteur n'a plus de candidat a contacter. Le libelle retenu est
« Plus d'artisan a contacter », et un test verifie qu'aucun libelle de cet
enum ne promet un resultat que le moteur ne sait pas rapporter.

C'est exactement le risque que le plan nommait en §8 : « traduire n'est pas
decider ». Il s'est materialise des la premiere table.

### 2.3 `expiresAt` etait dans le contrat et nulle part a l'ecran

La boite de l'artisan affichait l'urgence, la distance, le prix du
deplacement — et pas le **delai pour repondre**, qui est la seule chose qui
presse. Il s'affiche maintenant, et **se rafraichit chaque minute** : un
decompte fige au chargement annonce « reste 3 h » une heure plus tard.

## 3. Ce qui n'a pas ete ajoute

Aucune note, aucun avis, aucun compteur d'interventions, aucun prix
« a partir de », aucun delai estime de reponse, aucun « 3 artisans regardent
votre demande ». La regle du §3 du plan n'a pas bouge : un ecran qui parait
vide apres traduction l'est parce que la donnee n'existe pas.

Le seul endroit ou cela se voit encore est la zone approximative, toujours
en coordonnees (« Aux alentours de 33.57, -7.59 ») faute de geocodeur
inverse — meme limite qu'au profil artisan de la phase 7. La formulation est
au moins devenue une phrase.

## 4. Tests

| Suite | Avant | Apres |
|---|---|---|
| `apps/web` | 33 | **51** |
| Playwright | 48 | **49** |

Le scenario ajoute est la these de la phase, posee comme assertion : apres
avoir lance une recherche, la page du client **ne contient ni `ACTIVE`, ni
`NOTIFIED`, ni `EXHAUSTED`, ni `score`, ni « vague »**, et elle contient le
nom du service.

Couverture `apps/web` : 16,61 % -> **18,98 %** (la table de libelles est
entierement testee). Tous les planchers tiennent (Decision 74).

## 5. Tests existants mis a jour

Deux assertions citaient l'ancienne formulation et ont ete reecrites — le
changement de libelle est voulu, ce sont les tests qui suivent :

- `matching.spec.ts` attendait `ACTIVE` sur le statut ;
- il attendait aussi « Adresse exacte communiquee apres acceptation », que
  la nouvelle phrase remplace.

Aucun `data-testid` n'a ete modifie. Trois ont ete **ajoutes**
(`match-progress`, `match-service-name`, `match-time-left`,
`conversation-readonly-reason`).

## 6. Gates

`pnpm lint` 15/15 **sans warning**, `typecheck` 15/15, `test` 14/14,
`build` 10/10. Images `web` et `admin` reconstruites, Playwright 49/49
contre la stack Docker reelle.

Note, deuxieme fois apres la phase 7 : `docker compose build web admin` en
une commande echoue par contention ; les memes images construites
**sequentiellement** passent. Ce n'est pas un defaut des Dockerfile.

## 7. Reste ouvert

- **Zone en coordonnees** : un nom de ville demande un geocodeur inverse
  reel (`MAP_PROVIDER=dev`). Inchange depuis la phase 7.
- **L'admin reste un outil brut**, volontairement : le vrai back-office est
  la phase 12 produit (06_SCOPE). L'arbre est lisible, rien de plus n'a ete
  fait.
- Les niveaux du catalogue restent en anglais (`DOMAIN`, `CATEGORY`) —
  decide par l'utilisateur : c'est le vocabulaire du contrat et l'ecran
  s'adresse a un operateur.
