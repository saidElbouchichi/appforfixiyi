# INSPECTION ECC — FIXIYI PHASES 0-5

Date : 2026-09-21
Commit de depart : 6f2196c (fin Phase 5 + captures Playwright)

## Methode

Chaque phase a ete inspectee apres la **lecture obligatoire** definie dans
`docs/prompt/08_ECC_INTEGRATION.md` (06_SCOPE, 03_AGENT_PROTOCOL,
05_DECISION_POLICY, PROGRESS, DECISIONS, rapport de la phase precedente,
plan de la phase). L'inspection ne se contente pas de relire les rapports :
elle **re-execute** les commandes et **interroge les bases reelles**
(MongoDB, Redis, MinIO via la stack Docker) pour confronter les
affirmations des rapports aux donnees.

### Note sur les agents ECC

Le prompt de mission cite `/ecc:review`, `/ecc:security`, `/ecc:tdd` et
`/ecc:frontend`. **Ces noms n'existent pas** dans ECC v2.2.2 installe ici.
La surface reelle est :

| Nom cite dans la mission | Nom reel ECC v2.2.2 |
|---|---|
| `/ecc:review` | `/ecc:code-review`, agents `ecc:code-reviewer`, `ecc:typescript-reviewer` |
| `/ecc:security` | `/ecc:security-review`, `/ecc:security-scan`, agent `ecc:security-reviewer` |
| `/ecc:tdd` | `/ecc:tdd-workflow`, agent `ecc:tdd-guide` |
| `/ecc:frontend` | `/ecc:react-review`, agent `ecc:react-reviewer` |

Les noms reels ont ete utilises. `08_ECC_INTEGRATION.md` conserve la liste
telle que dictee par l'utilisateur (contenu impose mot pour mot) ; cette
table est la correspondance operationnelle.

---

## Phase 0 — Audit — **OK**

### Lecture effectuee
`docs/phases/PHASE_0_REPORT.md`, `docs/CURRENT_STATE.md`,
`docs/IMPLEMENTATION_PLAN.md`.

### Verifications

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| `docs/phases/PHASE_0_REPORT.md` existe | oui | oui, 5876 octets | OK |
| Rapport complet au format 03_AGENT_PROTOCOL §4 | 13 sections | 13 sections `##` presentes (Statut, Dates, Objectifs, Ce qui a ete fait, Fichiers crees, Fichiers modifies, Tests, Commandes, Decisions, Problemes, Limitations, Prerequis, Prochaine phase) | OK |
| `docs/CURRENT_STATE.md` decrit l'etat initial | oui | oui : workspace meta-initialise sans code, environnement detecte (Node 22.20.0, pnpm 12.4.2, Docker 28.4.0), 3 services dev verifies, inventaire KEEP/REFACTOR/REPLACE/REMOVE complet | OK |
| `docs/IMPLEMENTATION_PLAN.md` liste les phases a venir | Phases 1-8 | Phases 1 a 8 presentes, chacune avec objectifs/livrables/criteres de sortie, plus « Principes transverses » et « Apres le MVP » | OK |

### Observations

- Le rapport Phase 0 documente une verification **active** des services
  (ping Mongo, ping Redis, healthcheck MinIO) et pas seulement une
  declaration — coherent avec l'interdiction de « mock presente comme
  reel » (03_AGENT_PROTOCOL §2).
- Aucune contradiction entre `CURRENT_STATE.md` et l'etat git de l'epoque
  (1 commit `64eb81e`, 17 fichiers meta).

**Verdict Phase 0 : OK — aucun ecart.**

---

## Phase 1 — Foundation — **OK**

### Lecture effectuee
`docs/phases/PHASE_0_REPORT.md`, `docs/phases/PHASE_1_PLAN.md`,
`docs/phases/PHASE_1_REPORT.md`, `docs/PROGRESS.md`,
`docs/DECISIONS.md` (Decisions 1 a 15).

