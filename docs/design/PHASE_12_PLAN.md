# PHASE 12 (REFONTE) — ANIMATIONS — PLAN

Date : 2026-09-27. Enchainee sans GO intermediaire (Decision 81).

Sources lues : `docs/PROGRESS.md`, `docs/DECISIONS.md` (80, 81),
`docs/design/PHASE_11_REPORT.md` et `PHASE_11_DIAGNOSTIC.md`,
`docs/design/PLAN.md` (ligne 23 : « Animations | micro-interactions »),
`docs/design/AUDIT.md` (§ `prefers-reduced-motion`),
`packages/ui/src/styles/animations.css`, `base.css` (regle globale de
mouvement reduit), les 13 feuilles de composants.

## 1. Point de depart

Le mouvement n'est pas a construire : il existe depuis le Design System
unifie (Decision 49) et la phase 4. Onze `@keyframes`, sept utilitaires
`.fx-animate-*`, des transitions dans douze feuilles, **deux** regles
`prefers-reduced-motion` (une pour les utilitaires, une globale sur toute
classe `fx-`), et `animations.test.ts` qui verifie les jetons **dans le
source**.

Ce que personne n'a encore fait : **mesurer le mouvement tel qu'il tourne
dans le navigateur**. Un test sur le source ne voit ni une animation posee par
un element sans classe `fx-` (les enfants de `.fx-animate-stagger`), ni une
duree calculee, ni ce qui tourne encore apres le chargement.

Ce que la phase n'est pas : un ajout d'animations. La consigne est explicite —
une animation n'est gardee ou ajoutee que si elle **aide a comprendre** (un
etat qui change, un contenu qui arrive, une attente) ; une animation
decorative est retiree.

## 2. Methode de mesure

Chromium reel contre la stack Docker, sessions reelles (harnais
`tests/browser/audit/`, sortie `docs/design/evidence/phase12/`).
`document.getAnimations()` rend **toutes** les animations et transitions CSS
en cours, avec leur cible, leur nom, leur duree, leur nombre d'iterations et
leurs proprietes animees (`getKeyframes()`).

Mesures prises :

- sur les 11 routes de `apps/web` + une conversation avec messages, **au
  chargement** et **apres une interaction** (survol d'un bouton, envoi d'un
  message) ;
- sur le banc de composants (`support/ui-harness`) : modale, menu, feuille
  basse, palette de commandes, toast, squelette, spinner, progression
  indeterminee, pastille urgente, bouton pulse ;
- chaque mesure **deux fois** : mouvement normal, puis
  `reducedMotion: "reduce"` emule.

### 2.1 L'instrument mord-il ?

Avant de croire un zero : injecter une animation infinie de 2 s sur un
element **sans classe `fx-`** et verifier que la sonde la rapporte, en
mouvement normal **et** reduit (elle ne doit pas etre neutralisee : elle
echappe aux deux regles). Si la sonde ne la voit pas, l'instrument est
faux.

## 3. Criteres objectifs

| # | Critere | Seuil |
|---|---|---|
| M1 | Mouvement reduit (WCAG 2.3.3, et preference systeme) | sous `reduce`, aucune animation active de plus de 1 ms, aucune iteration infinie |
| M2 | Jetons | toute duree mesuree est un jeton (150 / 200 / 300 / 500 ms) ou un multiple documente dans le source ; toute courbe est un jeton |
| M3 | WCAG 2.2.2 (niveau A) | aucun mouvement automatique de plus de 5 s, sauf un indicateur de chargement |
| M4 | Utilite | chaque animation mesuree est classee : etat, arrivee de contenu, attente, retour d'action — ou **decorative**, et alors retiree |
| M5 | Cout | proprietes animees : `transform` / `opacity` ; toute autre est listee et justifiee |

## 4. Ordre des taches

1. Ecrire la sonde, **la verifier** (§2.1), mesurer — avant toute correction.
2. Classer chaque constat : defaut reel ou faux positif de l'instrument.
3. Corriger les defauts reels, **un a la fois**, en remesurant apres chacun.
4. Test de non-regression dans `tests/browser/tests/` : M1 et M3 relus dans
   le navigateur (pas au grep), vu rouge sur le defaut, puis vert, puis
   casse expres.
5. Gates sans cache, couverture, images reconstruites, suite Playwright
   complete, captures, diagnostic, rapport, documentation, commit, CI.

## 5. Risques

- **Neutraliser une animation qui porte un sens** : les points de frappe du
  chat disent « ecrit » — le texte le dit aussi, c'est pourquoi la regle
  globale les arrete sans les cacher. Toute neutralisation garde l'etat
  final visible (`both`, jamais `opacity: 0`).
- **Instabilite des tests** : une mesure prise pendant une animation lit
  un etat intermediaire (phase 11 : un faux 3,98:1). Le test attend la fin
  des animations finies.
- **Ajouter du mouvement pour remplir la phase** : refuse par principe (§1).

## 6. Regle de fin de phase

Celle de `PLAN.md`, plus : M1 a M5 tenus sur toutes les mesures,
`PHASE_12_DIAGNOSTIC.md` et `PHASE_12_REPORT.md` ecrits, CI verte.
