# REFONTE DESIGN — PHASE 5 : LAYOUT

## Statut : TERMINEE

## Date
2026-09-21

## Objectifs (PLAN.md ; master prompt 2B §18)
Header, Footer, Navbar, BottomNavigation, et la coque qui les assemble,
appliquee aux deux applications. La liste des destinations, l'etat actif
calcule depuis la route et les menus par role relevent de la phase 6
(Navigation) : la frontiere est tenue.

## Ce qui a ete fait

### Composants (`@fixiyi/ui`) : 36 -> 43
| Composant | Role |
|---|---|
| `AppShell` | Lien d'evitement « Aller au contenu » (WCAG 2.4.1), en-tete, contenu, pied, barre basse. Expose `--fx-shell-header-height` |
| `Header` | Barre d'application (repere `banner`), collante : 56 px sur telephone, 64 px au-dessus. Emplacements marque, navigation (cachee sur telephone), actions |
| `Logo` | Nom « Fixiyi » en Inter 800, couleur texte de marque : placeholder D4, lien vers `/` ; suffixe optionnel (« Admin ») |
| `Navbar` | Destinations bureau ; page courante marquee `aria-current="page"` en plus de la couleur |
| `BottomNavigation` | Barre basse fixe du telephone, au-dessus de la zone sure, icone ET libelle, cibles >= 44 px, cachee des 768 px |
| `Footer` | Repere `contentinfo`, slogan, groupes de liens (repere `navigation` nomme), mention legale |
| `Page` | Le `<main>` d'un ecran : son unique `<h1>`, ses actions, une largeur de conteneur |
| `LinkProvider` / `UiLink` | `@fixiyi/ui` ne depend d'aucun routeur : chaque app y branche `next/link` une fois, la navigation reste cote client |

Compteurs de navigation (messages non lus) : affiches seulement pour une
valeur reelle, jamais a 0 ; lus apres l'intitule (« Messages, 3 non lus »),
le chiffre visuel est cache aux lecteurs d'ecran.

### Tokens (`sizes.ts`)
Largeurs de conteneur 672 / 896 / 1200 px, hauteur d'en-tete 56 / 64 px,
barre basse 64 px. Les largeurs de page `42rem` / `56rem` laissees par la
phase 3 passent sur ces tokens (valeurs identiques).

### Applications
- **web et admin** : `LinkProvider` avec `next/link` dans les providers ;
  `AppShell` + `Header` avec `Logo` dans le layout racine (« Fixiyi Admin »
  pour l'admin).
- **web** : `Footer` avec le slogan de la planche (« Plus qu'une
  application, une solution de confiance. ») et « © annee Fixiyi ».
- **Pages de connexion** : la marque visible passe dans l'en-tete ; la
  page garde un `<h1>` pour les lecteurs d'ecran (« Connexion a Fixiyi »,
  masque visuellement) ; `min-h-screen` devient `flex-1`.
- **Chat** : `100dvh` devient `.fx-shell__fill` (hauteur ecran moins
  l'en-tete) : la zone de saisie reste en bas, sans defilement de page.

## Decisions prises dans la phase
1. **Navbar et BottomNavigation construites, pas encore remplies.** Leurs
   entrees (Demander, Demandes, Messages, Profil…) dependent du role et
   de routes a creer (liste des conversations, profil) : phase 6. Une barre
   de navigation sans destinations reelles serait decorative (03_AGENT_PROTOCOL §2).
2. **Chaque page garde son `<main>`** : la coque n'en ajoute pas (deux
   `main` seraient invalides) ; le lien d'evitement vise l'enveloppe du
   contenu, focalisable.
3. **Pied de page sans liens ni reseaux sociaux** : aucune page legale
   n'existe, les URL sociales ne sont pas fournies ; aucun lien mort.
4. **Pied de page sur toutes les pages web** (sous le pli sur le chat) ;
   pas de pied de page dans l'admin, outil interne.
5. **Liens via contexte + `createElement`** (`UiLink`) : le compilateur
   React refuse un composant obtenu pendant le rendu puis utilise en JSX.

## Defauts trouves par le banc d'essai et corriges
- **Pages retrecies** : dans la coque en colonne flex, `margin-inline:
  auto` retrecissait `.fx-page` a son contenu. `inline-size: 100%` ajoute
  (sans le banc d'essai, tous les ecrans l'auraient eu).
- **Pied de page masque** par la barre basse sur telephone : la reserve
  d'espace passe du contenu a la coque entiere.
- Nom accessible du logo « FixiyiAdmin » (espace dans la mauvaise balise).
- Compteur lu avant l'intitule dans la barre basse.

## Tests
| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/design-tokens` | 49 | 49 (les nouveaux tokens entrent dans le test de synchronisation existant) |
| `@fixiyi/ui` | 221 | **232** (LinkProvider, Logo, reperes, lien d'evitement, `aria-current`, compteurs, Page) |
| Monorepo | 681 | **692** |
| Playwright | 25 | **29** (banc d'essai : telephone, bureau, lien d'evitement au clavier, RTL) |

Le test des cibles tactiles exclut desormais explicitement les decorations
non interactives (le compteur) ; le test de grille accepte les formes
`env(safe-area-inset-*)` des telephones a encoche.

**Charge machine** : sur une machine saturee (2,7 Go libres), des tests
jsdom sans rapport depassaient 5 s. Relances avec `--concurrency=2` : tout
passe. Le test d'unicite des icones fait desormais un seul rendu (il en
faisait 63).

## Commandes et resultats
```
pnpm lint --force                     -> 15/15, 0 erreur, 0 avertissement
pnpm typecheck --force                -> 15/15, 0 erreur
pnpm test --force --concurrency=2     -> 13/13, 692 tests
pnpm build --force                    -> 10/10
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build web admin
playwright test                       -> 29/29
```

Captures examinees : banc d'essai `ds-11` (telephone : en-tete, barre basse,
pied visible au-dessus), `ds-12` (bureau : navbar, page courante),
`ds-13` (RTL) ; ecrans reels : connexion (en-tete, carte centree, pied),
chat (hauteur exacte sous l'en-tete), recherche de fournisseurs.

## Decisions attendues
- **Couleur de Domotique** : recommandation teal `#0D9488`.
- **URL des comptes sociaux** (et kits de marque) pour le pied de page.

## Limitations
- Pas encore de destinations dans l'en-tete ni de barre basse dans les
  apps : phase 6.
- L'annee du « © » est calculee au build du layout.

## Prochaine phase
Phase 6 — Navigation (destinations reelles, etat actif, par role).
