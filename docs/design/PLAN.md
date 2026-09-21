# PLAN — REFONTE DESIGN SYSTEM V2

Mission hors protocole (voir `AUDIT.md`), demarree le 2026-09-21 sur
l'instruction « continue la refonte avec ces placeholders ». Sources : master
prompt parties 1 a 3B, decisions `DECISIONS.md` (D1-D7), planche
`reference/fixiyi-design-board.png`.

## Les 14 phases (ordre de l'utilisateur)

| # | Phase | Contenu |
|---|---|---|
| 1 | Design tokens | palette par roles (D1), typo, espacement, rayons, ombres, transitions, breakpoints, z-index — modules separes, CSS synchronise, contrastes testes |
| 2 | Typographie | `next/font` : Inter + Noto Sans Arabic (D6, D7) |
| 3 | Espacement / rayons / ombres | application des nouvelles echelles |
| 4 | Composants primitifs | amelioration des 13 existants, creation des nouveaux (partie 2B), icones (2C) |
| 5 | Layout | Header, Footer, Navbar, BottomNavigation |
| 6 | Navigation | routing et navigation, destinations reelles uniquement |
| 7 | Pages principales | accueil (grille du vrai catalogue), recherche de services, profil artisan (vue publique) |
| 8 | Pages secondaires | creation de demande, matching, boite fournisseur, chat, admin |
| 9 | Etats | loading / error / empty — consolidation |
| 10 | Responsive | 360 a 1440+ — consolidation |
| 11 | Accessibilite | audit WCAG 2.2 AA — consolidation |
| 12 | Animations | micro-interactions |
| 13 | Tests | unit, e2e, captures — consolidation |
| 14 | Nettoyage | refactoring, `09_DESIGN_SYSTEM_RULE.md`, `00_README.md` point 9 |

## Regle de fin de phase (toutes les phases)

Une phase n'est terminee que si :

- tests ajoutes pour ce qu'elle touche, contrastes **mesures** par test ;
- `pnpm lint`, `typecheck`, `test`, `build` verts, sans cache ;
- les 5 scenarios Playwright passent contre des images Docker reconstruites ;
- captures d'ecran examinees ;
- `docs/design/PHASE_X_REPORT.md` ecrit et commit dedie.

Les phases 9, 10, 11 et 13 sont donc des passes de **consolidation**, pas de
rattrapage : chaque phase anterieure livre deja teste et accessible.

## Hors perimetre (D2 et audit section 4)

Reservation, suivi de mission, avis ; parcours annuaire + reservation
directe ; toute donnee sans source (notes, avis, interventions, prix,
favoris, statistiques).

## Decisions encore ouvertes (posees a la phase concernee)

- Couleur de Domotique (identique a Serrurier) — phase 1, proposee, non fixee.
- Vue publique de `GET /providers/:id` (fuite des coordonnees) — phase 7.
- Route de liste d'artisans (mode DIRECT) — phase 7.
- Ecrans artisan Profil / Services / Disponibilite — phase 8.
- URL des comptes sociaux — phase 5 (pied de page).
