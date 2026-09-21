# REFONTE DESIGN — PHASE 3 : ESPACEMENTS, RAYONS, OMBRES

## Statut : TERMINEE

## Date
2026-09-21

## Objectifs (master prompt 2A, 2B ; PLAN.md)
Appliquer les echelles V2 d'espacement, de rayons et d'ombres a tout ce qui
s'affiche : `@fixiyi/ui` et les applications. Aucune valeur hors echelle.

## Constat de depart
Les rayons et les ombres de `@fixiyi/ui` venaient deja des tokens, mais
**choisis composant par composant** : une modale et une carte avaient le
meme rayon `lg`, un bouton et un champ auraient pu diverger. Il restait
**14 espacements hors de la grille de 4 px** (6, 10, 2 et 3 px), des
dimensions de squelette en style en ligne, un fond de modale en noir pur code
en dur, et les classes Tailwind des applications (`p-6`, `gap-4`…) sur
l'echelle par defaut de Tailwind, pas sur les tokens.

## Ce qui a ete fait

### Roles de forme et d'elevation (`@fixiyi/design-tokens`)
Meme principe que les roles de couleur de la phase 1 : un composant utilise
un **role**, le role pointe vers un pas d'echelle (`var()` dans
`tokens.css`), et changer la forme de tous les boutons tient en une ligne.

| Role de forme (`radiusRoles`) | Pas | Pour |
|---|---|---|
| `control` | md 8px | boutons, champs, choix, boutons icone, saisie du chat |
| `card` | xl 16px | cartes, bulles de chat |
| `bubble-tail` | sm 6px | le coin de la bulle tourne vers son auteur |
| `inset` | md 8px | media et citation dans une bulle, squelette |
| `overlay` | 2xl 24px | modale (et la feuille basse de la phase 4) |
| `pill` | full | badges, reactions, spinner, points de saisie |

| Role d'elevation (`elevation`) | Pas | Pour |
|---|---|---|
| `raised` | sm | cartes, boutons pleins, bulles |
| `hover` | lg | bouton plein survole (partie 2B : « hover : shadow-lg ») |
| `overlay` | xl | modale |

Plus `scrim` : fond de modale en encre chaude `rgba(28, 25, 23, 0.45)` au
lieu de `rgb(0 0 0 / 45%)`.

### `@fixiyi/ui`
- Tous les espacements sur `--fixiyi-space-*` : 10 px -> 8 (remplissage
  vertical des controles ; hauteur inchangee, tenue par le minimum de 44 px),
  6 px -> 4 ou 8, 2 et 3 px -> 4.
- Tous les rayons par role, toutes les ombres par role.
- Changements visibles : cartes et bulles plus rondes (12 -> 16 px), modale
  a 24 px avec une ombre plus profonde, bouton plein qui monte a `shadow-lg`
  au survol, badges plus aeres (12 px de cote), reactions a 24 px de haut
  (cible WCAG 2.5.8 atteinte).
- `Skeleton` : plus de style en ligne ; la ligne prend la taille du texte
  `body-sm` et la derniere ligne est raccourcie par une classe.

### Applications : pont Tailwind (`@fixiyi/design-tokens/tailwind`)
Nouveau `tailwind-theme.css`, importe par `globals.css` de web et admin :
- `--spacing` = `--fixiyi-space-1` : `p-6` compile en
  `calc(var(--fixiyi-space-1) * 6)` (verifie dans le CSS de build) ;
- rayons et ombres par defaut de Tailwind **supprimes**, remplaces par
  l'echelle et les roles (`rounded-card`, `shadow-raised`…) : une classe hors
  echelle ne genere plus rien ;
- `--font-sans` = la pile Fixiyi (la base de Tailwind suit les tokens).

## Decisions prises dans la phase
1. **Roles de forme et d'elevation** en plus des echelles (meme modele que
   les couleurs, D1).
2. **Cartes a 16 px, modale a 24 px, controles a 8 px**, lus sur la planche.
3. **Tailwind branche sur les tokens** plutot que d'interdire Tailwind dans
   les applications : les classes existantes restent valides et suivent
   l'echelle.
4. Le **deplacement** au survol (translate -1 px, partie 2B) est reporte en
   phase 12 (animations, avec `prefers-reduced-motion`) ; l'ombre, elle, est
   appliquee ici.

## Tests
| Suite | Avant | Apres |
|---|---|---|
| `@fixiyi/design-tokens` | 41 | **45** (roles -> pas nommes, pont Tailwind complet, aucune variable inconnue) |
| `@fixiyi/ui` | 130 | **136** (grille de 4 px, rayons et ombres par role uniquement, elevation au survol, scrim, squelette sans style en ligne) |
| Monorepo | 582 | **592** |

Verifie par mutation : remettre un `gap: 6px`, un `radius-lg` brut et un
`shadow-lg` brut fait echouer les trois tests correspondants ; restauration
-> vert.

## Commandes et resultats
```
pnpm lint --force       -> 15/15, 0 erreur
pnpm typecheck --force  -> 15/15, 0 erreur
pnpm test --force       -> 13/13, 592 tests
pnpm build --force      -> 10/10
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build web admin
playwright test         -> 9/9 (images web et admin reconstruites)
```

Captures examinees (demande envoyee, formulaire, boite fournisseur, chat) :
cartes a 16 px, badges en pilule plus aeres, bulles a 16 px avec coin de
queue a 6 px, controles inchanges en hauteur (44 px).

**Captures de reference corrigees** : `12-provider-inbox.png` (et d'autres)
etaient prises pendant le fondu d'entree de la liste — texte et bouton
delaves sur la capture, deja le cas avant cette phase. Les 11 appels
`screenshot()` passent `animations: "disabled"` : Playwright termine les
animations avant la capture, qui montre l'etat final reel.

## Decision attendue (inchangee)
**Couleur de Domotique** : recommandation teal `#0D9488`.

## Limitations
- Les largeurs de conteneur (`42rem`, `56rem`, `520px` de la modale) et
  les tailles de cible (44 px) ne sont pas des espacements : elles relevent
  du layout (phase 5) et des tailles de composants (phase 4).
- Le fond translucide de la citation dans une bulle (`rgb(0 0 0 / 8%)`)
  reste en l'etat : il doit fonctionner sur la bulle orange comme sur la
  blanche ; il sera traite avec les variantes de bulle en phase 4.

## Prochaine phase
Phase 4 — Composants primitifs.
