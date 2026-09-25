# PHASE 10 (REFONTE) — RESPONSIVE — PLAN

Date : 2026-09-25. Statut : **plan soumis, implementation en attente du GO**.

Sources lues : `docs/PROGRESS.md`, `docs/DECISIONS.md` (62 a **79** — il y en
a 79, pas 81), `docs/design/PHASE_9_REPORT.md`, `docs/design/PLAN.md`
(ligne 21 : « Responsive | 360 a 1440+ — consolidation »),
`docs/design/AUDIT.md` (qui ne dit **rien** du responsive : le perimetre
vient de cette seule ligne).

Note sur la Decision de l'utilisateur : les tests de **visualisation**
(comparaison d'images) sont reportes apres la phase 14. Ce plan n'en propose
aucun. Ce qu'il propose est une mesure **numerique**, qui est autre chose.

## 1. Methode de l'audit — et pourquoi elle change

La phase 9 s'est terminee sur un constat : mes audits au `grep` donnent une
direction, pas un compte. Trois phases de suite, le chiffre annonce etait
faux. Pour le responsive, le `grep` ne peut de toute facon rien dire : une
mise en page ne deborde pas dans le source, elle deborde dans un navigateur.

**Instrument** : Chromium reel, contre la stack Docker qui tourne.
**Couverture** : 11 routes x 4 largeurs (360, 768, 1024, 1440) = **44
mesures**, plus une seconde passe avec du contenu long.
**Criteres**, tous objectifs, aucun a l'oeil :

1. la page defile lateralement (`documentElement.scrollWidth > innerWidth`) ;
2. un element depasse le bord droit (`getBoundingClientRect().right`) ;
3. une cible tactile fait moins de 24 px (WCAG 2.5.8 ; ce depot vise 44) ;
4. un texte est coupe par sa propre boite (`scrollWidth > clientWidth`).

Les routes authentifiees recoivent une vraie session injectee (client,
artisan, administrateur), et une demande reelle est creee pour l'ecran de
recherche.

### 1.1 L'instrument a ete verifie avant d'etre cru

C'est la partie qui manquait aux audits precedents. Avant d'exploiter le
resultat, trois controles :

| Controle | Resultat |
|---|---|
| Les routes authentifiees ont-elles **vraiment** affiche leur contenu, ou redirige vers `/login` ? | Verifie par le `h1` : « Mes demandes », « Messages », « Profil », « Nouvelle demande ». Les sessions ont fonctionne. |
| Les « textes coupes » en sont-ils ? | **Non.** Ce sont des `.fx-visually-hidden` : `position:absolute`, `1x1px`, `clip-path: inset(50%)` — le motif standard reserve aux lecteurs d'ecran. **Faux positif de mon detecteur.** |
| Les radios de 13x13 px sont-elles vraiment sous la cible ? | **Non.** Chacune est dans un `<label>` de **103x44 px**, et WCAG mesure la cible cliquable. **Faux positif.** |

**24 constats bruts -> 2 defauts reels.** Les 22 autres venaient de mon
instrument, pas du code.

## 2. Ce que la mesure dit

### Ce qui va bien, et c'est l'essentiel

**Zero debordement de page et zero element hors cadre**, sur les 44 mesures.
Idem avec du contenu long. La grille, la coque, la barre basse et les cartes
tiennent de 360 a 1440 px. La phase 10 n'a donc **rien a rattraper** : les
phases 3 et 5 ont pose des fondations qui tiennent.

### Defaut 1 — un mot insecable est coupe, en silence

Mesure a 360, 768 et 1440 px sur `/requests`, avec une description contenant
un token de 78 caracteres sans espace :

```
COUPE  p  scrollWidth=797  clientWidth=270  overflow-wrap: normal
       "ReparationXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX…"
```

`.fx-card` porte `overflow: hidden` (card.css, phase 4). Le mot ne pousse
donc **pas** la page : il est **tranche net au bord de la carte** et devient
illisible. Aucun des deux criteres de debordement ne le voit — c'est
exactement pour cela que la capture compte autant que le nombre
(`evidence/phase10/mes-demandes-long-360.png`).

Le texte concerne est **saisi par l'utilisateur** : description d'une demande,
message de chat, nom d'affichage. Un numero de serie, une URL collee, un mot
allemand suffisent.

### Defaut 2 — le champ de fichiers fait 20 px de haut

`input[type=file]` natif, mesure a **270x20 px** aux quatre largeurs. Sous le
minimum de 24 px (WCAG 2.5.8) et loin des 44 px que `styles.css` se fixe.
C'est le seul controle de tout le depot dans ce cas — tous les autres passent.

### Observation, hors responsive

Une description de 1900 caracteres est rendue **en entier** dans la carte de
`/requests` : une seule demande fait plusieurs ecrans de haut. Ce n'est pas un
defaut de mise en page (rien ne deborde), c'est une question de conception de
liste. Je la signale, je ne la traite pas dans cette phase — elle appartient
au registre de la phase 8.

## 3. Ce que la phase fait

1. **Le texte saisi ne se coupe plus.** Une regle sur le texte d'origine
   utilisateur (`overflow-wrap: anywhere`), posee dans le design system, pas
   dans chaque ecran. Le choix se justifie : `anywhere` casse le mot au
   caractere plutot que de le masquer, ce qui est le comportement voulu pour
   du contenu qu'on ne controle pas.
2. **Le champ de fichiers devient une vraie cible** : un declencheur au
   standard du depot (44 px) et l'`input` natif reduit a sa fonction. Aucun
   changement de comportement : meme `accept`, meme `multiple`, meme
   `data-testid`.
3. **Un test de non-regression**, en Playwright, qui refait la mesure des
   criteres 1, 2 et 4 sur un echantillon de routes a 360 et 1440 px, **avec du
   contenu long**. Ce n'est pas un test de visualisation : il ne compare
   aucune image, il lit des nombres dans le DOM.

## 4. Ce que la phase ne fait pas

- **Aucune refonte de la grille ou des breakpoints** : la mesure dit qu'ils
  tiennent. Y toucher serait du travail sans defaut a corriger.
- **Aucun test de comparaison d'images** (reporte apres la phase 14).
- **Aucun ecrêtage de description** : signale au §2, hors perimetre.
- Rien d'invente : un ecran vide reste vide.

## 5. Tests

- Le test de mesure ci-dessus, qui **echoue si on le casse** — verifie en le
  cassant, comme `states.test.ts` en phase 9.
- Les 49 scenarios existants passent sans modification.
- Contrastes inchanges (aucune couleur nouvelle).
- Planchers de couverture tenus.

## 6. Risques

- **`overflow-wrap: anywhere` applique trop largement** casserait la mise en
  page d'elements courts (badges, boutons). La regle visera le **texte
  d'origine utilisateur**, pas tout le document.
- **Remplacer un `input[type=file]`** est le genre de retouche qui casse un
  televersement. Le pipeline media est teste de bout en bout (Playwright,
  MinIO reel) : c'est le filet, et il ne sera pas modifie.
- **Le test de mesure peut devenir bruyant** s'il ratisse trop large. Il
  portera sur les trois criteres objectifs, avec l'exclusion
  `.fx-visually-hidden` que cet audit a rendue necessaire.

## 7. Correction a porter au rapport

L'enonce de la tache parlait des « Decisions 62-81 ». Le journal en compte
**79**. Aucune n'est manquante ; il n'y en a simplement pas 80 ni 81.
