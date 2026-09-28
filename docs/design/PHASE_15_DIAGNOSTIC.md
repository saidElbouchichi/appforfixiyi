# PHASE 15 (REFONTE) — TESTS VISUELS — DIAGNOSTIC

Date : 2026-09-28. Plan : `PHASE_15_PLAN.md`. Preuves :
`docs/design/evidence/phase15/`.

## 1. Audit mesure

| Instrument | Mesure | Critere |
|---|---|---|
| Suite complete dans l'image Linux, avant tout changement | 58 scenarios | 58/58 |
| `toHaveScreenshot` sur les 34 captures, deux passes, sans masque | 24 identiques, 3 differentes, 7 non atteintes | chaque difference expliquee |
| Defaut injecte : 1 px de padding sur `.fx-badge` | galerie des badges | vue par la comparaison |
| `session-refresh` repete sous Linux | 5 passes, puis 10 apres correctif | 0 echec |

## 2. Defauts reels

### 2.1 « Demande envoyee » parlait la langue du moteur

- **Mesure** : la capture `10-request-submitted` affiche `REQUESTED` et
  `NORMAL`. La table `REQUEST_STATUS_LABEL` / `URGENCY_LABEL` existe depuis la
  phase 8 ; cet ecran n'y etait pas branche. Le test du vocabulaire moteur
  (phase 9) cherche des mots (`matching`, `dispatch`…), pas des valeurs
  d'enum rendues telles quelles.
- **Correction** : libelles (`Envoyee`, `Normal`) ; une urgence absente
  n'affiche plus de ligne vide (regle 1, rien d'invente). Les 9 assertions
  qui attendaient `REQUESTED` attendent `Envoyee` : l'ancien code les fait
  echouer.

### 2.2 Un 401 tardif declenchait un second rafraichissement

- **Mesure** : sous Linux, `session-refresh` a echoue 1 fois sur 5 :
  `[201, 201]` au lieu de `[201]`. Deux rafraichissements **successifs**, pas
  simultanes (sinon la detection de rejeu aurait revoque la session).
- **Cause** : `apiFetch` ne retenait pas le jeton avec lequel la requete
  etait partie. Un appel lent, envoye avec l'ancien jeton, recevait son 401
  **apres** la fin du rafraichissement partage, quand le vol unique etait deja
  libere, et en lancait un second. Meme code dans `web` et `admin`.
- **Impact** : une rotation de trop a chaque expiration sur un ecran a
  plusieurs appels ; et une fenetre de plus ou deux rafraichissements
  pourraient se croiser. C'est la frontiere de B1 (Decision 51).
- **Correction** : si le jeton courant n'est plus celui de l'envoi, l'appel
  est rejoue sans rafraichir. Test unitaire vu **rouge** (2 rafraichissements)
  puis vert, dans les deux apps ; deux mutants ajoutes au harnais, tues ;
  `session-refresh` 10/10 sous Linux apres correctif.
- Pourquoi Linux l'a vu et pas Windows : l'ordre d'arrivee des reponses
  depend du temps ; l'image Linux ne fait que changer ce temps. Le defaut
  est dans le client, pas dans l'environnement.

## 3. Faux defauts

- **3 captures « differentes »** a la premiere mesure : uniquement des
  donnees generees (code OTP, identifiant, nom de l'artisan, heure). Masquees.
- **Un masque qui bouge** : la largeur d'un nom genere deplacait le badge qui
  le suit, et le masque changeait de taille. Largeur fixee par
  `support/visual.css`, applique aux seules comparaisons.
- **Un masque trop large** : masquer la ligne meta d'un message cachait aussi
  l'accuse de lecture. Seule l'heure est masquee ; l'accuse reste compare.
- **Premiere CI : 57/58**, l'accueil a 360 px different (780 px de haut
  contre 907). La faute etait **dans ma reference** : ma base de dev contient
  un domaine « Test Manuel » cree a la main ; la CI, sur base neuve, montre
  le catalogue du seed. Les references ont ete regenerees sur une pile neuve
  (projet Compose separe, volumes de dev intacts : 26 noeuds, 965 demandes
  avant et apres) : seules les 2 de l'accueil changent ; controle 58/58.
- **Deuxieme CI : 57/58**, `22-chat-reply` : la pastille « 1 » non lu sur
  « Messages », capturee dans l'instant ou la reponse arrive, avant que le
  fil ouvert ne l'acquitte. Etat transitoire, pas un defaut : les captures
  20 et 22 attendent l'ecran stabilise (`nothingUnread`) ; 5/5 repetes.
- **`@fixiyi/ui` : « Timeout waiting for worker to respond »** pendant des
  gates lancees en parallele de Docker : aucun test en echec, 235/235 seul.
  Contention de la machine (voir §5).

## 4. Corrections appliquees / retirees / reportees

- Appliquees : §2.1, §2.2 ; `capture()` pour les 28 captures nommees et 6
  nouvelles (ecrans publics, 360 et 1440 px) ; `tests/browser/Dockerfile`,
  `pnpm test:visual`, job CI `browser` ; Decision 87 ;
  `09_DESIGN_SYSTEM_RULE.md` §8 ; `README.md`.
- Instrument verifie : le padding de `.fx-badge` augmente d'1 px (copie
  montee dans l'image) fait echouer « batch B gallery », et elle seule.

## 5. Reste ouvert

- **Premiere passe complete** : 1 echec sous Linux (`session-refresh`, cause
  trouvee, §2.2) et 1 sous Windows (`motion`, « only a wait may move for
  long »), dont le message a ete ecrase par la passe suivante. `motion` :
  15/15 en repetition, puis suites completes vertes. **Non reproduit, non
  explique** ; si le job CI le revoit, les traces seront dans l'artefact
  `browser-test-results`.
- Timeouts de workers Vitest de `@fixiyi/ui` sous forte charge locale.
- 3 references (`11`, `12`, `13`) masquent leur liste : son contenu depend de
  tous les artisans disponibles en base, pas du test. La mise en page de la
  liste y est donc comparee sans son contenu.

## 6. Verification ECC

- Tests d'abord : deux tests unitaires vus rouges avant le correctif ; mutants
  ajoutes et tues.
- Gates sans cache, couverture, build, mutation, suite complete sous Windows
  et sous Linux : `PHASE_15_REPORT.md` §3.
- Securite : le correctif ne rejoue qu'avec un jeton que le store tient deja
  (jamais un jeton lu ailleurs) ; aucun secret dans le job CI, les secrets de
  signature y sont generes a chaque passe.
