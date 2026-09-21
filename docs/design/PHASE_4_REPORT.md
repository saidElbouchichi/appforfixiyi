# REFONTE DESIGN — PHASE 4 : COMPOSANTS PRIMITIFS

## Statut : TERMINEE

## Date
2026-09-21

## Objectifs (master prompt 2B §18-22, 2C ; PLAN.md)
Ameliorer les 13 composants existants, creer les primitives manquantes de
la partie 2B, porter les icones a 55+ (2C). Header, Footer, Navbar et
BottomNavigation sont des composants de **layout** : phase 5 (PLAN.md).

## Commits de la phase
| Commit | Contenu |
|---|---|
| `351457c` | 4a — feuilles CSS par famille, icones, tokens de taille, Button, Badge, Card, Input/Textarea, Select, Skeleton, banc d'essai navigateur |
| `35e70e1` | 4b — Checkbox, Switch, Slider, Chip, SearchBar, FilterBar |
| `045b4fc` | 4c — Alert/Banner, Toast, ProgressBar/ProgressCircle, Stepper, Tooltip, Avatar, Rating/RatingInput |
| (ce commit) | 4d — BottomSheet, Menu, Tabs, Accordion, CommandPalette, `useDialog`, Modal, etats vide/erreur, rapport |

## Inventaire `@fixiyi/ui` : 13 -> 36 composants

**Ameliores (13)**
- **Button** : 6 variantes (primary, secondary, danger, ghost, **gradient**,
  **pulse**), 4 tailles 32/40/48/56 px (sm/md montent a 44 px sur ecran
  tactile), survol -1 px + `shadow-lg`, appui `scale(0.98)`, etat
  **success**, spinner de la couleur du libelle.
- **Card** : `interactive` (action principale etiree sur toute la carte,
  anneau de focus sur la carte), `highlight`, `gradientBorder`, badge de
  coin, en-tete media, pied de carte, `as="article"`.
- **Badge** : variantes `neutral` et `brand`, point de statut, pulsation
  limitee, icone.
- **Input** : icone de tete, `maxLength`, bordure coloree au focus.
  **Textarea** = alias de `Input multiline` (pas de doublon).
- **Select** : chevron du systeme, controle natif conserve.
- **Icon** : 26 -> **63 glyphes**, taille `2xl` (48), noms par sens de
  lecture + alias (`arrow-left`, `chevron-right`, `x`, `user`).
- **Modal** : tailles sm/md/lg, comportement extrait dans `useDialog`
  (+ verrouillage du defilement de la page).
- **Skeleton** : reflet diagonal (shimmer), dimensions en CSS.
- **EmptyState / ErrorState** : icone dans un disque de couleur.
- **IconButton** : `describedBy` (pour Tooltip).
- **Chat** : citation teintee de la couleur de la bulle (orange ou blanche).
- **Loading, RadioGroup** : inchanges hors tokens.

**Crees (23)** : Checkbox, Switch, Slider, Chip, SearchBar, FilterBar,
Alert (Banner = `layout="banner"`), Toast + `useToast`, ProgressBar,
ProgressCircle, Stepper, Tooltip, Avatar, Rating, RatingInput,
BottomSheet, Menu (Dropdown), Tabs, Accordion, CommandPalette +
`useCommandPaletteShortcut`, et le hook `useDialog`.

Chaque composant interactif suit le motif ARIA correspondant : bouton de
menu, onglets a activation automatique, accordeon, combobox + listbox,
switch, groupe radio. Il est teste au clavier : fleches, Home/End,
Escape, Tab, lettre d'acces, fleches inversees en RTL pour les onglets.

## Icones (partie 2C)
Les 55 icones demandees sont presentes, sauf les **5 icones sociales**.
S'y ajoutent **11 icones metiers** (bolt, droplet, snowflake, key,
paint-roller, hammer, washing-machine, smart-home, monitor, sparkles, leaf)
et `minus` / `more`. Total : **63 glyphes distincts** (le test verifie
qu'aucun dessin n'est duplique) et **7 alias**.

**Icones sociales reportees** : ce sont des logos de marques tierces. D4
interdit « des logos non fournis », et elles n'ont de sens qu'avec les
vraies URL des comptes Fixiyi. Elles arriveront en phase 5 (pied de page),
depuis les kits officiels des marques, avec les URL fournies.

## Decisions prises dans la phase
1. **Une feuille CSS par famille** : `styles.css` ne fait qu'importer.
   Il aurait depasse 2 500 lignes, au-dela du plafond de 800.
2. **Mouvement reduit global** : une regle unique ramene a 0,01 ms les
   animations et transitions de tout element `fx-`. Un composant futur ne
   peut pas oublier de s'y inscrire.
3. **`box-sizing: border-box`** porte par le paquet lui-meme. La zone de
   texte debordait sans le reset de Tailwind : trouve par le banc d'essai.
4. **Tokens de taille** : `controlHeight` 32/40/48/56 et `touchTarget` 44.
   Plus aucun `44px` litteral dans les feuilles de style.
5. **Taille de bouton par defaut `md`** (40 px, 44 px au doigt) : les
   boutons perdent 4 px sur ordinateur (changement visible).
