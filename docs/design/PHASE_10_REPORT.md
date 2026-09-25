# PHASE 10 (REFONTE) — RESPONSIVE — RAPPORT

Date : 2026-09-25. Statut : **TERMINEE**. Plan :
`docs/design/PHASE_10_PLAN.md`.

## 1. La methode, et ce qu'elle a coute

La phase 9 s'etait terminee sur un constat : trois audits de suite avaient
annonce un chiffre faux. Pour le responsive, le `grep` ne pouvait de toute
facon rien dire — une mise en page ne deborde pas dans le source.

**Instrument** : Chromium reel contre la stack Docker. **11 routes x 4
largeurs (360, 768, 1024, 1440) = 44 mesures**, quatre criteres objectifs
(debordement de page, element hors cadre, cible sous 24 px, texte coupe par
sa boite). Sessions reelles injectees, demande reelle creee.

**Et cette fois, l'instrument a ete verifie avant d'etre cru.** C'est ce qui
manquait aux trois audits precedents :

| Controle | Resultat |
|---|---|
| Les routes authentifiees ont-elles affiche leur contenu ? | Oui — `h1` lus : « Mes demandes », « Messages », « Profil », « Nouvelle demande ». |
| Les « textes coupes » en sont-ils ? | **Non** : `.fx-visually-hidden`, 1x1 px, `clip-path: inset(50%)` — le motif lecteur d'ecran. 9 faux positifs. |
| Les radios de 13 px sont-elles sous la cible ? | **Non** : chacune est dans un `<label>` de 103x44 px, et WCAG mesure la cible cliquable. 8 faux positifs. |

**24 constats bruts -> 2 defauts reels.** Les 22 autres venaient de mon
instrument. La verification a coute trois mesures supplementaires ; elle a
evite de « corriger » 22 choses qui n'avaient rien.

## 2. Le resultat principal : il n'y avait rien a rattraper

**Zero debordement de page, zero element hors cadre**, sur les 44 mesures, et
encore zero avec du contenu long. La grille, la coque, la barre basse et les
cartes tiennent de 360 a 1440 px sans une retouche.

Conclusion : **les breakpoints et la grille n'ont pas ete touches**. La mesure
dit qu'ils tiennent ; y toucher aurait ete du travail sans defaut a corriger.

## 3. Les deux defauts, corriges

### 3.1 Un mot insecable etait coupe, en silence

Mesure a 360, 768 et 1440 px, avec une description contenant un token de 78
caracteres sans espace :

```
COUPE  p  scrollWidth=797  clientWidth=270  overflow-wrap: normal
```

`.fx-card` porte `overflow: hidden`. Le mot ne poussait donc pas la page : il
etait **tranche au bord de la carte**, illisible, et aucun critere de
debordement ne le voyait. Les captures le montrent
(`evidence/phase10/AVANT-mot-insecable-360.png` et `APRES-…`) : avant, le mot
s'arrete net ; apres, il se replie sur trois lignes.

**Le depot avait deja la reponse.** `.fx-bubble__text` porte
`overflow-wrap: anywhere` depuis la phase 4 : les messages de chat etaient
proteges, rien d'autre ne l'etait. La regle 3bis du protocole — chercher dans
le depot avant d'ecrire — a servi exactement a cela.

Ajout de `.fx-user-text` dans `base.css`, applique aux **sept** endroits ou du
texte saisi par quelqu'un s'affiche : description d'une demande (x3), bio,
nom d'artisan (x2), nom d'interlocuteur. Pas au document entier : un badge ou
un bouton n'a rien a gagner a casser ses mots.

### 3.2 Le champ de fichiers faisait 20 px de haut

`input[type=file]` natif, mesure a 270x20 px aux quatre largeurs — le seul
controle du depot sous les 24 px de WCAG 2.5.8, loin des 44 px que
`styles.css` se fixe. La partie cliquable d'un champ natif est le bouton du
navigateur, qu'aucune feuille de style ne redimensionne.

L'input n'est **pas cache** : il est pose sur toute la zone en `opacity: 0`.
La cible devient le label stylise de 44 px, et l'element garde une vraie boite
— ce qui laisse le test de televersement continuer a s'en servir. Meme
`accept`, meme `multiple`, meme `data-testid`.

## 4. Le test de non-regression

`tests/browser/tests/responsive.spec.ts`, trois scenarios. **Ce n'est pas un
test de visualisation** : il ne compare aucune image (celles-la viennent apres
la phase 14). Il relit dans le DOM les memes criteres que l'audit.

Il porte les deux corrections de l'instrument : il ignore
`.fx-visually-hidden`, et il mesure la cible d'un controle **au niveau du
label** quand il y en a un — sans quoi il aurait reproduit les 17 faux
positifs de la premiere passe.

Une erreur au passage, notee parce qu'elle illustre le point : le test du
champ de fichiers mesurait d'abord l'`input` (42 px) et non le label (44 px).
Les deux pixels sont les bordures. Mesurer l'input, c'etait mesurer autre
chose que la cible.

## 5. Tests et gates

| Suite | Avant | Apres |
|---|---|---|
| Playwright | 49 | **52** |

`pnpm lint` 15/15 **sans warning**, `typecheck` 15/15, `test` 14/14,
`build` 10/10. Image `web` reconstruite. Le scenario de televersement reel
(MinIO) passe sans modification, ce qui etait le risque principal du §6 du
plan.

## 6. Signale, pas traite

Une description de 1900 caracteres est rendue en entier dans la carte de
`/requests` : une demande fait plusieurs ecrans de haut. Rien ne deborde —
c'est une question de conception de liste, du registre de la phase 8, pas du
responsive. **Decide avec l'utilisateur : a noter, pas a traiter ici.**

## 7. Correction au journal

L'enonce parlait des « Decisions 62-81 ». Le journal en compte **79**. Aucune
ne manque ; il n'y a simplement pas de 80 ni 81.
