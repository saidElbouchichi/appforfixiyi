# PHASE 15 (REFONTE) — TESTS VISUELS — PLAN

Date : 2026-09-28. Enchainee sans GO intermediaire (Decision 81), avec **un
arret** : ou comparer les references est un choix d'infrastructure, pose a
l'utilisateur (Decision 87).

Sources lues : `PLAN.md` (ligne 26 : « `toHaveScreenshot()`, baselines,
CI »), Decision 81, `09_DESIGN_SYSTEM_RULE.md` §7 et §8,
`.github/workflows/ci.yml`, `tests/browser/playwright.config.ts`, les 11
specs.

> **Ordre reel, dit tel quel** : la mesure (§2) a ete faite avant ce plan,
> parce qu'elle decidait de sa forme : quelles captures sont stables, et
> pourquoi les autres ne le sont pas.

## 1. Consigne

Comparer les ecrans a des references (`toHaveScreenshot`), et que la CI le
fasse.

## 2. Mesure (faite avant ce plan)

1. **La CI ne lance aucun test navigateur** : son seul job est
   install -> lint -> typecheck -> test -> build.
2. **Le rendu depend de l'OS** : une reference Windows ne se compare pas a un
   rendu Linux (polices). Decision de l'utilisateur : un seul jeu Linux,
   compare en local et en CI (Decision 87).
3. **La suite complete passe sous Linux telle quelle** (image Playwright
   officielle 1.63.0, reseau de l'hote) : 58/58, avant tout changement.
4. **Stabilite, sans rien masquer** : 34 captures (28 existantes, 6
   nouvelles), deux passes. **24 identiques au pixel** (les 13 galeries, la
   navigation, les ecrans publics, la connexion) ; 3 differentes, et 7 non
   atteintes (un test s'arrete a sa premiere difference). Les 3 ne different
   que par des donnees generees : code OTP, identifiant, nom, heure.
5. **Un vrai defaut vu sur une capture** : l'ecran « Demande envoyee »
   affiche les enums bruts `REQUESTED` et `NORMAL`, alors que la table de
   libelles existe depuis la phase 8.

## 3. Taches, dans l'ordre

1. `support/visual.ts` : `capture()` remplace les 28 `page.screenshot`
   nommes ; dans l'image Linux (`VISUAL=1`), il compare aussi.
2. Trois ecrans publics sans capture (accueil, recherche, connexion) a 360 et
   1440 px : 6 references de plus.
3. Masques des donnees generees, et largeur fixee (`support/visual.css`,
   comparaisons seulement) quand la largeur d'un masque deplacerait la suite.
4. Libelles sur « Demande envoyee » ; les 9 assertions `REQUESTED` attendent
   `Envoyee`.
5. `tests/browser/Dockerfile`, `pnpm test:visual`, job CI `browser`.
6. Instrument verifie : un defaut connu (1 px de padding sur les badges) doit
   faire echouer la comparaison.
7. Decision 87, `09_DESIGN_SYSTEM_RULE.md` §8, `README.md`, `PROGRESS.md`.

## 4. Criteres de fin

- 34 references, stables sur des passes enchainees ;
- le defaut injecte est vu ;
- suite complete verte sous Windows (sans comparaison) et sous Linux (avec) ;
- gates sans cache ; CI verte, **job `browser` compris**.

## 5. Risques

- **Tolerance** : aucun pixel different admis (defaut de Playwright), avec
  son seuil de couleur par pixel par defaut (0,2). Une tolerance en nombre de
  pixels cacherait un defaut d'1 px ; ce qui varie est masque, pas tolere.
- **Masquer trop** : un masque cache aussi ce qu'il couvre. Il est pose sur
  la donnee, pas sur son conteneur (l'accuse de lecture reste compare).
- **CI plus longue** : un job de plus, en parallele du premier.
