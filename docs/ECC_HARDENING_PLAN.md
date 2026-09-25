# RENFORCEMENT ECC — AUDIT ET PLAN

Date : 2026-09-23. Statut : **audit termine, plan soumis, aucun code ecrit**.

Perimetre : appliquer les regles ECC laissees en attente par la **Decision
68**, apres la phase 7 de la refonte design. Hierarchie inchangee
(`08_ECC_INTEGRATION.md`) : **en cas de conflit, Fixiyi prime**.

Sources : `~/.claude/rules/ecc/common/*.md`,
`~/.claude/rules/ecc/typescript/*.md`, `docs/prompt/08_ECC_INTEGRATION.md`,
`docs/DECISIONS.md` (62, 63, 68, 70, 71), `docs/design/PHASE_7_REPORT.md`.
Tout chiffre ci-dessous est **mesure** sur l'arbre a `d7d1aca`, pas estime.

---

## 1. Resume de l'audit

La bonne nouvelle d'abord, parce qu'elle change les priorites : **la moitie
des regles ECC est deja tenue**, et souvent mieux que ce que la regle
demande.

| Regle ECC | Etat mesure |
|---|---|
| Aucun secret en dur | **0** occurrence ; `.env` ignore, seuls `.env.example` et `.env.test.example` suivis |
| Pas de `any` | **0** dans le code ecrit a la main (les 26 occurrences sont dans `.next/types/` genere, plus deux fois le mot anglais « any » dans un commentaire) |
| Rate limit sur les ecritures (Decision 63) | **46 / 46** routes d'ecriture |
| Fichiers < 800 lignes | **0** depassement (plus gros source : 464 lignes, un test) |
| `console.log` en production | **0** dans `apps/api` (Nest `Logger` partout) ; 3 dans `apps/worker` |
| Validation aux frontieres | zod sur toutes les entrees (`ZodValidationPipe`) |
| Erreurs explicites | Problem Details RFC 9457, filtre global |
| Commits conventionnels | tenus depuis la Phase 0 |
| Immutabilite | respectee (aucun mutateur en place releve) |

Ce qui manque n'est donc pas de l'hygiene de base : ce sont **quatre
manques precis**, dont un seul est urgent.

### A. Couverture de tests — **jamais mesuree**

`@vitest/coverage-v8` n'est pas installe et aucune des 10 configurations
vitest ne declare de bloc `coverage`. Le taux reel est **inconnu**.

Le depot compte **782 tests** (api 294, ui 235, contracts 110,
design-tokens 59, web 33, shared-utils 27, config 17, i18n 3, worker 2,
admin 2) et **48 scenarios Playwright**.

Le ratio « source ayant un test voisin » est un mauvais indicateur ici et je
ne veux pas le presenter comme une couverture :

| Package | Sources | Test voisin | Ratio |
|---|---|---|---|
| contracts | 18 | 15 | 83 % |
| shared-utils | 5 | 4 | 80 % |
| ui | 39 | 14 | 36 % |
| config | 4 | 2 | 50 % |
| api | 115 | 16 | **14 %** |
| web | 30 | 2 | 7 % |
| admin | 12 | 0 | 0 % |
| worker | 5 | 0 | 0 % |
| design-tokens | 10 | 0 | 0 % |

Les 14 % de `apps/api` sont trompeurs : l'API est couverte par **11 suites
e2e reelles** qui traversent controleurs, services et base. `design-tokens`
a 0 % de voisins mais **59 tests** dans un fichier unique. Seule une mesure
reelle tranche — d'ou la tache M1.

### B. Rate limiting — les ecritures sont couvertes, pas les lectures

**71 routes** : 46 ecritures, 25 lectures.

- **46 / 46 ecritures** portent un `@RateLimit`. La Decision 63 est tenue
  integralement.
- **24 / 25 lectures** n'en ont aucun. La seule exception est
  `GET /conversations/:id/messages/search`, la plus couteuse.
- **6 lectures sont entierement publiques** (aucun `AuthGuard`) :

| Route | Donnee exposee |
|---|---|
| `GET /providers/:id` | **profil d'une personne** — signale par la phase 7 |
| `GET /companies/:id` | **fiche d'une entreprise** |
| `GET /catalog/tree` | reference, non personnelle |
| `GET /catalog/skills` | reference, non personnelle |
| `GET /catalog/nodes` | reference, non personnelle |
| `GET /health` | sonde |

