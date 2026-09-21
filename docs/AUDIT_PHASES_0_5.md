# AUDIT COMPLET DES PHASES LIVREES — 2026-09-21

Demande : audit de toutes les phases livrees avec correction au fil de
l'eau, avant la phase 6 de la refonte design. Perimetre retenu : phases
produit 0 a 6 (le chat de la phase 6 est livre) et phases 1 a 5 de la
refonte design. Hierarchie : Fixiyi > ECC.

Lecture faite : 06_SCOPE, 03_AGENT_PROTOCOL, 05_DECISION_POLICY,
08_ECC_INTEGRATION, PROGRESS, DECISIONS (1-62), rapports de phase 0 a 6,
README.

## Outils ECC utilises
| Agent | Perimetre |
|---|---|
| `ecc:code-reviewer` | `apps/api/src` (auth, catalog, providers, companies, verification, media, requests, matching, configuration, geo, chat, common), `apps/worker`, `packages/contracts` |
| `ecc:security-reviewer` | depot entier : secrets, injections, RBAC, rate limiting, CORS/CSRF, URL presignees, Socket.IO, XSS, dependances (`pnpm audit`) |
| `ecc:react-reviewer` | `apps/web`, `apps/admin`, `packages/ui` |

Chaque constat a ete **reverifie dans le code** avant correction, et chaque
correction est prouvee par un test ecrit d'abord (rouge, puis vert) ou par
une verification par mutation.

## Journal des corrections

