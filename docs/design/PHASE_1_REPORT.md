# REFONTE DESIGN — PHASE 1 : DESIGN TOKENS

## Statut : TERMINEE

## Date
2026-09-21

## Objectifs (master prompt 2A, 2B §17 ; decisions D1-D7)
Palette par roles (D1), typographie, espacement, rayons, ombres,
transitions, breakpoints, z-index en modules separes ; `tokens.css`
synchronise ; aucune valeur dupliquee dans les composants.

## Ce qui a ete fait

### Modules (`packages/design-tokens/src/`)
`colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `shadows.ts`,
`transitions.ts`, `breakpoints.ts`, `z-index.ts`, `index.ts`. L'ancien
`tokens.ts` monolithique est supprime (aucun code TypeScript ne
l'importait : les consommateurs passent tous par les variables CSS).

### Deux couches de couleur
- **Echelles** : la palette de la partie 2A, a l'identique.
- **Roles** : ce que les composants utilisent — `action`, `action-hover`,
  `focus`, `icon-accent`, `brand`, `surface*`, `text*`, `border`,
  `border-control`, `*-text` / `*-surface` pour les semantiques,
  `danger-action`. Un role est declare en CSS comme `var()` vers l'echelle :
  le re-pointer se fait en une ligne.

### Le contraste est un test, pas une affirmation
`contrastPairs` liste **31 paires** premier plan / fond avec leur seuil WCAG
(4,5 texte ; 3 icones, bordures, focus). `tokens.test.ts` calcule chaque
ratio avec la formule WCAG et echoue sous le seuil. Plus un test qui
interdit d'associer du texte blanc a l'orange de marque `#F97316`.

### Migration des consommateurs
`packages/ui/src/styles.css`, `animations.css` et les styles en ligne des
applications passent des pas d'echelle v1 aux roles V2 — par bloc CSS, pas
par remplacement global, car un meme token v1 avait plusieurs sens
(`neutral-0` : fond d'une carte, mais **texte** sur un bouton orange).
Verifie : aucune variable CSS utilisee n'est non definie.

## Decisions prises dans la phase

1. **Extension de D1 aux semantiques** : ajout des teintes `50` et des
   nuances de texte `warning-700` (`#B45309`, 5,02:1) et `info-700`
   (`#0369A1`, 5,93:1) — les `600` de la partie 2A sont trop claires pour
   du texte (3,19 et 4,10:1).
2. **`neutral-0` = `#FFFFFF` conserve** : absent de l'echelle stone 50-900,
   mais toutes les surfaces reposent dessus.
3. **Avatar Serrurier en `#7C3AED`** (5,70:1 avec du blanc) : `#8B5CF6`
   n'atteint 4,5:1 ni en blanc ni en fonce (D4).
4. **Easing renommes** : `standard / decelerate / accelerate` deviennent
   `in-out / out / in`, plus `linear` et `spring` (approximation `linear()`
   ; un navigateur sans support retombe sur l'easing par defaut).
5. **Durees** : 120/200/320 ms deviennent 150/200/300 ms, plus `instant` (0) et
   `slower` (500).
6. **Breakpoints** `mobile 375 / tablet 768 / desktop 1024 / large 1280`,
   TypeScript uniquement (une variable CSS est inutilisable dans `@media`).
7. **Domotique absente** de la palette metiers (voir « Decision attendue »).

## Defaut preexistant corrige

**Les bordures de champs du Design System v1 echouaient WCAG 1.4.11** :
`#b8bfbf` sur blanc = **1,87:1**, sous les 3:1 exiges pour le contour qui
identifie un champ. Nouveau role `border-control` (`#78716C`, 4,80:1),
applique aux champs, choix radio et zone de saisie du chat. Les bordures
purement decoratives (cartes, separateurs) restent claires.

Idem pour le nom d'un noeud desactive du catalogue admin, affiche en
`neutral-400` (2,52:1) : c'est du contenu, pas un controle inactif ; il passe
en `text-subtle` (4,80:1).

## Tests

| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/design-tokens` | 6 | **40** (31 contrastes, synchronisation bidirectionnelle, valeurs V2, unicite des couleurs metiers) |
| `@fixiyi/ui` | 125 | 125, inchanges et verts sur les nouvelles valeurs |
| Monorepo | 542 | **576** |

Le test de synchronisation a ete **verifie par mutation** : re-pointer le
role `action` sur `#F97316` et supprimer `--fixiyi-radius-3xl` font echouer
le test avec le nom exact des deux ecarts ; restauration -> vert.

## Commandes et resultats

```
pnpm lint --force       -> 15/15, 0 erreur
pnpm typecheck --force  -> 15/15, 0 erreur
pnpm test --force       -> 13/13, 576 tests
pnpm build --force      -> 10/10
playwright test         -> 5/5 (images web et admin reconstruites)
```

Captures examinees : bulle de message propre en `#C2410C` avec texte blanc,
contours de champs visibles, bandeau de protection aux couleurs info
testees, neutres chauds sur l'ensemble.

## Decision attendue

**Couleur de Domotique.** La partie 2A lui donne `#8B5CF6`, deja celle de
Serrurier ; le test d'unicite l'interdirait. Deux propositions mesurees :

| Couleur | Sur blanc | Texte fonce dessus |
|---|---|---|
| Teal `#0D9488` (rappel de l'ancienne identite Fixiyi) | 3,74:1 (icone OK) | 4,67:1 |
| Indigo `#6366F1` | 4,47:1 | 3,92:1 |

Recommandation : **teal `#0D9488`**, plus eloigne de toutes les autres
couleurs metiers. Rien ne l'utilise avant la mise en oeuvre de D3.

## Limitations
- Les polices ne sont toujours pas chargees : c'est la phase 2.
- Les composants gardent leurs tailles et variantes v1 : phase 4.
- Les couleurs metiers ne sont utilisees par aucun ecran avant D3.

## Prochaine phase
Phase 2 — Typographie (`next/font` : Inter + Noto Sans Arabic).