C'est la que se joue le point signale en phase 7 : une lecture publique,
sans plafond, sur un identifiant devinable, rend les profils **enumerables**.
Les 19 autres lectures sans plafond sont derriere `AuthGuard` — l'abus y
coute un compte, ce qui n'est pas la meme exposition.

### C. `console.log` — presque rien, mais le vrai manque est ailleurs

Trois occurrences, toutes dans `apps/worker/src/main.ts` : un `console.log`
de demarrage (deja accompagne d'un `eslint-disable` motive), un
`console.error` sur job en echec, un `console.warn` a l'arret.

Le manque reel decouvert en cherchant : **`LOG_LEVEL` est declare, valide par
zod, et lu nulle part**. Ni Nest ni le worker ne l'appliquent. Le niveau de
log n'est donc pas configurable, contrairement a ce que la configuration
laisse croire.

### D. Tailles — aucun fichier en depassement, 23 fonctions longues

Aucun fichier au-dessus du plafond de 800 lignes. Plus gros source :
`apps/api/test/matching.e2e.test.ts` (464), plus gros fichier de production :
`apps/web/src/app/requests/new/page.tsx` (450).

23 fonctions depassent 50 lignes. La majorite sont des **composants React**
dont la longueur est du JSX, pas de la complexite — les compter comme des
« fonctions longues » serait appliquer la regle a la lettre contre son
intention. Les cas qui meritent vraiment d'etre repris :

| Lignes | Emplacement | Nature |
|---|---|---|
| **379** | `NewRequestForm` (`requests/new/page.tsx`) | vraie complexite : 11 etats, cascade catalogue, geolocalisation, upload, soumission |
| 142 / 133 | `enabledIndexes` / `Menu` (`packages/ui`) | logique clavier reelle |
| 101 / 63 | `useChatThread` / `useRealtime` | logique temps reel reelle |
| 144 | `MessageItem` | majoritairement JSX |
| 83 | `catalog.seed.ts` | script lineaire, risque faible |

### E. Recherche prealable — regle non documentee dans le depot

La Decision 68 l'avait classee « non adoptee ». Rien dans `docs/prompt/`
n'en parle. Si elle est adoptee maintenant, il faut l'ecrire quelque part
ou elle sera lue avant chaque phase, sinon elle ne sera pas appliquee.

### F. `STORAGE_PROVIDER` — et 14 autres

`STORAGE_PROVIDER` n'est pas un cas isole. **15 des 39 cles d'environnement
sont declarees, validees, et jamais lues** :

| Classe | Cles | Pourquoi ca compte |
|---|---|---|
| **Interrupteurs trompeurs** | `STORAGE_PROVIDER`, `OTEL_ENABLED`, `LOG_LEVEL` | Elles ont l'air de commander un comportement. `STORAGE_PROVIDER=fake` ne desactive rien — c'est exactement ce qui a masque l'absence de MinIO dans la CI le 2026-09-22 |
| **Identifiants fantomes** | `SMS_PROVIDER_KEY`, `SMS_PROVIDER_SENDER`, `EMAIL_PROVIDER_KEY`, `EMAIL_PROVIDER_FROM`, `MAP_PROVIDER_KEY`, `AI_PROVIDER_KEY`, `PAYMENT_PROVIDER_KEY` | Un deployeur qui les renseigne croit avoir configure un fournisseur reel. Il n'en est rien |
| **En avance de phase** | `AI_PROVIDER`, `AI_MODEL_DEFAULT`, `PAYMENT_PROVIDER`, `FF_MOBILE_ENABLED`, `DATABASE_TEST_URL` | Legitimes : leur phase n'est pas arrivee |

Les deux premieres classes sont un probleme ; la troisieme n'en est pas un.

### G. Autres regles ECC

**Deja tenues** : immutabilite, KISS/DRY/YAGNI, organisation par domaine,
nommage, gestion d'erreurs, validation, secrets, commits, TDD (applique en
phase 7 : contrats rouges avant implementation).

**Ecarts restants** :

1. Couverture minimale de 80 % — non mesuree (A).
2. Rate limit sur les lectures — la regle ECC `security.md` dit « Rate
   limiting on all endpoints » (B).
3. Recherche prealable GitHub / Context7 / Exa (E).
4. Pagination : **29 requetes `.find()`** sans `limit` ni `skip` dans les
   services. Deja signale dans `PROGRESS.md` pour `GET /requests/mine` et
   `GET /conversations`.

**Conflits confirmes, Fixiyi prime** (deja tranches par la Decision 68, je ne
les rouvre pas) :