### Verifications structurelles

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| Monorepo pnpm + Turborepo | oui | `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `tests/*`) + `turbo.json` (build/lint/typecheck/test/dev/clean, `dependsOn: ^build`) | OK |
| 8 packages | tsconfig, eslint-config, shared-utils, contracts, config, design-tokens, i18n, ui | les 8 presents, tous sous le scope `@fixiyi/*` | OK |
| 4 apps | api, worker, web, admin | `@fixiyi/api`, `@fixiyi/worker`, `@fixiyi/web`, `@fixiyi/admin` | OK |
| Docker 7 services | 7 | 3 infra (`mongodb`, `redis`, `minio` dans `docker-compose.yml`) + 4 applicatifs (`api`, `worker`, `web`, `admin` dans `docker-compose.dev.yml`) = **7** | OK |
| CI GitHub Actions | oui | `.github/workflows/ci.yml` : install -> lint -> typecheck -> test -> build, avec services `mongo:7` et `redis:7-alpine` | OK |

### Tests re-executes (pas repris du rapport)

```
pnpm --filter @fixiyi/shared-utils test ->  4 fichiers,  27 tests, 27 passed
pnpm --filter @fixiyi/contracts   test -> 14 fichiers,  69 tests, 69 passed
pnpm --filter @fixiyi/ui          test ->  9 fichiers,  52 tests, 52 passed
```

Total des trois : **148 tests verts**. Avec `config` (11), `i18n` (3) et
`design-tokens` (3), la couche packages compte **165 tests**, tres au-dessus
du critere « 48+ » du plan de Phase 1.

### Observations

- **[MEDIUM] MinIO absent du CI.** `.github/workflows/ci.yml` declare
  `mongodb` et `redis` en `services:` mais **pas MinIO**, alors que le
  pipeline media (Phase 3/4) parle a un S3 reel. Tout test d'integration
  media qui s'appuie sur MinIO ne peut donc pas s'executer de la meme
  facon en CI qu'en local. A trancher en Phase 6 : soit ajouter le service
  MinIO au workflow, soit documenter explicitement que ces tests sont
  locaux uniquement. Ce n'est pas une regression de la Phase 1 — c'est une
  dette introduite quand le pipeline media est arrive en Phase 3.
- `turbo.json` fait dependre `lint`, `typecheck` et `test` de `^build` :
  les packages sont donc toujours construits avant d'etre consommes, ce
  qui evite la classe de faux verts ou un test passe contre un `dist/`
  perime.

**Verdict Phase 1 : OK — 1 observation MEDIUM (MinIO/CI), aucune regression.**

---

## Phase 2 — Auth — **OK**

### Lecture effectuee
`docs/phases/PHASE_1_REPORT.md`, `docs/phases/PHASE_2_PLAN.md`,
`docs/phases/PHASE_2_REPORT.md`, `docs/VERIFICATION_PHASE_1_2.md`,
`docs/DECISIONS.md` (Decisions 16 a 25).

### Verifications structurelles

| Point | Attendu | Constate | Verdict |
|---|---|---|---|
| Module auth | 38 fichiers | **38 fichiers exactement** dans `apps/api/src/auth/` | OK |
| OTP phone + email | oui | `otp/otp.service.ts`, `sms/` (interface + provider dev), `email/` (interface + provider dev), `verification-code.ts` | OK |
| Sessions + refresh rotation | oui | `session/session.service.ts`, `token/token.service.ts`, `schemas/user-session.schema.ts`, route `POST /api/v1/auth/refresh` | OK |
| Devices | oui | `schemas/device.schema.ts` | OK |
| RBAC | oui | `guards/roles.guard.ts` + `roles.decorator.ts` (+ `resource-owner.guard.ts`) | OK |
| CSRF | oui | `csrf/csrf.guard.ts` + `csrf/csrf.service.ts` | OK |
| Rate limiting | oui | `rate-limit/` (guard + service + decorateur), applique jusque sur `POST /auth/refresh` (60/h) | OK |

### Tests re-executes

```
pnpm --filter @fixiyi/api test -> 23 fichiers, 153 tests, 153 passed (191.95 s)
```

> Precision d'exactitude : les 153 tests sont le total de `apps/api`
> (auth + catalog + providers + companies + verification + media +
> requests + matching + geo + configuration + common), **pas** 153 tests
> d'auth seuls. Le critere « Tests api auth : 153+ » du prompt de mission
> confond le total applicatif avec le sous-total auth. Le chiffre est
> atteint, mais il ne veut pas dire ce que le libelle suggere.

Note : la sortie du run contient un `Error: connection string contains a
password` **attendu** — c'est le test de `problem-details.filter` qui
verifie justement que ce type de message est capte et assaini ; le test
passe.

### Verification MongoDB reelle (base `fixiyi`)

```
users:         25 documents
user_sessions: 32 documents
devices:       32 documents
```

Index `user_sessions` :

```
{"key":{"_id":1}}
{"key":{"userId":1}}
{"key":{"expiresAt":1},"expireAfterSeconds":0}   <- TTL confirme
```

Le TTL sur `expiresAt` existe bien et est un **vrai index TTL**
(`expireAfterSeconds: 0`, donc expiration a la date portee par le
document) — conforme a la Decision 24.

Bonus verifie au passage, index `devices` :

```
{"key":{"lastSeenAt":1},"expireAfterSeconds":7776000}   <- 90 jours
```

7 776 000 s = exactement 90 jours — conforme a la Decision 25.

### Observations

- `AuthGuard` (apps/api/src/auth/guards/auth.guard.ts) **re-verifie la
  session en base a chaque appel** en plus de verifier la signature JWT.
  C'est ce qui rend le logout distant reellement effectif au lieu de
  laisser un token revoque vivre jusqu'a son expiration naturelle. Le
  cout (1 lecture Mongo par requete authentifiee) est assume et
  documente.
- Le guard distingue deux messages d'erreur differents — `"Invalid or
  expired access token"` (echec de verification JWT) et `"Session has been
  revoked or expired"` (session absente/revoquee en base). Cette
  distinction est **la cle du diagnostic du bug frontend** (voir Phase 5).

**Verdict Phase 2 : OK — aucun ecart structurel, TTL confirmes par la base.**
