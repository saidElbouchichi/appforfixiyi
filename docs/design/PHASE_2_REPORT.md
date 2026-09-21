# REFONTE DESIGN — PHASE 2 : TYPOGRAPHIE

## Statut : TERMINEE

## Date
2026-09-21

## Objectifs (master prompt 2A ; decisions D6, D7)
Charger Inter et Noto Sans Arabic via `next/font` dans web et admin, puis
placer tout texte de `@fixiyi/ui` et des applications sur l'echelle
typographique V2. Aucune taille de police litterale ne doit rester.

## Ce qui a ete fait

### Chargement des polices (`next/font`, D6)
- `apps/web/src/app/fonts.ts` et `apps/admin/src/app/fonts.ts` :
  `Inter` (subset `latin`, preload) et `Noto_Sans_Arabic` (subset `arabic`,
  **sans preload** : une page en francais ne paie pas la police arabe),
  `display: swap`, variables `--fixiyi-font-inter` / `--fixiyi-font-noto-arabic`
  posees sur `<html>` par les deux `layout.tsx`.
- Polices **auto-hebergees au build** : aucune requete vers Google a
  l'execution. `next/font` genere aussi une police de repli aux metriques
  alignees (`Inter Fallback` sur Arial, `size-adjust` 107 %), ce qui evite
  le saut de mise en page pendant le chargement.
- Les deux sont des polices variables : un fichier couvre toutes les
  graisses de l'echelle (400 a 800).
- Les sous-ensembles sont declares par `unicode-range` : le navigateur ne
  telecharge que ceux dont la page affiche des caracteres. Verifie dans le
  CSS genere.

### Tokens (`@fixiyi/design-tokens`)
- Nouveau `fontVariables` dans `typography.ts`.
- Les piles de `tokens.css` deviennent
  `var(--fixiyi-font-inter, Inter), var(--fixiyi-font-noto-arabic, "Noto Sans Arabic"), -apple-system, …` :
  police chargee quand l'application la fournit, nom de famille simple sinon.
- Nouveau test : les piles lisent bien les variables de `fontVariables`,
  dans le bon ordre. Le test de synchronisation compare les familles apres
  deballage des `var()`.

### Echelle appliquee (`@fixiyi/ui/styles.css`)
| Element | v1 | V2 |
|---|---|---|
| Titre de page | 24px semibold | style `h3` (24/32, bold, -0,01em) |
| Titres de carte, modale, etat | 17-18px | style `h5` (18/26, semibold) |
| Boutons, champs, zone de saisie, bulle | 15px | style `body` (16/24) |
| Libelle, aide, erreur, citation | 13-14px | style `body-sm` (14/20) |
| Badge, reaction | 13px | style `caption` (12/16) |

- Champs a 16px : **Safari iOS ne zoome plus au focus** (il zoome sous 16px).
- 11 classes utilitaires `.fx-text-{display,h1…h5,body-lg,body,body-sm,caption,overline}`,
  une par style de l'echelle, construites depuis les variables du style.
- `:lang(ar), :lang(ary)` bascule sur la pile arabe d'abord (`font-family`
  pour le texte qui herite, variable re-pointee pour les composants qui
  posent leur propre `font-family`).

### Applications
Les `text-sm` Tailwind (web : inbox fournisseur, formulaire de demande) et
le `style={{ fontSize }}` du titre de conversation passent sur
`.fx-text-body-sm` et `.fx-text-h4`. Plus aucune taille hors echelle dans
`apps/*/src`.

## Decisions prises dans la phase
1. **15px devient 16px** pour les controles et la bulle de chat (echelle
   2A : pas de 15px ; et seuil anti-zoom iOS).
2. **13px devient 14px** pour l'aide et l'erreur de champ (lisibilite du
   message d'erreur) et **12px** pour badge et reaction (etiquettes compactes).
3. **Noto Sans Arabic non prechargee** : chargee a la demande, des qu'un
   texte arabe s'affiche.
4. `line-height: 1` conserve sur l'icone d'etat (boite du glyphe, pas du texte).

## Tests
| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/design-tokens` | 40 | **41** (variables `next/font` dans les piles) |
| `@fixiyi/ui` | 125 | **130** (aucune taille ni interligne litteral, une classe par style, controles a 16px, bascule arabe) |
| Monorepo | 576 | **582** |
| Playwright | 5 | **9** (`typography.spec.ts`, web et admin) |

`typography.spec.ts` verifie dans un vrai navigateur : le `body` est en
Inter via la variable `next/font` (presence de `Inter Fallback`), la police
est chargee, **chaque fichier de police vient de l'origine de l'application**,
Noto Sans Arabic n'est pas chargee sur une page francaise puis l'est des
qu'un texte `lang="ar"` apparait, et ce texte est bien rendu en Noto Sans
Arabic d'abord.

Verifie par mutation : remplacer le poids du style `h5` dans sa classe
utilitaire fait echouer le test avec le nom du style ; restauration -> vert.

## Commandes et resultats
```
pnpm lint --force       -> 15/15, 0 erreur
pnpm typecheck --force  -> 15/15, 0 erreur
pnpm test --force       -> 13/13, 582 tests
pnpm build --force      -> 10/10
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build web admin
playwright test         -> 9/9
```

Captures examinees (connexion, demande, inbox, chat) : Inter partout,
titres en gras serre, champs et bulles a 16px, badges compacts. Les captures
de reference de `tests/browser/screenshots/` sont regenerees.

## Decision attendue (inchangee)
**Couleur de Domotique** : recommandation teal `#0D9488`
(voir `PHASE_1_REPORT.md`).

## Limitations
- Le build Docker telecharge les polices : il demande un acces reseau
  (deja le cas pour `pnpm install`).
- Pas encore d'interface en arabe : la bascule est prete et testee, la
  traduction reste hors refonte.
- Composants toujours aux tailles et variantes v1 : phase 4.

## Prochaine phase
Phase 3 — Espacements, rayons, ombres appliques.
