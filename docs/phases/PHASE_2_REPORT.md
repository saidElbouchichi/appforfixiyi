# PHASE 2 - AUTH

## Statut

**TERMINEE** — tous les objectifs du perimetre sont construits, testes
(79 tests automatises dont 21 e2e reels + verification manuelle complete
des 13 endpoints via curl contre la stack Docker reelle), et
fonctionnels. Verification exhaustive documentee dans
`docs/VERIFICATION_PHASE_1_2.md`.

## Date debut / fin

Debut : 2026-09-20 (immediatement apres reception de "GO PHASE 2")
Fin : 2026-09-20 (meme session)

## Objectifs (statut par objectif)

- ✅ Phone OTP (dev provider `SmsProvider`, jamais de vrai SMS) :
  `POST /auth/otp/request`, `POST /auth/otp/verify`
- ✅ Email (support + verification, pas une methode de login autonome) :
  `POST /auth/email`, `POST /auth/email/verify`
- ✅ Sessions : creation, devices, logout, logout-all, rotation des
  refresh tokens avec detection de reutilisation (revocation immediate)
- ✅ Web : cookies `HttpOnly`/`Secure`(prod)/`SameSite=Lax` + CSRF
  double-submit ; mobile : tokens aussi retournes en JSON (prepare, non
  implemente — Phase 13)
- ✅ Rate limiting OTP/login : par IP (guard generique) et par
  telephone/email (integre a `OtpService`), anti brute-force/anti OTP
  bombing
- ✅ RBAC : roles (`CLIENT, PROVIDER, COMPANY_MEMBER, SUPPORT,
  VERIFICATION_AGENT, MODERATOR, DISPUTE_AGENT, FINANCE_AGENT, MANAGER,
  ADMIN, SUPER_ADMIN`), `AuthGuard`/`RolesGuard` reellement appliques
- ✅ Base ABAC : `ResourceOwnerGuard`/`isResourceOwner()` ecrits et
  testes, prepares pour la Phase 4+ (voir Decision 20)
- ✅ Data model : `User`, `UserSession`, `Device` (Mongoose), `UserRole`
  (enum partage `@fixiyi/contracts`)
- ✅ Regle age (18+ configurable via `MIN_PROVIDER_AGE`) : appliquee
  reellement sur `POST /auth/roles/provider`, le seul point reel
  d'attribution de role en Phase 2
- ✅ TTL MongoDB natif sur `user_sessions`/`devices` (pas de cron de
  nettoyage)

**Criteres de sortie** (docs/IMPLEMENTATION_PLAN.md) : parcours OTP dev
complet teste (unit + integration) ✅ ; aucune route protegee accessible
sans session valide ✅ (verifie automatiquement et manuellement) ; build
gates verts ✅.

## Ce qui a ete fait

### 1. Fondations partagees

- `packages/config` : `OTP_SECRET` (obligatoire, >=16 caracteres),
  `MIN_PROVIDER_AGE` (defaut 18, configurable).
- `packages/shared-utils` : `calculateAgeYears` ajoute a `time.ts`.
- `packages/contracts` : `PhoneE164Schema` (common.ts), `user.ts`
  (`UserRoleSchema`, `UserStatusSchema`, `UserSchema`), `auth.ts` (DTOs
  OTP/refresh/session/email — `OtpRequestInputSchema`,
  `OtpVerifyInputSchema`, `RefreshInputSchema`, `AuthTokensSchema`,
  `AuthSessionResultSchema`, `SessionSchema`, `EmailAttachInputSchema`,
  `EmailVerifyInputSchema`, `UpdateMeInputSchema`).

### 2. `apps/api/src/auth/` — module complet (36 fichiers)