| # | Gravite | Origine | Fichier | Probleme | Correction | Preuve |
|---|---|---|---|---|---|---|
| 1 | HIGH | Phase 3 | `companies/company.service.ts`, `company.controller.ts` | `GET /companies/:id/members` ouvert a tout utilisateur connecte : liste des membres (ids, roles, invitations en attente) de n'importe quelle entreprise | Il faut etre membre ACTIF de l'entreprise (403 sinon) | e2e : un inconnu obtenait 200, obtient 403 |
| 2 | HIGH | Phase 2 | `auth/session/session.service.ts` | Rotation du refresh token en lecture-modification-ecriture : **7 refresh concurrents sur 8** reussissaient avec le meme jeton, chacun avec une paire valide | Verification et increment en UNE mise a jour conditionnelle (`findOneAndUpdate` sur `tokenVersion`) ; revocation atomique en cas de reutilisation | e2e : 8 refresh paralleles -> exactement 1 succes |
| 3 | HIGH | Phases 2-6 (B2 de l'inspection, jamais corrige hors chat) | 8 controleurs | **30 routes d'ecriture sur 46 sans rate limit** : demandes et uploads, dispatch du matching, verification, entreprises, profil, catalogue, configuration, compte, et 3 routes du chat (accuses, finalisation) | Quota par utilisateur sur toutes (Decision 63) ; `email` passe de l'IP a l'utilisateur (B4) | Test de couverture sur les metadonnees de TOUS les controleurs ; mutation verifiee |
| 4 | HIGH | Phase 3 (B2 de l'inspection) | `contracts/verification.ts`, `verification.service.ts` | Upload de piece d'identite sans limite de taille ni de type | Types PDF/JPEG/PNG/WebP, 10 Mo max, taille declaree **signee dans l'URL** (comme les medias, Decision 52) | e2e : 50 Mo et `.exe` refuses (400), envoi plus gros que declare refuse par MinIO ; mutation verifiee |
| 5 | MEDIUM | Phase 1 | `packages/config/src/env-schema.ts` | En production, les secrets d'exemple publics de `.env.example` passaient la validation (42 caracteres) : n'importe qui pouvait forger un jeton ADMIN | En production : refus des valeurs d'exemple, 32 caracteres minimum, 3 secrets distincts ; developpement inchange (Decision 64) | 6 tests unitaires |
| 6 | MEDIUM | Phase 5 (produit) | `apps/web/src/app/page.tsx`, `login/page.tsx`, `lib/start-route.ts` | **Route orpheline** : la boite fournisseur (`/provider/requests`) n'etait accessible qu'en tapant l'URL ; un fournisseur arrivait toujours sur le formulaire client | Ecran de depart selon le role, a l'accueil et apres connexion (Decision 65) | Playwright `navigation.spec.ts` : echouait (arrivee sur `/requests/new`), passe |
| 7 | MEDIUM | Phase 6 / refonte 4 | `packages/ui/src/components/IconButton.tsx`, chat | Boutons de recherche et de reaction avec `aria-expanded` mais sans `aria-controls` : le lecteur d'ecran ne sait pas ce qui s'ouvre | Prop `controls`, zones dotees d'un id, reference posee seulement quand la zone existe | Test unitaire |
| 8 | LOW | Phase 2-3 (UI) | `apps/web` et `apps/admin` `login/page.tsx` | Jetons de la connexion types a la main, seul `user` valide | Toute la reponse validee par `AuthSessionResultSchema` | typecheck + parcours Playwright |
| 9 | LOW | Phase 1 | `common/filters/problem-details.filter.ts` | `x-trace-id` du client recopie tel quel dans les journaux (fausses lignes, inondation) | Reutilise seulement s'il correspond a `[\w-]{1,64}` | Test : rouge sans la correction, vert avec |
| 10 | LOW | Phase 2 | `auth/token/token.service.ts` | Algorithme JWT non epingle a la verification | HS256 epingle (signature et verification) | Test : un jeton HS512 au bon secret est refuse |
| 11 | LOW | Phase 4 (web) | `apps/web/src/lib/auth-store.ts` | Commentaire faux (« Bearer-in-memory ») alors que les jetons sont persistes dans `localStorage` | Commentaire exact ; decision renvoyee a l'utilisateur (voir plus bas) | — |
| 12 | LOW | Phase 2 | `README.md`, `docs/PROGRESS.md` | README bloque a « Phase 2 terminee », Socket.IO « pas encore implemente » ; PROGRESS sans la refonte | Mis a jour | — |

## Navigation et liens (etape 4)
- Inventaire de toutes les destinations (`router.push/replace`, `href`)
  de `apps/web` et `apps/admin` : **toutes pointent vers une route
  existante**, aucun lien mort.
- **1 route orpheline** trouvee et corrigee (#6).
- Nouveau `tests/browser/tests/navigation.spec.ts` (4 parcours, par
  l'interface et non par URL) : visiteur non connecte, clic sur le logo
  d'un client connecte, fournisseur arrivant sur sa boite, admin ; chaque
  lien interne rendu est suivi et doit repondre (< 400).
- Clavier et RTL des composants de `@fixiyi/ui` : couverts par les tests
  jsdom (onglets en RTL, menus, palette, dialogues) et le banc d'essai
  navigateur (interrupteur et barre de navigation en RTL, lien
  d'evitement).
- Liens web <-> admin : aucun (applications separees, sessions
  separees) ; chacune renvoie a sa propre connexion.

## Dette technique (etape 5)
| Point | Resultat |
|---|---|
| `any` | **0** dans `apps/*/src`, `packages/*/src`, tests compris |
| TODO / FIXME | **0** ; 2 `eslint-disable` justifies en ligne (`apps/worker`) |
| Argent | entiers en unites mineures partout (`MoneyAmountSchema = z.number().int()`, `amountMinor`) ; devis de transport arrondi a l'entier, jamais persiste en flottant |
| Donnees simulees | uniquement les providers `dev`/`fake` prevus (OTP, carte, SMS) et les semences documentees (catalogue, configuration) |
| Contrats Zod | 116 schemas ; 1 seul inutilise (`BaseEntitySchema`, base de la phase 1, conserve) ; reponses consommees validees par schema (1 ecart corrige, #8) |

## Constate, verifie sain (extraits des 3 audits)
Sessions reverifiees en base a chaque requete, detection de reutilisation
du refresh ; OTP hache (HMAC), plafonds, code dev jamais renvoye en
production ; `RolesGuard` classe + methode ; controles de propriete sur
demandes, medias, conversations, messages, candidatures, verification ;
aucune injection NoSQL (ids UUID valides par Zod) ; recherche du chat
echappee (pas de ReDoS) ; cles de stockage assainies ; URL de
telechargement courtes (5 min) ; Socket.IO authentifie a la poignee de
main avec salles personnelles seulement ; CORS sans `credentials`, CSRF
double-submit pour les cookies ; aucun `dangerouslySetInnerHTML` ;
`pnpm audit` : 0 vulnerabilite haute ou critique ; image API non-root.

## En attente d'une decision de l'utilisateur
1. **Jetons de `apps/web` dans `localStorage`** (ecc:react-reviewer, HIGH).
   Accepte pour l'admin interne (Decision 33) puis repris tel quel pour
   l'application publique (Decision 38). Une faille XSS future
   permettrait de voler une session de 30 jours. Options : cookie httpOnly
   pour le refresh (API et web a mettre sur le meme site, CORS avec
   `credentials`), ou jetons en memoire seulement (reconnexion a chaque
   rechargement). Changement d'architecture d'authentification : decision
   requise (05_DECISION_POLICY).
2. `trustProxy` (Decision 60) a configurer avant la production.
3. Toujours ouvertes : couleur de Domotique, URL des comptes sociaux,
   conservation des messages supprimes (Decision 59), vue publique de
   `GET /providers/:id` (fuite des coordonnees), logo.