6. **Pas de label flottant** : le libelle reste au-dessus du champ. Un
   label flottant rapetisse et se cache derriere la saisie (piege
   d'accessibilite connu).
7. **Pulsations limitees a 3 cycles** (bouton pulse, point urgent) : au-dela
   de 5 s, un mouvement doit pouvoir etre mis en pause (WCAG 2.2.2).
8. **Toast** : les erreurs restent jusqu'a fermeture ; le compte a rebours
   s'arrete au survol et au focus (WCAG 2.2.1) ; au plus 3 affiches.
9. **Tooltip** avec une fonction de rendu (pas de `cloneElement`), ancre au
   debut du declencheur : centre, il sortait de l'ecran pres d'un bord.
10. **Avatar sans photo** (D4) ; **statut et note** seulement avec des
    donnees reelles : presence du chat, avis en phase 10. Aucun ecran ne les
    affiche pour l'instant.
11. **Deplacement au survol** applique des maintenant (bouton -1 px, carte
    -2 px, neutralise en mouvement reduit). Le rapport de phase 3 le
    reportait a la phase 12.
12. **Role de forme `mark`** (6 px, cases a cocher) ; `border-radius: 0`
    accepte pour une banniere carree.
13. **Palette de commandes** : composant pret, sans commandes. Elle ne
    recevra que de vraies destinations, cablees avec la navigation
    (phase 6).

## Banc d'essai navigateur (nouveau)
`tests/browser/support/ui-harness.ts` rend les composants cote serveur,
avec les **vraies feuilles de style**, dans Chromium. On y mesure ce que
jsdom ne calcule pas : tailles, contraste calcule, geometrie RTL, tailles
tactiles (`pointer: coarse`). Aucune dependance nouvelle : `@fixiyi/ui`,
`@fixiyi/design-tokens` et React (deja dans le monorepo) sont ajoutes en
devDependencies de `tests/browser`.

Il n'y a pas de page galerie dans l'admin : aucun compte admin ne peut
etre cree sans ecrire en base, donc Playwright n'aurait pas pu l'atteindre.
Le comportement (clavier, ARIA) reste teste dans jsdom, ou les gestionnaires
d'evenements s'executent.

**Defauts trouves et corriges par ce banc**
- La zone de texte debordait de son conteneur (`box-sizing`).
- **Couleur des icones ignoree** : `.fx-icon { color: currentcolor }`,
  charge apres les feuilles des composants, ecrasait la coche blanche de la
  case a cocher et le gris des icones de champ.
- Bouton « retirer » d'une puce a 24 px au doigt : regle tactile placee
  avant la regle de base.
- Valeur du curseur affichee « km 15 » en RTL (`dir="auto"`).
- Infobulle sortant de l'ecran.

## Tests
| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/design-tokens` | 45 | **49** (4 paires de contraste : bouton success, badge neutre, contour d'etoile, piste de switch) |
| `@fixiyi/ui` | 136 | **221** |
| Monorepo | 592 | **681** |
| Playwright | 9 | **25** (9 parcours applicatifs + 16 banc d'essai) |

Les invariants de feuille de style tiennent pour tout le paquet (imports
inlines) : grille de 4 px, rayons et ombres par role, cibles >= 24 px via
les tokens, couleurs d'avatar pour chaque metier. Mutations verifiees : un
`gap: 6px`, un rayon brut et une ombre brute font echouer leurs tests.

## Commandes et resultats
```
pnpm lint --force       -> 15/15, 0 erreur, 0 avertissement
pnpm typecheck --force  -> 15/15, 0 erreur
pnpm test --force       -> 13/13, 681 tests
pnpm build --force      -> 10/10
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build web admin
playwright test         -> 25/25 (images web et admin reconstruites)
```

Captures examinees :
- banc d'essai `ds-01` a `ds-10` : icones, boutons, badges, cartes, champs,
  controles (LTR et RTL), alertes, identite, onglets, accordeon, feuille
  basse, modale, palette ;
- ecrans de l'application : boite fournisseur, formulaire de demande, chat.
  Aucune regression : cartes a 16 px, boutons a 40 px, contenu des cartes
  en place apres le passage du remplissage a `.fx-card__body`.

Note : la premiere reconstruction Docker a ete arretee par Claude Code
(memoire de la machine insuffisante), puis relancee a la demande de
l'utilisateur.

## Decision attendue (inchangee)
**Couleur de Domotique** : recommandation teal `#0D9488`.

## Limitations
- Les nouveaux composants ne sont pas encore utilises par les ecrans : ils
  seront adoptes en phases 7-8. Les ecrans gardent quelques classes brutes
  (`fx-field__error`, `fx-badge`) qui fonctionnent toujours.
- Le banc d'essai rend du HTML statique : l'etat « indetermine » d'une case
  a cocher n'y apparait pas (teste dans jsdom).
- Overlays rendus sur place (pas de portail), comme Modal ; pas de
  detection de collision pour les menus et infobulles.
- Pas de sous-menus.

## Prochaine phase
Phase 5 — Layout (Header, Footer, Navbar, BottomNavigation).
