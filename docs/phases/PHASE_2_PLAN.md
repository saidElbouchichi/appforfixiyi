# PHASE 2 - AUTH - PLAN

## Objectif

Authentification et RBAC operationnels (01_SPEC_PRODUCT.md #66-72,
02_SPEC_ENGINEERING.md #104/#118/#151-152), sans aucune route protegee
accessible sans session valide.

## Perimetre retenu

### Authentification

- Phone OTP (principal) : `POST /auth/otp/request`, `POST /auth/otp/verify`.
  Provider SMS abstrait (`SmsProvider`), implementation `dev` par defaut
  (n'envoie jamais de vrai SMS, ne logge jamais le code — le code n'est
  expose que dans la reponse JSON, et uniquement quand `NODE_ENV !==
  "production"` et `SMS_PROVIDER === "dev"`).
- Email (support, pas une methode de login autonome — pas de mot de passe
  dans ce MVP) : `POST /auth/email` (attache + envoie un code de
  verification), `POST /auth/email/verify`. Meme pattern que l'OTP
  telephone, `EmailProvider` abstrait avec implementation `dev`.
- Sessions : creation a la verification OTP, refresh token rotation,
  logout (session courante), logout-all (toutes les sessions de
  l'utilisateur), liste des sessions/appareils, revocation d'une session
  precise.
- Web : access token + refresh token + token CSRF en cookies
  `HttpOnly`/`Secure` (prod)/`SameSite=Lax`. Cookie CSRF non-HttpOnly
  (lu par le client, renvoye en header `x-csrf-token` sur les endpoints
  mutants — pattern double-submit, sans dependance supplementaire).
  Mobile : tokens aussi retournes dans le corps JSON (accede a un
  stockage securise en Phase 13 — non implemente ici).
- Rate limiting (Redis) : par telephone/email/IP sur OTP request/verify et
  email verify, anti brute-force/anti OTP bombing.

### RBAC / ABAC

- Roles (01_SPEC_PRODUCT.md #66) : `CLIENT, PROVIDER, COMPANY_MEMBER,
  SUPPORT, VERIFICATION_AGENT, MODERATOR, DISPUTE_AGENT, FINANCE_AGENT,
  MANAGER, ADMIN, SUPER_ADMIN`. Un nouvel utilisateur recoit `[CLIENT]` a
  la premiere verification OTP.
- `AuthGuard` (session valide via access token, cookie ou header
  `Authorization: Bearer`) + `RolesGuard`/`@Roles()` (verifie
  reellement, applique a toutes les routes authentifiees existantes).
- Base ABAC (#67) : primitive `isResourceOwner()`
  (`packages/shared-utils`) + `ResourceOwnerGuard` NestJS generique,
  ecrits et testes mais **non branches sur une route** — aucune ressource
  possedee (Request/Offer/Intervention) n'existe encore avant la Phase 4+.
  Meme statut documente que `ZodValidationPipe` en Decision 6 : piece
  prete, pas encore exercee par une fonctionnalite reelle (pas une
  fausse verification).
- Regle age (#71, configurable via `MIN_PROVIDER_AGE`) : appliquee
  reellement sur le seul point ou un role est reellement accorde en
  Phase 2 — `POST /auth/roles/provider` (self-service, exige
  `dateOfBirth` deja renseigne via `PATCH /auth/me` et `phoneVerifiedAt`
  non nul).

### Data model (02_SPEC_ENGINEERING.md #98)

`User` (id, phone, phoneVerifiedAt, email, emailVerifiedAt, dateOfBirth,
roles, status, createdAt, updatedAt), `UserSession` (id, userId,
deviceId, tokenVersion, status, ip, userAgent, createdAt, lastUsedAt,
expiresAt, revokedAt, revokedReason), `Device` (id, userId, name,
userAgent, lastSeenIp, lastSeenAt, createdAt). `UserRole` : enum partage
(`packages/contracts`), pas une collection separee (pas de justification
a une table de jonction generique en Phase 2 — tableau de roles sur
`User`).

### Endpoints (tous sous `/api/v1/auth`)

| Methode | Route | Auth | Objet |
|---|---|---|---|
| POST | /otp/request | PUBLIC | envoie un code OTP au telephone |
| POST | /otp/verify | PUBLIC | verifie le code, cree la session |
| POST | /refresh | PUBLIC (token requis) | rotation du refresh token |
| POST | /logout | AUTHENTICATED | revoque la session courante |
| POST | /logout-all | AUTHENTICATED | revoque toutes les sessions |
| GET | /sessions | AUTHENTICATED | liste appareils/sessions actifs |
| DELETE | /sessions/:id | AUTHENTICATED, owner | revoque une session precise |
| GET | /me | AUTHENTICATED | profil courant |
| PATCH | /me | AUTHENTICATED | met a jour `dateOfBirth` |
| POST | /roles/provider | AUTHENTICATED | ajoute le role PROVIDER (regle age) |
| POST | /email | AUTHENTICATED | attache un email, envoie un code |
| POST | /email/verify | AUTHENTICATED | confirme l'email |

## Hors perimetre (documente comme limitation)

- Google/Apple OAuth : uniquement "prepare" par la structure (roles /
  User.email deja generiques), aucune implementation (spec #68 dit
  "extension future").
- ProviderProfile / onboarding fournisseur complet : Phase 3.
- Suppression de compte (#72, workflow complet) : pas dans les livrables
  Phase 2 de `docs/IMPLEMENTATION_PLAN.md`, reporte.
- Detection d'anomalies de connexion avancee (#70 "suspicious login
  detection") : au-dela du rate limiting + detection de reutilisation de
  refresh token, pas de scoring comportemental en Phase 2.
- Mobile (stockage securise reel) : Phase 13.

## Dependances nouvelles (decision autonome, criteres 05_DECISION_POLICY.md)

- `jsonwebtoken` (+ `@types/jsonwebtoken`) : signature/verification JWT,
  aucune alternative deja presente dans le monorepo, aucun conflit de
  peerDependency detecte (verifie `npm view`).
- `libphonenumber-js` : validation/normalisation E.164 reelle (pas une
  regex maison approximative) — necessaire puisque le produit est
  centre sur le SMS. Verifie sans peerDependency, taille raisonnable,
  tres maintenue.
- Pas de bcrypt/argon2 (pas de mot de passe dans ce MVP), pas de
  `@fastify/cookie` (parsing/serialisation cookie ecrits a la main,
  ~30 lignes, Fastify supporte nativement plusieurs `Set-Cookie` via des
  appels repetes a `reply.header("set-cookie", ...)` — verifie dans
  `fastify/lib/reply.js`), pas de librairie CSRF (double-submit cookie
  ecrit a la main).

## Nouvelles variables d'environnement

- `OTP_SECRET` (obligatoire, >=16 caracteres) : cle HMAC pour le hash des
  codes OTP/email (jamais stockes en clair, meme dans Redis).
- `MIN_PROVIDER_AGE` (defaut `18`) : age minimum configurable pour
  devenir fournisseur (#71).

## Ordre d'implementation

1. `packages/config` : `OTP_SECRET`, `MIN_PROVIDER_AGE`.
2. `packages/shared-utils` : `verification-code.ts` (generation + hash
   HMAC, reutilise par OTP telephone ET verification email).
3. `packages/contracts` : `PhoneE164Schema` (common.ts), `user.ts`,
   `auth.ts`.
4. `apps/api` : dependances (`jsonwebtoken`, `libphonenumber-js`),
   schemas Mongoose (`User`, `UserSession`, `Device`), module `auth`
   complet (providers SMS/email dev, service OTP, service JWT/session,
   guards `AuthGuard`/`RolesGuard`/`ResourceOwnerGuard`, rate limiting
   Redis, cookies + CSRF, controllers).
5. Tests unit + integration reelle (Mongo/Redis Docker) : parcours OTP
   complet, refresh + rotation + detection de reutilisation, RBAC,
   401 sans session, CSRF.
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -> 0 erreur.
7. Documentation : `PHASE_2_REPORT.md`, `PROGRESS.md`, `DECISIONS.md`,
   `README.md` (nouvelles variables d'env), `CURRENT_STATE.md` si
   necessaire.
8. STOP, attendre "GO PHASE 3".
