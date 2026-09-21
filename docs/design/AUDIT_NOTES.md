# AUDIT NOTES — ecarts entre le prompt de mission et le depot

Date : 2026-09-21. Chiffres verifies dans le depot, pas repris du prompt.
Ce sont ces chiffres qui font foi pour la refonte.

## Chiffres du master prompt (partie 1/3)

| Le prompt indique | Realite | Source de la verification |
|---|---|---|
| 9 composants | **13 fichiers de composants** : Badge, Button, Card, Chat (MessageBubble, DeliveryStatus, ReplyQuote, TypingIndicator), EmptyState, ErrorState, Icon, IconButton, Input, Loading (Loading, Skeleton, Spinner), Modal, RadioGroup, Select | `packages/ui/src/components/*.tsx` |
| 21 icones | **25** (21 + `send`, `reply`, `attach`, `check-double`, Phase 6) | `Icon.tsx`, `ICON_NAMES` |
| 52 tests Design System | **125** | `pnpm --filter @fixiyi/ui test` |
| 375+ tests | **542** (api 278, ui 125, contracts 90, shared-utils 27, config 11, design-tokens 6, i18n 3, worker 2) | `pnpm test --force` |
| 52+ decisions | **61** | `docs/DECISIONS.md` |
| 15+ commits | **31** au moment de l'audit | `git log --oneline` |

Exacts dans le prompt : Phases 0-6 terminees, 8 packages, 4 apps,
Next.js 16, 7 services Docker, ECC v2.2.2.

## Ecarts entre la planche et le depot

| La planche / le panneau suppose | Realite |
|---|---|
| Une application React Native (`src/screens/*.tsx`, `theme/*.ts`) | Monorepo Next.js ; mobile = Phase 13, non cree (Decision 12) |
| Des fonctionnalites « a conserver » : reseaux sociaux, paiement, suivi de mission, avis, notifications, dashboard artisan | **Aucune n'existe** (Phases 7 a 13) |
| Des donnees : notes, nombre d'avis, interventions, prix, photos d'artisans, « +12 000 clients » | Aucun champ ni aucune source pour ces donnees |
| Une police Inter | Declaree dans la pile mais jamais chargee |
| Des couleurs par metier | Le catalogue n'a ni couleur ni icone |
| Un logo | Pas de fichier vectoriel fourni |

## Image recue

**Une** image composite (planche design et panneau « Demande
d'integration » cote a cote), et non deux fichiers distincts. Son contenu
couvre bien les deux descriptions du message. Archivee :
`docs/design/reference/fixiyi-design-board.png`.