- **Persistance (Mongoose)** : `UserEntity`, `UserSessionEntity`,
  `DeviceEntity` — `_id` en UUIDv7 (coherent avec le reste du projet, pas
  d'`ObjectId`), TTL index natif sur `expiresAt`/`lastSeenAt`.
- **`TokenService`** : JWT access + refresh (HS256). Le refresh ne
  stocke aucun hash — juste un `tokenVersion` entier compare au claim
  `rtv` du token, incremente a chaque rotation (voir Decision 16).
- **`OtpService`** : primitive generique "emettre un code, le verifier
  une fois" partagee par l'OTP telephone et la verification email ;
  cooldown 60s + plafond horaire par sujet (`RateLimitService`) +
  verrouillage apres N tentatives.
- **`SessionService`** : creation/rotation/revocation de session +
  upsert de `Device`. Detecte la reutilisation d'un refresh token perime
  et revoque la session sur-le-champ.
- **`SmsModule`/`EmailModule`** : providers `dev`/`fake` uniquement
  (jamais de vrai envoi) ; toute autre valeur de
  `SMS_PROVIDER`/`EMAIL_PROVIDER` fait echouer le boot (pas de faux
  fallback silencieux).
- **`RateLimitService`/`RateLimitGuard`** : compteur Redis a fenetre
  fixe, reutilise a la fois pour le rate limiting IP (guard) et le
  plafond horaire par sujet (`OtpService`).
- **`CsrfService`/`CsrfGuard`** : double-submit cookie maison (pas de
  secret serveur necessaire), applique uniquement quand
  l'authentification vient d'un cookie (jamais pour un client
  `Authorization: Bearer`).
- **Cookies** : `common/http/cookie.util.ts` (parse/serialize maison, pas
  de `@fastify/cookie`).
- **Guards RBAC/ABAC** : `AuthGuard` (verifie le JWT **et** le statut
  reel de la session en base a chaque requete — le remote logout est
  donc immediat, pas seulement a l'expiration du token), `RolesGuard`
  (`@Roles(...)`), `ResourceOwnerGuard` (`@OwnedBy(...)`, prepare, non
  branche).
- **`AuthService`/`AuthController`** : orchestration complete, 12 routes
  sous `/api/v1/auth` (liste complete dans
  `docs/VERIFICATION_PHASE_1_2.md`).

### 3. Verification exhaustive (demandee explicitement avant validation)

Voir `docs/VERIFICATION_PHASE_1_2.md` pour le detail complet : re-execution
de tous les gates Phase 1, 13 endpoints verifies un par un via curl contre
la stack Docker reelle (pas seulement les tests automatises), inspection
reelle des index MongoDB et des cles Redis, analyse des logs des
conteneurs, 7 bugs trouves et corriges avec re-test a chaque fois.

## Fichiers crees / modifies

Liste complete et exhaustive dans `docs/VERIFICATION_PHASE_1_2.md`
(section "Phase 2 — Fichiers crees"). Resume : 36 fichiers dans
`apps/api/src/auth/`, 2 dans `apps/api/src/common/http/`, 1 nouveau test
e2e (`apps/api/test/auth.e2e.test.ts`, 21 tests), 4 fichiers dans
`packages/contracts/src/` (2 nouveaux + 2 modifies), modifications
ciblees dans `packages/config`, `packages/shared-utils`,
`apps/api/{package.json,app.module.ts,test/health.e2e.test.ts}`,
`.env.example`, `.env.test.example`, `README.md`, `docs/DECISIONS.md`.

## Tests

| Niveau | Ou | Resultat |
|---|---|---|
| Unit | `packages/contracts` (auth.ts/user.ts) | 11 nouveaux tests OK |
| Unit | `packages/config`/`shared-utils` (OTP_SECRET, MIN_PROVIDER_AGE, calculateAgeYears) | tests etendus, tous OK |
| Unit | `apps/api/src/auth/**` (10 fichiers) | 45 tests OK (token, otp, csrf x2, rate-limit x2, roles guard, resource-owner guard, verification-code) |
| Unit | `apps/api/src/common/http/cookie.util` | 7 tests OK |
| **Integration reelle** (Mongo+Redis+HTTP Docker) | `apps/api/test/auth.e2e.test.ts` | **21 tests OK** — parcours OTP complet, refresh/rotation/reuse-detection, logout/logout-all, sessions/devices, regle d'age, email, cookies+CSRF, rate limiting reel (429) |
| **Verification manuelle curl** (Docker reel, port 4000) | 13/13 endpoints + 7 endpoints complementaires | Tous conformes — detail complet dans `docs/VERIFICATION_PHASE_1_2.md` |
| **Verification MongoDB/Redis reelle** | index (`getIndexes()`), cles (`KEYS`) | Tous conformes apres correction des 2 bugs d'index |

**Total automatise (monorepo) : 140 tests, tous passent** (`pnpm test` —
59 packages + 2 worker + 79 api). `pnpm lint && pnpm typecheck && pnpm
test && pnpm build` -> tous verts, 0 erreur, 0 warning.

## Commandes lancees et resultats (extraits — details complets dans
`docs/VERIFICATION_PHASE_1_2.md`)

```
$ pnpm --filter @fixiyi/api test
 Test Files  15 passed (15)
      Tests  79 passed (79)

$ curl.exe -X POST http://localhost:4000/api/v1/auth/otp/verify \
  -d '{"phone":"+212611111111","code":"080149"}'
{"accessToken":"...","refreshToken":"...","expiresIn":900,"user":{...}}
HTTP_STATUS:201

$ docker exec fixiyi-mongodb mongosh fixiyi --eval "db.users.getIndexes()"
[..., { key: { email: 1 }, unique: true, partialFilterExpression: { email: { '$type': 'string' } } }]

$ pnpm lint && pnpm typecheck && pnpm test && pnpm build
Tasks: 13/13, 13/13, 11/11, 9/9 successful
```

## Decisions prises

Voir `docs/DECISIONS.md`, Decisions 16 a 25 :

16. Sessions : refresh token = JWT + `tokenVersion` Mongo (pas de hash
    stocke).
17. Rate limiting : IP via guard generique, telephone/email via
    `OtpService`.
18. Cookies + CSRF ecrits a la main (pas de `@fastify/cookie`, pas de
    librairie CSRF).
19. Nouvelles dependances `apps/api` : `jsonwebtoken`, `libphonenumber-js`.
20. `RolesGuard`/`ResourceOwnerGuard` prets et testes, non branches sur
    une route en Phase 2 (aucune ressource/route admin-only n'existe
    encore).
21. Regle d'age appliquee uniquement au seul point reel d'attribution de
    role (`POST /auth/roles/provider`).
22. `verification-code.ts` vit dans `apps/api` (Node-only + consommateur
    unique), pas dans `@fixiyi/shared-utils`.
23. `OTP_MAX_REQUESTS_PER_IP_PER_HOUR` remonte de 20 a 60 (NAT/wifi
    partage).
24. TTL index MongoDB sur `user_sessions.expiresAt`.
25. TTL index MongoDB sur `devices.lastSeenAt` (90 jours) ; pas de TTL
    sur `User`.

## Problemes rencontres

**7 bugs reels trouves et corriges**, chacun avec symptome / cause
racine / correction / re-test documentes en detail dans
`docs/VERIFICATION_PHASE_1_2.md` (section "Analyse des erreurs") :

1. Index MongoDB `email` sparse + `default: null` ne bloquait pas les
   doublons (`E11000` au 2e utilisateur) — corrige par un index partiel.
2. `@UsePipes()` au niveau methode validait aussi `@CurrentUser()`
   (cassait `PATCH /me`, `POST /email`, `POST /email/verify`) — corrige
   en scopant chaque pipe sur `@Body()`.
3. `ProblemDetailsFilter` absent du bootstrap des tests e2e (bug latent
   depuis la Phase 1, invisible jusqu'ici) — corrige dans les deux
   fichiers de test.
4. Conteneur Docker `fixiyi-api` executant l'image d'avant la Phase 2
   (signale par l'utilisateur en verifiant Swagger) — corrige par
   rebuild + redemarrage.
5. `OTP_MAX_REQUESTS_PER_IP_PER_HOUR` (20) trop bas pour un trafic
   legitime derriere une IP partagee — remonte a 60.
6. `OTP_MAX_REQUESTS_PER_PHONE_PER_HOUR` declare mais jamais branche —
   corrige par l'integration reelle de `RateLimitService` dans
   `OtpService`.
7. Index TTL `user_sessions.expiresAt` non applique (un index simple du
   meme nom existait deja depuis un build precedent) — corrige par
   `dropIndex` + redemarrage pour recreation.

Tous corriges et re-testes ; le detail complet (symptome exact, cause
racine, correction, re-test) est dans `docs/VERIFICATION_PHASE_1_2.md`.

## Limitations / TODO documentes

- `ResourceOwnerGuard`/`RolesGuard` : prepares, non branches sur une
  route reelle (aucune ressource possedee/route admin-only avant Phase
  4+/12) — meme statut que `ZodValidationPipe` en Phase 1 (Decision 6).
- `dateOfBirth` : non verifie contre un document d'identite, pas
  immuable (verification reelle = Phase 3+, agent de verification).
- Google/Apple OAuth : non implemente, seulement prepare par la
  structure generique.
- Mobile (stockage securise reel des tokens) : Phase 13.
- `docs/CURRENT_STATE.md` : toujours date de la Phase 0 (limitation
  preexistante, non introduite par cette phase).
- `.github/workflows/ci.yml` : toujours pas exerce par une execution
  GitHub Actions reelle (aucun push vers un remote depuis le debut du
  projet).

## Prerequis pour la phase suivante

Tous remplis pour demarrer la Phase 3 :

- Authentification et RBAC operationnels et verifies de bout en bout
  (automatise + manuel + infra reelle).
- `User`/`UserSession`/`Device` disponibles comme aggregats de reference
  pour les futurs modules (`ProviderProfile` en Phase 3 pourra
  reference `User.id`).
- `AuthGuard`/`RolesGuard`/`ResourceOwnerGuard`/`CurrentUser()` prets a
  etre reutilises par les controllers des phases suivantes.
- Verification complete documentee dans `docs/VERIFICATION_PHASE_1_2.md`
  — aucune dette technique cachee.

## Prochaine phase

**Phase 2 - Auth TERMINEE.** Conformement a `06_SCOPE.md` (regle
d'arret absolue : jamais de phase suivante sans validation humaine
explicite), **STOP et attente de "GO PHASE 3"**.