- enveloppe `{success, data, error}` de `patterns.md` **contre** Problem
  Details RFC 9457 (02 #62) ;
- cinq documents de planification **contre** un seul `PHASE_X_PLAN.md` ;
- delegation proactive a des agents **contre** le cycle de `08` et la
  consigne de session (« ne pas utiliser l'outil Agent sans demande »).

**Trouve pendant l'audit, hors des sept rubriques** :

- `08_ECC_INTEGRATION.md` donne comme rollback `git reset --hard d825a8a`
  (fin de la phase 6 de la refonte). La **Decision 69** impose de le mettre a
  jour a la fin de chaque phase ; la phase 7 s'est terminee a `d7d1aca` et je
  ne l'ai pas fait. **L'executer aujourd'hui effacerait toute la phase 7.**

---

## 2. Ecarts par priorite

### HIGH — securite et instructions dangereuses

| # | Ecart | Pourquoi HIGH |
|---|---|---|
| **H1** | `GET /providers/:id` et `GET /companies/:id` : lectures publiques, sans plafond, sur identifiant devinable | Enumeration de donnees personnelles. C'est le point que la phase 7 a signale sans le decider |
| **H2** | Reference de rollback perimee dans `08_ECC_INTEGRATION.md` | Une commande destructive documentee qui detruirait la phase 7 si elle etait suivie |
| **H3** | Identifiants fantomes (`*_PROVIDER_KEY`, `*_SENDER`, `*_FROM`) et interrupteurs trompeurs (`STORAGE_PROVIDER`, `OTEL_ENABLED`) | Fausse impression de configuration : la panne CI du 2026-09-22 en est la demonstration |

### MEDIUM — qualite verifiable

| # | Ecart |
|---|---|
| **M1** | Couverture jamais mesuree : outillage absent, aucun seuil |
| **M2** | `LOG_LEVEL` inapplique ; 3 `console.*` dans le worker |
| **M3** | 29 requetes de liste non bornees (pagination) |
| **M4** | `NewRequestForm` : 379 lignes dans une seule fonction |
| **M5** | Rate limit sur les 19 lectures authentifiees restantes |

### LOW — confort

| # | Ecart |
|---|---|
| **L1** | Regle de recherche prealable non documentee |
| **L2** | Fonctions React > 50 lignes ou la logique, et non le JSX, domine (`Menu`, `useChatThread`) |
| **L3** | Les e2e creent des noeuds de catalogue et des fournisseurs sans les nettoyer — ils apparaissent dans la grille d'accueil en developpement |

---

## 3. Plan de correction

### Bloc HIGH

**H1 — plafonner les lectures publiques.**
Etendre la Decision 63 aux lectures **publiques** : un `@RateLimit` par IP
sur les 6 routes sans `AuthGuard`, avec deux budgets distincts — serre pour
les donnees personnelles (`providers/:id`, `companies/:id`), large pour la
reference (`catalog/*`), aucun pour `/health` (une sonde qui se fait
limiter est une sonde cassee).
Ecrire la **Decision 72**. TDD : un test e2e par classe de budget, qui
depasse le plafond et attend un 429.
*Prealable* : `trustProxy` est deja signale comme a traiter avant la
production — derriere un reverse proxy, un plafond par IP compte l'IP du
proxy. Le plafond est utile des maintenant mais **ne sera correct en
production qu'une fois `trustProxy` regle** ; a dire dans la decision.

**H2 — mettre a jour la reference de rollback.**
`d825a8a` -> `d7d1aca`, et ajouter une ligne de procedure pour que ce soit
fait a chaque fin de phase, comme la Decision 69 l'exige.

**H3 — assainir la configuration.**
Pour chaque cle jamais lue, un choix explicite, consigne dans une
**Decision 73** :
- retirer du schema : `STORAGE_PROVIDER` (le client S3 est construit dans
  tous les cas), `OTEL_ENABLED` (aucune instrumentation), et les `*_KEY` /
  `*_SENDER` / `*_FROM` dont le fournisseur reel n'existe pas encore ;
- garder, mais **commentees comme reservees a leur phase** :
  `AI_PROVIDER`, `AI_MODEL_DEFAULT`, `PAYMENT_PROVIDER`,
  `FF_MOBILE_ENABLED`, `DATABASE_TEST_URL` ;
- `LOG_LEVEL` : gardee et **implementee** (voir M2).
Un test verrouille la regle : toute cle du schema est soit lue dans le code,
soit marquee reservee — c'est ce test, pas la vigilance, qui empechera la
prochaine `STORAGE_PROVIDER`.

### Bloc MEDIUM

**M1 — mesurer la couverture.**
`@vitest/coverage-v8` en devDependency de racine, bloc `coverage` (provider
v8, reporters `text` + `json-summary` + `lcov`) dans les 10 configurations,
exclusions explicites (`dist`, `.next`, `*.config.*`, fichiers generes).
Mesurer, publier le chiffre reel par package, **puis** decider des seuils :
poser 80 % partout avant de connaitre le point de depart ferait echouer la
CI sans rien apprendre. Ordre : mesurer -> seuils au niveau actuel -> combler
-> remonter les seuils.

**M2 — rendre le journal configurable.**
`LOG_LEVEL` applique au logger Nest (`app.useLogger`) et au worker. Le
worker recoit un petit journal structure partage (memes niveaux, meme
format) et ses 3 `console.*` disparaissent.

**M3 — borner les listes.**
Pagination sur `GET /requests/mine`, `GET /conversations`,
`GET /conversations/:id/messages` et les autres listes non bornees.
**Changement de contrat** (enveloppe paginee) — donc soumis a validation,
et probablement a faire par lot plutot qu'en une fois.

**M4 — decouper `NewRequestForm`.**
Extraire la cascade catalogue, le bloc media et le bloc position en trois
composants, en conservant le comportement et les `data-testid` existants
(48 scenarios Playwright en dependent).

**M5 — plafonner les lectures authentifiees.**
Un budget large par utilisateur, en une passe, une fois H1 en place.

### Bloc LOW

**L1** — ecrire la regle de recherche prealable dans `docs/prompt/` (un
paragraphe dans `03_AGENT_PROTOCOL.md`), pour qu'elle soit lue avant chaque
phase.
**L2** — extraire la logique clavier de `Menu` et les effets de
`useChatThread`.
**L3** — nettoyage des donnees creees par les e2e, ou prefixe dedie exclu
de l'affichage en developpement.

---

## 4. Estimation d'effort

| Bloc | Taches | Effort | Gates a repasser |
|---|---|---|---|
| HIGH | H1, H2, H3 | **1 seance** | lint/typecheck/test/build + Playwright |
| MEDIUM | M1, M2 | **1 seance** | idem + premiere mesure de couverture |
| MEDIUM | M3, M4, M5 | **1 a 2 seances** | idem, M3 touche un contrat |
| LOW | L1, L2, L3 | **0,5 seance** | idem |

H2 seul prend cinq minutes et supprime un risque destructif : a faire en
premier, quoi qu'il arrive du reste.

---

## 5. Risques

- **H1 sans `trustProxy`** : derriere un proxy, un plafond par IP agrege
  tous les clients et peut bloquer des utilisateurs legitimes. En
  developpement et en CI le risque est nul (acces direct) ; en production il
  est reel. La decision doit lier explicitement les deux.
- **M1, seuils trop hauts d'emblee** : poser 80 % sans connaitre le point de
  depart casse la CI et pousse a ecrire des tests pour le chiffre. Mesurer
  d'abord, verrouiller le niveau actuel, remonter ensuite.
- **M3 change un contrat** : la pagination modifie la forme des reponses et
  touche `apps/web`. Validation utilisateur requise
  (`05_DECISION_POLICY.md`), et a etaler.
- **M4 est un refactoring a comportement constant** : 48 scenarios
  Playwright et 33 tests web s'appuient sur les `data-testid` actuels. Ils
  sont le filet ; aucun ne doit etre modifie pendant l'extraction.
- **H3, retirer une cle du schema** : si un deploiement la fournit encore,
  zod la rejettera-t-il ? Le schema ignore les cles inconnues par defaut —
  a verifier avant, sinon un retrait casse un demarrage.
- **Risque de perimetre** : ce chantier ne livre aucune fonctionnalite. Il
  ne doit pas devenir un pretexte a refondre ce qui marche. Les blocs sont
  volontairement fermes.

---

## 6. Ce que je ne propose pas, et pourquoi

- **Rouvrir les conflits tranches par la Decision 68** (enveloppe de
  reponse, documents de planification, delegation a des agents) : ils ont
  ete decides, Fixiyi prime, ils restent fermes.
- **Un seuil de couverture de 80 % impose avant mesure** : voir M1.
- **Un rate limit sur `/health`** : une sonde plafonnee est une sonde qui
  ment sur l'etat du service.
- **Transformer les 23 fonctions > 50 lignes** : la regle vise la
  complexite, pas la longueur du JSX. Seules celles ou la logique domine
  sont retenues (M4, L2).
