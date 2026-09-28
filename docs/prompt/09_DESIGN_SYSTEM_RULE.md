# 09 — REGLE DU DESIGN SYSTEM

Ce que tout ecran de Fixiyi respecte, ecrit a la fin de la refonte Design
System V2 (phases 1 a 15, `docs/design/`). Chaque regle renvoie au test qui
la tient : **une regle sans test est une intention**, et la refonte en a
trouve plusieurs qui ne tenaient plus.

Hierarchie inchangee (`08_ECC_INTEGRATION.md`) : les regles Fixiyi priment
sur toute competence externe. Aucune competence de generation d'interface
ne remplace ce fichier.

## 1. Rien d'invente (D2, D4, Decision 70)

- Un ecran n'affiche que ce qu'une source fournit. Pas de note, d'avis, de
  prix, de photo ou de compteur sans donnee derriere : l'emplacement reste
  **vide**, il n'est pas rempli d'exemples.
- Pas de logo ni d'illustration inventes (placeholder texte, D4).
- Pas d'ecran sans backend, pas de bouton decoratif, pas de route morte (D2,
  `03_AGENT_PROTOCOL.md` §2).
- Test : `tests/browser/tests/services.spec.ts` (le profil public ne contient
  ni telephone ni coordonnee exacte).

## 2. Jetons, jamais de valeur en dur

- Couleurs **par role** (D1), typographie (D6, D7 : Inter, Noto Sans Arabic),
  espacement sur la grille de 4 px, rayons, ombres, durees et courbes : tout
  vient de `@fixiyi/design-tokens`.
- Tests : `packages/design-tokens/src/tokens.test.ts` (synchronisation
  `tokens.ts` / `tokens.css`, contrastes), `packages/ui/src/styles.test.ts`,
  `packages/ui/src/animations.test.ts`.

## 3. Composants de `@fixiyi/ui`

- Un besoin d'interface commence par `packages/ui` (composants et 63
  icones). Un composant nouveau y entre avec ses tests : accessibilite, RTL,
  jetons.
- Les etats passent par `Skeleton`, `ErrorState` (avec reprise) et
  `EmptyState` ; ils parlent la langue du lecteur, jamais celle du moteur
  (`matching`, `dispatch`, `batch`… : `apps/web/src/lib/states.test.ts`).

## 4. Accessibilite — WCAG 2.2 AA

- Un `h1` par ecran, aucun saut de niveau de titre (`EmptyState` sous un
  `h1` : `headingLevel={2}`).
- **Un titre par route** (`pageTitle` + `layout.tsx` de segment), lu par
  l'annonceur de Next : c'est la **seule** voix apres une navigation, pas de
  focus programme (Decision 80).
- Contraste mesure par test, jamais estime ; cible de 24 px minimum (44 visee).
- Tests : `accessibility.spec.ts` (axe WCAG 2.2 AA, 320 et 1440 px, titres,
  annonceur), `design-system.spec.tsx`.

## 5. Mise en page — 320 a 1440+

- Aucun defilement horizontal. Le texte saisi par quelqu'un porte
  `.fx-user-text` (un mot de 78 caracteres ne se coupe pas au bord d'une
  carte).
- Proprietes **logiques** (`inline-start`, pas `left`) : l'arabe inverse
  l'axe, les glyphes directionnels se retournent.
- Tests : `responsive.spec.ts`, `navigation.spec.ts` (RTL).

## 6. Mouvement — une entree = une arrivee (Decision 82)

- Une animation dit quelque chose : un contenu qui **arrive**, un etat qui
  change, une attente. Aucune animation decorative.
- Une entree ne rejoue pas sur ce qui etait deja la : historique du chat,
  liste revisitee en cache (`lib/arrivals.ts`, `lib/use-entrance.ts`).
- `prefers-reduced-motion` neutralise tout ; seules les attentes bouclent ;
  aucun mouvement automatique au-dela de 5 s (WCAG 2.2.2).
- Test : `motion.spec.ts` (lit `document.getAnimations()`).

## 7. Mesurer dans le navigateur, et verifier l'instrument

La regle de methode de la refonte, apprise a ses depens :

- une mise en page, un contraste, une animation se mesurent **dans un vrai
  navigateur**, pas au `grep` ;
- un instrument qui rapporte zero doit d'abord prouver qu'il voit un defaut
  connu (faute injectee, mutant connu, animation temoin) ;
- un test se voit **rouge** avant d'etre cru vert, puis on le **casse
  expres** (`pnpm test:mutation` pour la logique du client).

## 8. Captures de reference (Decision 87)

- 34 ecrans ont une reference Linux dans `tests/browser/visual/`, comparee
  par `pnpm test:visual` (image `tests/browser/Dockerfile`) et par le job CI
  `browser`. Hors de cette image, rien n'est compare : le rendu des polices
  depend de l'OS.
- Une capture nommee passe par `capture()` (`tests/browser/support/visual.ts`),
  jamais par `page.screenshot` directement.
- Une donnee generee (code, identifiant, nom, heure, liste qui depend de la
  base) est **masquee**, pas toleree ; si sa largeur deplace la suite, elle
  est fixee dans `support/visual.css`, qui ne s'applique qu'aux comparaisons.
- Les references supposent le **catalogue du seed seul** : elles se
  generent sur une pile neuve (procedure en tete de `scripts/visual/run.mjs`),
  comme en CI. Une base de dev enrichie a la main differe sur l'accueil.
- Une difference est soit une regression, soit une evolution voulue — et
  alors la reference est regeneree (`pnpm test:visual
  --update-snapshots=changed`) **dans le meme commit**, avec sa raison.
