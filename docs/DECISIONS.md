# FIXIYI - DECISIONS

Journal des decisions techniques et produit.

---

## Format

    ## Decision N - Titre
    - Contexte :
    - Options :
    - Choix :
    - Raison :
    - Trade-offs :
    - Date :

---

## Decision 1 - Architecture initiale : Modular Monolith

- Contexte : Fixiyi doit etre scalable sans sur-ingenierie.
- Options : A. Microservices / B. Monolithe / C. Modular Monolith
- Choix : C. Modular Monolith
- Raison : Boundaries claires, extraction future possible.
- Trade-offs : Discipline sur les imports inter-modules.
- Date : 2026-09-19

---

## Decision 2 - Representation monetaire : integer minor units

- Contexte : Les floats produisent des erreurs d'arrondi.
- Options : A. Float / B. Decimal lib / C. Integer minor units
- Choix : C. Integer minor units
- Raison : Deterministe, sur pour transactions.
- Trade-offs : Conversion a l'affichage.
- Date : 2026-09-19

---

## Decision 3 - Base de donnees : MongoDB

- Contexte : Besoin flexibilite schema, geospatial, scalabilite.
- Options : A. PostgreSQL / B. MongoDB / C. Hybride
- Choix : B. MongoDB
- Raison : Geospatial natif, flexible, transactions supportees.
- Trade-offs : Moins strict que SQL.
- Date : 2026-09-19

---

## Decision 4 - TypeScript epingle en 6.0.3 (pas la derniere version 7.x)

- Contexte : `npm view typescript version` renvoie 7.0.2 (nouveau compilateur
  reecrit en Go / "tsgo", changement architectural majeur). Verification
  faite : `typescript-eslint@8.70.0` declare un peerDependency strict
  `typescript: ">=4.8.4 <6.1.0"` - TS 7 casserait immediatement le linting
  type-aware (et potentiellement d'autres outils : ts-node, bundlers).
- Options : A. TS 7.0.2 (derniere) / B. TS 5.9.3 (derniere 5.x) / C. TS 6.0.3
  (derniere version stable qui reste sous la barre `<6.1.0`)
- Choix : C. TypeScript 6.0.3
- Raison : Version la plus recente possible tout en restant compatible avec
  toute la chaine d'outillage (ESLint type-aware, tsup, NestJS CLI, Next.js).
  Respecte "ne pas figer une version obsolete" (06.0.3 est tres recent) sans
  casser le linting.
- Trade-offs : Pas sur la toute derniere version majeure ; a reevaluer des
  que `typescript-eslint` publiera une version supportant TS 7.
- Date : 2026-09-19

---

## Decision 5 - Build des packages partages : tsup (dual ESM+CJS)

- Contexte : `packages/*` doivent etre consommables par des apps NestJS
  (CommonJS) ET des apps Next.js (ESM), donc besoin d'une sortie dual
  format + declarations `.d.ts`/`.d.cts`.
- Options : A. tsc simple (un seul format) / B. tsup (esbuild, dual format,
  dts via rollup-plugin-dts) / C. Rollup manuel
- Choix : B. tsup
- Raison : Configuration minimale, rapide, gere nativement esm+cjs+dts en
  une commande. Librairie secondaire <500KB, tres maintenue -> decision
  autonome de l'agent (05_DECISION_POLICY.md).
- Trade-offs : `tsup` genere `dist/index.js` (ESM, car `"type":"module"`
  dans chaque package.json) et `dist/index.cjs` (CJS) - PAS `index.mjs`
  comme suppose initialement. Bug reel corrige : les champs
  `main`/`module`/`exports` de chaque package.json pointaient vers un
  fichier `index.mjs` inexistant, cassant la resolution de module dans
  Vitest/Vite pour tout consommateur (voir rapport de phase, bug #1).
- Date : 2026-09-19

---

## Decision 6 - Pas de `nestjs-zod` ; pipe de validation Zod maison

- Contexte : Le stack impose Zod partout (02_SPEC_ENGINEERING.md). Le
  package `nestjs-zod` integrerait Zod à NestJS + generation OpenAPI
  automatique.
- Verification faite : `nestjs-zod@5.5.0` declare des peerDependencies
  `@nestjs/common: ^10 || ^11` et `@nestjs/swagger: ^7.4.2 || ^8 || ^11` -
  notre stack est sur NestJS 12 (dernier), donc peer non satisfait (meme
  categorie de decalage ecosysteme que la Decision 4).
- Options : A. `nestjs-zod` (peer casse) / B. Downgrade NestJS a la v11
  pour satisfaire nestjs-zod / C. Pipe de validation Zod ecrit a la main
  (~20 lignes)
- Choix : C. `ZodValidationPipe` maison
  (`apps/api/src/common/pipes/zod-validation.pipe.ts`)
- Raison : Evite un peer casse et une dependance supplementaire alors que
  la Phase 1 n'a encore aucun DTO metier a valider (le health check n'a
  pas de body). Le pipe est reutilisable via
  `@UsePipes(new ZodValidationPipe(Schema))` des que des DTOs arriveront
  en Phase 2+. La generation OpenAPI automatique a partir de schemas Zod
  est reportee a une phase ulterieure si besoin reel.
- Trade-offs : Pas de generation OpenAPI automatique depuis les schemas
  Zod pour l'instant (Swagger doit etre annote manuellement au fur et a
  mesure). A reevaluer si nestjs-zod met a jour son peerDependency.
- Date : 2026-09-19

---

## Decision 7 - Retrait de `@nestjs/config` ; chargement d'env maison

- Contexte : `AppModule` utilisait `ConfigModule.forRoot({ validate:
  loadEnv })` pour charger/valider l'environnement. Bug reel decouvert par
  un smoke test manuel (`node dist/main.js`) : l'app demarrait avec TOUTES
  les variables requises `undefined` alors que le fichier `.env` existait
  et que le log dotenv confirmait "injected env (36)".
- Cause racine identifiee : `@nestjs/config` prend un instantane
  (snapshot/copie) de `process.env` **avant** d'invoquer notre callback
  `validate`. Notre `loadEnv()` charge dotenv **a l'interieur** de ce
  callback (trop tard) : le dotenv mute le vrai `process.env`, mais
  `validate` recoit deja une copie figee prise plus tot, donc la mutation
  n'est jamais vue par `EnvSchema.safeParse(env)`.
- Options : A. Garder `@nestjs/config`, appeler `loadEnv()` plus tot d'une
  maniere ou d'une autre pour peupler `process.env` avant que
  `ConfigModule.forRoot()` prenne son instantane / B. Retirer
  `@nestjs/config`, appeler `loadEnv()` explicitement en tout premier dans
  `main.ts` (avant `NestFactory.create`), puis injecter l'objet `Env` deja
  valide via un module NestJS `@Global()` maison (`EnvModule.forRoot(env)`
  + token `ENV`)
- Choix : B.
- Raison : Supprime completement la classe de bug liee au timing du hook
  `validate` (peu documente, fragile). Une seule source de verite pour le
  chargement d'env (`@fixiyi/config#loadEnv`), invoquee une seule fois,
  de maniere synchrone et previsible, avant tout le reste. Simplicite >
  Securite (priorite #1 de 05_DECISION_POLICY.md).
- Trade-offs : `DatabaseModule`/`RedisModule` injectent le token `ENV`
  (Symbol) au lieu du `ConfigService` standard NestJS - pattern un peu
  moins idiomatique pour quelqu'un habitue a `@nestjs/config`, mais
  documente en commentaire dans `env.module.ts`.
- Date : 2026-09-19

---

## Decision 8 - `findNearestEnvFile` : recherche du `.env` vers le haut

- Contexte : Chaque app du monorepo s'execute avec son propre dossier
  comme `cwd` (convention pnpm/turbo : `pnpm --filter X run script` fait
  `cd` dans le package avant d'executer). `dotenv` ne regarde que dans
  `process.cwd()` par defaut, donc un `.env` a la racine du monorepo
  n'est jamais trouve depuis `apps/api` ou `apps/worker`. Bug reel
  observe : `node dist/main.js` depuis `apps/api` chargeait 0 variable
  jusqu'a la correction.
- Options : A. Exiger que chaque `.env` soit duplique par app / B. Chaque
  app calcule un chemin relatif fixe vers la racine (fragile, casse si un
  app change de profondeur) / C. `findNearestEnvFile` : remonte
  l'arborescence depuis `cwd` jusqu'a trouver `.env`, en s'arretant a la
  racine du monorepo (marqueur `pnpm-workspace.yaml`) ou a la racine du
  filesystem
- Choix : C., implemente dans `packages/config/src/find-env-file.ts`,
  utilise par `loadEnv()`.
- Raison : Robuste independamment du dossier de travail ou de la
  profondeur d'un app dans le monorepo. Utilite reelle pour TOUTES les
  apps actuelles et futures -> justifie une petite piece d'infra
  partagee (pas de la sur-ingenierie).
- Trade-offs : Un `.env` place PAR ERREUR au-dessus de la racine du
  monorepo ne sera jamais trouve (comportement voulu et teste).
- Date : 2026-09-19

---

## Decision 9 - `apps/worker` : queue de diagnostic "system/ping" au lieu
  d'une fausse queue metier

- Contexte : La Phase 1 (Foundation) n'a encore aucune queue metier reelle
  (notifications, matching, ai, media... arrivent phase par phase a partir
  de la Phase 2). Le protocole interdit tout "faux backend" / logique
  decorative (03_AGENT_PROTOCOL.md #2).
- Options : A. Worker vide sans aucune Queue/Worker BullMQ instancie
  (prouve seulement la connexion Redis) / B. Worker enregistrant une
  fausse queue metier avec un processor factice / C. Une queue
  "system" avec un seul job reel "ping" (pattern "canary job" courant en
  prod) : le worker traite vraiment un job via Redis, un test
  d'integration l'enqueue et attend sa completion de bout en bout
- Choix : C.
- Raison : Prouve reellement tout le pipeline BullMQ+Redis (enqueue ->
  traitement -> completion) sans simuler une fonctionnalite metier qui
  n'existe pas encore. Honnete sur son role (documente comme
  "diagnostic-only" dans le code), pas presente comme une fonctionnalite
  produit.
- Trade-offs : Une queue de plus a ignorer/nettoyer plus tard si elle
  devient inutile (peu probable, utile comme readiness-check meme en
  Phase 8+).
- Date : 2026-09-19

---

## Decision 10 - Extensions `.mjs`/`.mts` pour les fichiers de config dans
  les apps CommonJS

- Contexte : `apps/api` compile en CommonJS (convention NestJS CLI), donc
  son `package.json` n'a pas `"type": "module"`. Mais `eslint.config.js`
  et `vitest.config.ts` utilisent la syntaxe `import`/`export` (ESM). Sans
  extension explicite, Node/ESLint/Vite emettent un warning de
  re-interpretation (perf) et, pour `.ts`, `tsc --noEmit` echoue sur
  `import.meta` incompatible avec `module: "CommonJS"`.
- Options : A. Ajouter `"type": "module"` au package.json d'apps/api
  (casserait la sortie CommonJS de `nest build` au runtime) / B. Renommer
  ces fichiers de config en `.mjs`/`.mts` (extension explicite = ESM
  quel que soit `"type"` du package.json)
- Choix : B. `eslint.config.js` -> `eslint.config.mjs`,
  `vitest.config.ts` -> `vitest.config.mts` (dans `apps/api` uniquement ;
  `apps/worker` est en ESM pur donc pas concerne).
- Raison : Isole le choix ESM/CJS au fichier concerne sans affecter le
  runtime de l'application compilee.
- Trade-offs : Incoherence de nommage entre apps CommonJS et apps ESM du
  monorepo (mineur, documente ici pour eviter la confusion).
- Date : 2026-09-19

---

## Decision 11 - Scripts d'installation npm : deny `@scarf/scarf`, allow
  le reste

- Contexte : pnpm bloque par defaut les scripts `postinstall` des
  nouvelles dependances (protection supply-chain). Rencontres cette
  session : `esbuild`, `unrs-resolver`, `@swc/core`, `msgpackr-extract`,
  `@scarf/scarf`.
- Verification faite pour chacun (`pnpm why <pkg>`) :
  - `esbuild` : bundler natif utilise par tsup/vitest -> legitime.
  - `unrs-resolver` : resolveur TS rapide utilise par
    `eslint-plugin-import-x`/`eslint-import-resolver-typescript` ->
    legitime.
  - `@swc/core` : compilateur natif requis par `unplugin-swc` pour le
    transform des decorateurs NestJS dans Vitest -> legitime.
  - `msgpackr-extract` : binaire natif d'optimisation de `msgpackr`,
    dependance de `bullmq` -> legitime.
  - `@scarf/scarf` : dependance transitive de `swagger-ui-dist` (via
    `@nestjs/swagger`). C'est un beacon de telemetrie/analytics
    (scarf.sh) qui "phone home" au moment de l'installation, sans aucune
    fonction pour le package lui-meme.
- Choix : `allowBuilds: { esbuild: true, unrs-resolver: true, '@swc/core':
  true, msgpackr-extract: true, '@scarf/scarf': false }`
  (`pnpm-workspace.yaml`).
- Raison : Minimiser les scripts postinstall arbitraires qui s'executent
  sans nécessité fonctionnelle (03_AGENT_PROTOCOL.md - ne pas transmettre
  de donnees a un service externe sans necessite).
- Trade-offs : Aucun connu - `swagger-ui-dist` fonctionne normalement sans
  le beacon de telemetrie.
- Date : 2026-09-19

---

## Decision 12 - `apps/mobile` non cree en Phase 1

- Contexte : `01_SPEC_PRODUCT.md #79` liste `apps/mobile/` dans la
  structure monorepo cible. `06_SCOPE.md` place Mobile en Phase 13 (V3),
  apres validation complete du MVP (Phases 0-8) et de V2 (Phases 9-12).
- Options : A. Scaffolder `apps/mobile` des maintenant par completude
  avec la structure ideale / B. Ne pas le creer avant la Phase 13
- Choix : B.
- Raison : Eviter le code/l'infrastructure premature sans besoin reel
  immediat (regle generale anti sur-ingenierie + hierarchie des priorites
  "Simplicite" de 05_DECISION_POLICY.md). Documente explicitement dans
  `docs/phases/PHASE_1_PLAN.md` comme hors perimetre.
- Trade-offs : Aucun - c'est exactement la sequence prevue par le scope.
- Date : 2026-09-19

---

## Decision 13 - Remplacement de `eslint-plugin-react` par
  `@eslint-react/eslint-plugin`

- Contexte : Premiere vraie mise a l'epreuve du preset `react.js` de
  `@fixiyi/eslint-config` (seuls consommateurs possibles : `apps/web`/
  `apps/admin`, inexistants avant cette session - voir "avertissement
  connu" de la fin de Phase 1 partie 1). Verification faite en lancant
  reellement `pnpm --filter @fixiyi/web lint` : crash immediat, pas un
  simple avertissement de peerDependency.
  ```
  TypeError: Error while loading rule 'react/display-name':
  contextOrFilename.getFilename is not a function
  ```
- Cause racine identifiee : `eslint-plugin-react@7.37.5` (derniere
  version publiee, verifie via `npm view ... versions`) appelle encore
  `context.getFilename()` dans son utilitaire interne de detection de
  version React (`lib/util/version.js`). Cette methode, deja depreciee
  en ESLint 9 en faveur de `context.filename`, a ete retiree dans
  ESLint 10. Le peerDependency declare de `eslint-plugin-react`
  (`eslint: "^3 || ... || ^9.7"`) le confirme : le paquet ne supporte
  officiellement rien au-dela d'ESLint 9.7, ni en stable ni en tag
  `next` (verifie : `next` = `7.8.0-rc.0`, une version ANTERIEURE et
  toujours sans support ESLint 10).
- Options : A. Downgrade global d'ESLint a la 9.x pour tout le monorepo
  (regression sur `packages/*`/`apps/api`/`apps/worker`, deja verifies
  fonctionnels sur ESLint 10) / B. Neutraliser uniquement les regles qui
  crashent (`react/display-name` et toute regle basee sur
  `Components.componentRule`/`usedPropTypes`, detection fragile et
  susceptible de s'etendre a d'autres regles du meme utilitaire) / C.
  Remplacer `eslint-plugin-react` par `@eslint-react/eslint-plugin`
  (alias npm `eslint-plugin-react-x`), plugin TypeScript-first concu pour
  flat config, peerDependency `eslint: "*"` (verifie via `npm view`)
- Choix : C.
- Raison : Seule option qui resout la cause racine (pas de contournement
  fragile) sans regresser sur les 9 packages/apps deja verifies sur
  ESLint 10. `@eslint-react/eslint-plugin` fournit un preset
  `recommended-type-checked` (65+1 regles) coherent avec le linting
  type-aware deja en place partout ailleurs (`strictTypeChecked` dans
  `base.js`). Verifie reellement : `pnpm --filter @fixiyi/web lint` -> 0
  erreur, 0 avertissement apres le changement.
- Trade-offs : `@eslint-react/eslint-plugin` reimplemente ses propres
  regles de hooks (`@eslint-react/rules-of-hooks`,
  `@eslint-react/exhaustive-deps`, `@eslint-react/purity`,
  `@eslint-react/set-state-in-effect`, `@eslint-react/set-state-in-render`,
  `@eslint-react/static-components`, `@eslint-react/unsupported-syntax`,
  `@eslint-react/use-memo`, `@eslint-react/error-boundaries`) qui
  font doublon avec celles de `eslint-plugin-react-hooks@7.1.1` (deja en
  place, verifie compatible ESLint 10 via `pnpm peers check` avant meme
  ce changement). Ces 9 regles dupliquees sont explicitement desactivees
  dans `react.js` pour garder `eslint-plugin-react-hooks` (le plugin
  officiel maintenu par l'equipe React) comme unique source de verite sur
  les hooks - `@eslint-react/use-state` (non duplique) reste actif. A
  surveiller si `eslint-plugin-react` publie un jour un correctif ESLint
  10 (peu probable, `next` tag est en retard sur `latest`).
- Date : 2026-09-20

---

## Decision 14 - Design tokens <-> Tailwind v4 : pont par variables CSS +
  valeurs arbitraires (pas de mapping `@theme inline` complet en Phase 1)

- Contexte : `apps/web`/`apps/admin` doivent consommer
  `@fixiyi/design-tokens/css`. Tailwind v4 propose `@theme inline { --color-x:
  var(--autre-var); }` pour generer des utilitaires (`bg-x`, `text-x`, ...)
  a partir de variables CSS existantes.
- Options : A. Mapper l'integralite des tokens (couleurs primary 50-900,
  neutral 0-1000, semantiques, radius, font, motion) dans un bloc
  `@theme inline` pour generer des utilitaires Tailwind nommes / B. Importer
  simplement `@fixiyi/design-tokens/css` (variables `--fixiyi-*` disponibles
  globalement) et les consommer directement via la syntaxe de valeur
  arbitraire Tailwind (`bg-[var(--fixiyi-color-primary-100)]`) ou en CSS
  brut, sans creer de nouvel espace de nommage Tailwind
- Choix : B.
- Raison : `apps/web` n'a encore aucun ecran/composant reel (page de statut
  uniquement) - mapper ~40 tokens vers un theme Tailwind complet des
  maintenant serait de l'infrastructure sans consommateur reel (meme
  logique que Decision 12). L'import seul suffit a prouver le cablage
  (verifie : build reel + grep du CSS genere, `--fixiyi-color-primary-100:
  #d3ebea` et `background-color:var(--fixiyi-color-primary-100)` bien
  presents dans `.next/static/chunks/*.css`).
- Trade-offs : Pas d'utilitaires Tailwind courts (`bg-primary-500`) tant que
  le mapping `@theme inline` n'est pas fait - a reevaluer dans une phase
  ulterieure quand de vrais composants/ecrans consommeront reellement les
  tokens de couleur/espacement en volume.
- Date : 2026-09-20

---

## Decision 15 - Telemetrie Next.js ET Turborepo desactivee (Docker/CI)

- Contexte : `next build`/`next dev`/`next start` collectent par defaut une
  telemetrie anonyme envoyee a Vercel. Constate egalement pendant cette
  session, en construisant les images Docker : `turbo run build` affiche
  le meme type d'avertissement ("Turborepo now collects completely
  anonymous telemetry..."). Ni l'un ni l'autre ne peut etre desactive
  depuis un fichier de config versionne (`next.config.ts` n'a pas ce
  pouvoir) - seule une variable d'environnement (`NEXT_TELEMETRY_DISABLED`,
  `TURBO_TELEMETRY_DISABLED`) ou un flag machine persistant le permet.
  Verifie reellement : `TURBO_TELEMETRY_DISABLED=1 pnpm exec turbo
  telemetry status` -> `Status: Disabled`. Meme categorie de probleme que
  le beacon `@scarf/scarf` de la Decision 11 : transmission a un service
  externe sans necessite fonctionnelle pour l'app.
- Options : A. Laisser actives (defaut) / B. `NEXT_TELEMETRY_DISABLED=1` et
  `TURBO_TELEMETRY_DISABLED=1` dans les Dockerfiles (`ENV`, stage `base`)
  et dans l'environnement CI (`.github/workflows/ci.yml`) + note dans
  `README.md` pour le developpement local
- Choix : B.
- Raison : Coherent avec la Decision 11 (03_AGENT_PROTOCOL.md - pas de
  donnees vers un service externe sans necessite). Une variable
  d'environnement (Docker/CI) + une ligne de doc suffisent, pas de
  configuration machine persistante requise pour que ce soit reproductible
  partout ou le build tourne (local, CI, image Docker).
- Trade-offs : Un developpeur local qui ne suit pas la note du README
  garde les deux telemetries actives sur sa machine (pas bloquant, juste
  documente).
- Date : 2026-09-20

---

## Decision 16 - Sessions : refresh token = JWT + `tokenVersion` en Mongo
  (pas de hash de token stocke)

- Contexte : la rotation des refresh tokens (01_SPEC_PRODUCT.md #68) exige
  de detecter la reutilisation d'un token deja rote (signe probable de
  vol). Pattern classique : stocker un hash du refresh token courant en
  base, comparer a chaque refresh.
- Options : A. Stocker un hash du refresh token courant par session,
  comparer a chaque refresh / B. Ne stocker qu'un entier `tokenVersion`
  par session (incremente a chaque rotation) et l'inclure comme claim
  `rtv` dans le JWT signe ; comparer l'entier plutot qu'un hash
- Choix : B.
- Raison : Le JWT est deja auto-verifiant (signature HMAC) - le hash
  n'apporterait de securite que contre un token *falsifie*, deja exclu
  par la verification de signature. Un entier suffit a detecter la
  reutilisation d'un token *legitime mais perime* (deja rote). Simplicite
  > mecanisme redondant (05_DECISION_POLICY.md).
- Trade-offs : Aucune revocation cote token lui-meme (le JWT reste
  cryptographiquement valide jusqu'a expiration) - la revocation reelle
  passe par la verification du statut de la session (`ACTIVE`/`REVOKED`)
  en base a chaque requete authentifiee (voir `AuthGuard`), pas par le
  token seul.
- Date : 2026-09-20

---

## Decision 17 - Rate limiting OTP : IP via guard generique, telephone/email
  via `OtpService`

- Contexte : 02_SPEC_ENGINEERING.md #152 demande un rate limiting par IP
  ET par utilisateur/telephone. L'IP est disponible pour toute route sans
  connaitre le corps de la requete (adapte a un Guard generique) ; le
  telephone/email n'est connu qu'apres validation du DTO (adapte a un
  service qui connait deja le sujet valide).
- Options : A. Tout dans un seul Guard (dupliquer l'extraction du corps
  dans le Guard, avant la validation Zod) / B. Deux mecanismes
  complementaires : `RateLimitGuard` (decorateur `@RateLimit`, cle = IP)
  au niveau route + verification telephone/email integree a
  `OtpService.issueCode` (cle = sujet)
- Choix : B.
- Raison : Chaque verification reste au niveau ou sa donnee est deja
  naturellement disponible et validee, sans dupliquer le parsing du
  corps de requete hors du pipeline Nest standard.
- Trade-offs : Deux points de configuration au lieu d'un (constantes
  dans `auth.constants.ts` + `@RateLimit(...)` sur chaque route
  publique) - acceptable, peu de routes concernees en Phase 2.
- Date : 2026-09-20

---

## Decision 18 - Cookies et CSRF ecrits a la main (pas de
  `@fastify/cookie`, pas de librairie CSRF)

- Contexte : 01_SPEC_PRODUCT.md #69 exige des cookies web
  HttpOnly/Secure/SameSite + protection CSRF pour l'auth.
- Verification faite : Fastify gere nativement plusieurs en-tetes
  `Set-Cookie` (appels repetes a `reply.header("set-cookie", ...)`
  s'accumulent au lieu de s'ecraser - confirme dans
  `fastify/lib/reply.js`), donc aucune dependance n'est necessaire pour
  *emettre* des cookies. La *lecture* du header `Cookie` est un simple
  split sur `;`/`=`.
- Options : A. `@fastify/cookie` + une librairie CSRF (ex.
  `@fastify/csrf-protection`) / B. Parsing/serialisation cookie maison
  (`common/http/cookie.util.ts`, ~40 lignes, teste) + double-submit CSRF
  maison (`CsrfService`/`CsrfGuard`, cle secrete non necessaire - la
  securite vient de la Same-Origin Policy, pas d'un secret serveur)
- Choix : B.
- Raison : Coherent avec les Decisions 6/7 (prefere une petite piece
  d'infra maison, testee, a une dependance supplementaire quand le
  besoin reel est simple et precis). Aucune dependance supplementaire a
  maintenir/mettre a jour pour un mecanisme de securite critique dont on
  veut comprendre exactement le comportement.
- Trade-offs : Pas de gestion des cas exotiques de cookies (attributs
  `Domain`, cookies chunkes) - non necessaire pour les 3 cookies
  first-party de ce depot.
- Date : 2026-09-20

---

## Decision 19 - Nouvelles dependances `apps/api` : `jsonwebtoken` et
  `libphonenumber-js`

- Contexte : signature/verification JWT (aucune librairie JWT presente
  dans le monorepo) et validation E.164 reelle des numeros de telephone
  (le produit est centre sur le SMS).
- Verification faite (`npm view`) : `jsonwebtoken@9.0.3` et
  `libphonenumber-js@1.13.13`, aucune des deux ne declare de
  `peerDependencies` -> aucun risque de conflit du type Decision 4/6.
- Choix : les deux ajoutees telles quelles (`jsonwebtoken`,
  `@types/jsonwebtoken`, `libphonenumber-js`).
- Raison : Decision autonome de l'agent (05_DECISION_POLICY.md) -
  librairies secondaires, tres maintenues, sans alternative deja presente
  dans le monorepo. Pas de bcrypt/argon2 : aucun mot de passe dans ce MVP
  (authentification principale = Phone OTP, 01_SPEC_PRODUCT.md #68).
- Trade-offs : Aucun connu.
- Date : 2026-09-20

---

## Decision 20 - `RolesGuard`/`ResourceOwnerGuard` prets et testes, non
  branches sur une route en Phase 2

- Contexte : le RBAC (roles) et la base ABAC (proprietaire/participant,
  01_SPEC_PRODUCT.md #66/#67) sont des livrables Phase 2
  (`docs/IMPLEMENTATION_PLAN.md`), mais aucune ressource "possedee"
  (Request/Offer/Intervention) n'existe avant la Phase 4+, et aucune
  route admin-only n'existe avant la Phase 12.
- Options : A. Ne pas ecrire ces guards avant qu'une route en ait
  reellement besoin / B. Ecrire et tester unitairement `RolesGuard`
  (`@Roles(...)`) et `ResourceOwnerGuard` (`@OwnedBy(...)`) maintenant,
  sans les appliquer a une route qui n'existe pas encore
- Choix : B.
- Raison : Meme statut que `ZodValidationPipe` (Decision 6) - une piece
  d'infra generique, reelle et testee, prete a etre branchee par les
  phases suivantes, pas une verification factice branchee sur rien
  (03_AGENT_PROTOCOL.md #2 interdit le decoratif, pas l'anticipe-mais-non-
  cache). Documente explicitement ici et dans le rapport de phase pour
  ne pas etre confondu avec un oubli.
- Trade-offs : Deux fichiers sans consommateur reel jusqu'a une phase
  ulterieure - risque mineur qu'ils divergent du besoin reel quand ce
  moment arrivera (a revalider a ce moment-la).
- Date : 2026-09-20

---

## Decision 21 - Regle d'age (#71) appliquee uniquement au seul point
  reel d'attribution de role en Phase 2

- Contexte : aucune Phase 2 n'a d'ecran/agregat "profil" (`ProviderProfile`
  arrive en Phase 3) - `dateOfBirth` n'a donc de sens que sur `User`
  lui-meme pour l'instant.
- Options : A. Attendre la Phase 3 pour implementer la regle d'age (le
  livrable Phase 2 resterait non rempli) / B. Ajouter `dateOfBirth` a
  `User`, `PATCH /auth/me` pour le renseigner, et un endpoint self-service
  reel `POST /auth/roles/provider` qui applique reellement la regle
  (`MIN_PROVIDER_AGE`, configurable) avant d'accorder le role `PROVIDER`
- Choix : B.
- Raison : Seul moyen d'honorer le livrable Phase 2 (`docs/IMPLEMENTATION_PLAN.md`)
  sans inventer un agregat "profil" premature. L'action qui existe
  reellement en Phase 2 (attribuer un role a soi-meme) est exactement
  celle ou la regle d'age doit s'appliquer.
- Trade-offs : `dateOfBirth` n'est pas verifie contre un document
  d'identite (verification reelle = Phase 3, agent de verification) ;
  pas immuable (peut etre corrige librement) - documente comme
  limitation, pas cache.
- Date : 2026-09-20

---

## Decision 22 - `verification-code.ts` vit dans `apps/api`, pas dans
  `@fixiyi/shared-utils`

- Contexte : generation/hash de code a 6 chiffres, partage entre l'OTP
  telephone et la verification email - deux points d'appel reels au sein
  du meme module.
- Verification faite : premiere tentative dans `packages/shared-utils`
  (comme `id.ts`/`money.ts`/`time.ts`) - `tsup`/`rollup-plugin-dts` echoue
  reellement a generer les `.d.ts` (`Cannot find name 'node:crypto'`/
  `'Buffer'`) tant qu'aucun fichier du package ne touchait `node:crypto`
  auparavant. Corrige localement avec `/// <reference types="node" />`,
  mais le probleme sous-jacent (package `shared-utils` aussi consomme par
  les apps Next.js **navigateur**) demeure : `node:crypto` n'existe pas
  cote navigateur.
- Options : A. Garder dans `shared-utils` avec la reference `node` /
  B. Deplacer dans `apps/api/src/auth/` (seul consommateur reel, Node
  uniquement)
- Choix : B.
- Raison : Coherent avec la Decision 6 (code specifique a un runtime
  reste local jusqu'a un second consommateur reel dans un AUTRE
  app/package, pas seulement un second point d'appel dans le meme
  module). Evite aussi de faire fuiter une dependance Node-only dans un
  package importe par des bundles navigateur.
- Trade-offs : Si un futur module Node (ex. `apps/worker`) a besoin de la
  meme logique, il faudra soit la dupliquer soit creer un package
  `@fixiyi/node-utils` dedie - pas de besoin reel aujourd'hui.
- Date : 2026-09-20

---

## Decision 23 - `OTP_MAX_REQUESTS_PER_IP_PER_HOUR` = 60 (revise depuis 20)

- Contexte : premiere valeur choisie (20/heure/IP) inspiree de pratiques
  anti-abus courantes. Verifie reellement en ecrivant la suite
  d'integration e2e (`test/auth.e2e.test.ts`, ~20 connexions OTP
  legitimes et distinctes necessaires pour couvrir le module) : une seule
  adresse IP partagee (loopback des tests, mais representatif de tout
  NAT/wifi partage/CGNAT mobile reel) atteignait la limite avec un trafic
  entierement legitime.
- Options : A. Garder 20/heure (rejette du trafic legitime derriere une
  IP partagee) / B. Remonter a 60/heure (toujours strict contre du
  bombing OTP reel - un attaquant qui martele depasse 60 en quelques
  secondes - mais tolerant a une connexion partagee moderement active)
- Choix : B.
- Raison : Un test d'integration reel a mis en evidence qu'un seuil bas
  par IP (sans distinction d'utilisateur) punit surtout les reseaux
  partages, pas les attaquants (le plafond par telephone,
  `OTP_MAX_REQUESTS_PER_PHONE_PER_HOUR = 5`, reste le vrai frein anti-abus
  cible sur un numero). Exactement le type de correction que
  l'integration reelle (02_SPEC_ENGINEERING.md - "aucune donnee simulee")
  est censee reveler.
- Trade-offs : Un attaquant disposant de nombreux numeros de telephone
  derriere une seule IP dispose d'un budget plus large qu'avant (60 au
  lieu de 20) - attenue par le plafond par telephone qui, lui, n'a pas
  change.
- Date : 2026-09-20

---

## Decision 24 - TTL index MongoDB sur `user_sessions.expiresAt`

- Contexte : la collection `user_sessions` grossit indefiniment (une
  session par login/refresh) - rien ne supprimait les sessions expirees
  ou revoquees, ni les documents `Device` inactifs.
- Options : A. Nettoyage manuel via un job cron dedie / B. TTL index
  MongoDB natif (`expireAfterSeconds`)
- Choix : B.
- Raison : MongoDB supprime automatiquement les documents expires en
  arriere-plan (thread TTL Monitor, verification ~60s) - aucun code
  applicatif, aucun cron, aucune tache de maintenance a operer. Coherent
  avec 05_DECISION_POLICY.md (simplicite > mecanisme custom).
- Implementation : `UserSessionEntitySchema.index({ expiresAt: 1 },
  { expireAfterSeconds: 0 })` (`expireAfterSeconds: 0` = "expire exactement
  au timestamp stocke", pas N secondes apres) dans
  `apps/api/src/auth/schemas/user-session.schema.ts`. Remplace l'index
  simple qui existait deja sur ce champ (meme cle, un seul index -
  double usage : TTL + lookup pour `findActiveById`/`rotate`).
- Trade-offs : Perte de l'historique des sessions expirees/revoquees
  (acceptable - aucune valeur metier a les conserver en Phase 2 ; a
  revisiter si un futur besoin d'audit/analytics de connexion apparait,
  auquel cas archiver avant suppression plutot que retirer le TTL).
- Date : 2026-09-20

---

## Decision 25 - TTL index MongoDB sur `devices.lastSeenAt` (90 jours) ;
  pas de TTL sur `User`

- Contexte : meme question posee pour les deux autres schemas du module
  auth (`Device`, `User`).
- `Device` : un appareil inactif depuis longtemps (l'utilisateur a
  change de telephone, desinstalle l'app, etc.) n'a plus de valeur et
  grossit la collection indefiniment (un document par appareil distinct
  jamais reutilise).
  - Choix : TTL de 90 jours sur `lastSeenAt` (`DeviceEntitySchema.index({
    lastSeenAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })`,
    `apps/api/src/auth/schemas/device.schema.ts`). `lastSeenAt` est mis a
    jour a chaque connexion (`SessionService.upsertDevice`), donc le
    compte a rebours redemarre a chaque usage reel - un appareil actif
    n'expire jamais.
  - Verification de securite faite : une `UserSession` reference un
    `deviceId`, mais la duree de vie max d'une session
    (`expiresAt`, plafonnee par `JWT_REFRESH_TTL`, 30 jours par defaut)
    est toujours strictement inferieure aux 90 jours du device - une
    session ne peut donc jamais survivre a la suppression de son
    device. Si `JWT_REFRESH_TTL` etait un jour configure au-dela de 90
    jours, le pire cas reste sans crash : `SessionService.listActiveForUser`
    degrade proprement (`devices.get(...)?.name ?? null`), a
    revalider si ce scenario devient reel.
- `User` : pas de TTL. Les champs temporaires (`pendingEmail`) ne causent
  pas de croissance non bornee - c'est un champ sur un document `User`
  existant (une collection qui ne grossit qu'avec le nombre reel
  d'utilisateurs, pas avec le nombre de tentatives de verification email),
  ecrase en place a chaque nouvelle tentative, pas un document separe qui
  s'accumule. Aucune date de reference exploitable pour un TTL n'existe
  ni n'est necessaire (le code OTP email lui-meme expire deja via Redis,
  independamment de ce champ Mongo).

---

## Decision 26 - Catalogue : 1 collection Mongo generique au lieu de 6

- Contexte : `01_SPEC_PRODUCT.md #8` decrit une hierarchie a 5 niveaux
  (`Domain > Category > Service > InterventionType > Complexity`) plus un
  catalogue plat de `Skill` - 6 "types" au total, tous administrables.
- Options : A. 6 collections Mongo separees (une par niveau, quasi
  identiques : nom, description, ordre, actif, parent) / B. 1 collection
  `catalog_nodes` avec un champ `level` discriminant et un `parentId`
  nullable (null pour `DOMAIN`/`SKILL`, les deux racines)
- Choix : B.
- Raison : Les 6 niveaux partagent exactement la meme forme - dupliquer
  6 schemas/services/controllers quasi identiques (create/read/update/
  soft-delete + validation de la regle de parente) aurait ete plus de
  code sans plus de clarte. Une seule collection + un service generique
  qui valide la regle de parente par niveau
  (`CATALOG_PARENT_LEVEL: Record<CatalogLevel, CatalogLevel | null>`,
  `@fixiyi/contracts`) couvre les 6 cas reels avec un seul jeu de tests.
  `RequiredSkill` (la relation Complexity->Skill du schema #8) devient un
  simple champ `requiredSkillIds: string[]` sur les noeuds `COMPLEXITY`,
  pas une 7e collection de jointure.
- Trade-offs : Un seul index compose `{level, parentId, name}` (unique)
  fait tout le travail d'unicite - moins granulaire que 6 index dedies,
  mais suffisant (aucun besoin reel de contrainte differente par niveau).
  Suppression = desactivation logicielle (`active: false`), jamais un
  hard delete - une future Request/Offer (Phase 4+) pourra toujours
  referencer un noeud meme desactive sans casser.
- Date : 2026-09-20

---

## Decision 27 - `ProviderProfile` embarque ses 4 sous-agregats (pas 4
  collections)

- Contexte : `02_SPEC_ENGINEERING.md #98` liste `ProviderProfile,
  ProviderSkill, ProviderService, ProviderAvailability,
  ProviderServiceArea` comme 5 agregats distincts.
- Options : A. 5 collections separees avec des jointures / B. Un seul
  document `ProviderProfile` embarquant `skillIds: string[]`,
  `serviceIds: string[]`, `availability: AvailabilitySlot[]`,
  `serviceAreas: ServiceArea[]`
- Choix : B.
- Raison : Ces 4 sous-agregats n'ont aucun cycle de vie independant du
  profil - toujours lus/ecrits avec lui, jamais interroges seuls dans le
  perimetre Phase 3. L'embedding Mongoose est idiomatique pour des
  donnees 1:1-scopees-au-parent (evite des jointures/N+1 pour un gain nul
  ici). Coherent avec Decision 26 (meme logique de simplification) et
  05_DECISION_POLICY.md (pas de normalisation prematuree).
- Trade-offs : Si une phase future a besoin d'interroger "tous les
  providers disponibles a tel horaire" independamment du profil, un
  index sur un champ embarque (`availability.dayOfWeek`) reste possible,
  mais une extraction en collection dediee serait alors a reconsiderer.
  Zone geographique (`serviceAreas.center`) deja indexee `2dsphere` en
  prevision de la Phase 5 (matching par proximite), non exploitee par
  une recherche pour l'instant (meme statut "prepare" que
  `ResourceOwnerGuard`, Decision 20).
- Date : 2026-09-20

---

## Decision 28 - `VerificationCase` generique sur `targetType` (couvre
  aussi `CompanyVerification`)

- Contexte : `02_SPEC_ENGINEERING.md #98` liste separement
  `Company, CompanyMember, CompanyVerification` et
  `VerificationCase, VerificationDocument, VerificationDecision`,
  suggerant a priori deux mecanismes de verification distincts (un pour
  les entreprises, un pour les individus).
- Options : A. Deux implementations paralleles de la machine a etats de
  verification (une pour `Company`, une pour `ProviderProfile`) / B. Une
  seule machine a etats generique, `targetType: "PROVIDER" | "COMPANY"`
  + `targetId`, reutilisee pour les deux
- Choix : B. `CompanyVerification` n'est donc pas une collection separee
  - c'est le meme `VerificationCase` avec `targetType: "COMPANY"`.
- Raison : Le cycle d'etats (`DRAFT -> IN_REVIEW -> NEEDS_CORRECTION/
  VERIFIED/REJECTED`, `VERIFIED -> SUSPENDED`) et le worklow (documents
  -> soumission -> decision historisee) sont identiques pour les deux
  cibles ; dupliquer la machine a etats aurait double le risque de bug
  sans bénéfice. La verification d'ownership differe (proprietaire du
  profil vs. OWNER actif de l'entreprise) mais reste une simple fonction
  injectee (`ProviderService.findById`/`CompanyService.isActiveOwner`),
  pas une raison de dupliquer le reste.
- Trade-offs : Aucune contrainte de schema ne peut imposer "un
  `VerificationDocument` de type `COMPANY_REGISTRATION` seulement sur une
  cible `COMPANY`" - verification laissee a la couche service si besoin
  futur (pas de cas reel a bloquer en Phase 3).
- Date : 2026-09-20

---

## Decision 29 - Upload de documents de verification : MinIO reel
  (URL presignee), pas le pipeline media generique de la Phase 4

- Contexte : `02_SPEC_ENGINEERING.md #124` decrit un pipeline complet
  `CreateUploadSession -> SignedUpload -> ObjectStorage -> Scan ->
  Process -> Finalize` (avec antivirus) prevu comme livrable Phase 4
  (medias de `ServiceRequest`). La verification (Phase 3) a aussi besoin
  d'uploader des documents (piece d'identite, etc.) **maintenant**.
- Options : A. Attendre la Phase 4 et bloquer la verification / B.
  Construire tout le pipeline generique (antivirus compris) en avance de
  phase / C. Un flux minimal mais reel : `StorageService` (SDK S3 officiel
  contre MinIO, URL PUT presignee, verification reelle d'existence via
  `HeadObject` avant de marquer un document `UPLOADED` - jamais de
  confiance aveugle dans la parole du client)
- Choix : C.
- Raison : Aucune simulation - l'upload passe reellement par MinIO (verifie
  par un vrai `PUT` HTTP dans `verification.e2e.test.ts`), juste sans le
  scan antivirus/traitement avance que la Phase 4 batira pour les medias
  de demande (fonctionnalite plus large, avec plus de types de fichiers
  et de consommateurs, qui justifiera alors la generalisation).
- Trade-offs : Pas de scan antivirus sur les documents de verification
  pour l'instant - a revisiter si la Phase 4 introduit un scanner
  reutilisable (alors migrer `VerificationDocument` vers le pipeline
  generique plutot que dupliquer un 2e scanner).
- Date : 2026-09-20

---

## Decision 30 - Nouvelle dependance `apps/api` : `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`

- Contexte : generer une URL PUT presignee S3-compatible (MinIO) exige une
  signature cryptographique (SigV4) non raisonnablement re-implementable
  a la main (contrairement aux cookies/CSRF de la Phase 2, Decision 18).
- Verification faite (`npm view`) : `@aws-sdk/client-s3@3.1136.0` et
  `@aws-sdk/s3-request-presigner@3.1136.0`, SDK officiel AWS, aucune
  `peerDependencies` declaree -> aucun risque de conflit du type
  Decision 4/6.
- Choix : les deux ajoutees telles quelles.
- Raison : Decision autonome de l'agent (05_DECISION_POLICY.md) - SDK
  officiel, tres maintenu, seule option raisonnable pour une signature
  S3 correcte. `forcePathStyle: true` requis explicitement pour MinIO
  (le style "virtual-hosted" par defaut du SDK ne fonctionne pas contre
  lui).
- Trade-offs : Poids de dependance non negligeable (SDK AWS complet) -
  acceptable, aucune alternative plus legere serieuse pour une signature
  SigV4 correcte.
- Date : 2026-09-20

---

## Decision 31 - Bug reel : race condition sur le seed du catalogue,
  corrige par un verrou distribue en 2 phases

- Contexte : `CatalogSeedService` seme des donnees de demo au demarrage
  si le catalogue est vide (`onModuleInit`). Verifie reellement en
  ecrivant la suite e2e : 3 fichiers de test bootent chacun une instance
  Nest complete independante contre la **meme** base MongoDB reelle -
  `MongoServerError: E11000 duplicate key ... { level: "SKILL", parentId:
  null, name: "Cablage de base" }` au 2e/3e boot.
- Cause racine : un "check puis insert" (verifier que le catalogue est
  vide, puis semer) est une race check-then-act classique - plusieurs
  instances peuvent toutes deux passer le check avant que l'une d'elles
  ait fini d'inserer.
- Options : A. Un simple verrou "premier arrive, les autres abandonnent"
  (`tryAcquire` sur un `_id` unique, `create()` atomique) / B. Un verrou
  en 2 phases : le gagnant seme puis marque `completedAt`, les perdants
  **attendent** ce marqueur (polling court) au lieu d'abandonner
  immediatement
- Choix : B.
- Raison : L'option A corrige les doublons mais laisse un 2e bug latent :
  une instance "perdante" continue son demarrage (et pourrait servir des
  requetes) alors que le catalogue est encore partiellement semé par le
  "gagnant". Verifie reellement : l'option A seule faisait echouer un
  test (`getTree()` retournant un noeud sans ses enfants) de facon
  intermittente selon l'ordre de demarrage des 3 apps de test. `runOnce()`
  (`SeedLockService`, `apps/api/src/common/seed/`) est generique et
  reutilisable par tout futur seed one-shot.
- Trade-offs : Un polling court (100ms, timeout 30s) sur les instances
  perdantes - negligeable au demarrage, jamais revisite ensuite (le
  verrou reste acquis pour la vie de la base).
- Date : 2026-09-20

---

## Decision 32 - Bug reel : rate limiting partage entre fichiers de test
  e2e, corrige par execution sequentielle + nettoyage systematique

- Contexte : l'ajout de 4 nouveaux fichiers e2e (catalog, provider,
  company, verification) en plus des 2 existants (health, auth) a fait
  reapparaitre, sous une nouvelle forme, l'interference de rate-limiting
  deja rencontree en Phase 2 (Decision 23) : les compteurs Redis
  (`ratelimit:otp-request:ip:*`, `ratelimit:otp-verify:ip:*`, ...) sont
  partages par TOUS les fichiers, executes par Vitest en **parallele**
  (threads/process separes) contre la **meme** IP loopback et le **meme**
  Redis reel.
- Options : A. Continuer a nettoyer au demarrage de chaque fichier
  (deja fait en Phase 2 - insuffisant, l'accumulation croisee pendant
  l'execution reste possible) / B. Nettoyer systematiquement AVANT
  chaque appel OTP (pas seulement au demarrage du fichier) + desactiver
  le parallelisme inter-fichiers de Vitest (`test.fileParallelism:
  false`) pour ce projet
- Choix : B (les deux combines).
- Raison : Le nettoyage systematique (helper partage
  `apps/api/test/otp-test-helper.ts`) rend chaque connexion "normale"
  robuste a l'accumulation, quel que soit l'ordre d'execution.
  `fileParallelism: false` elimine en plus toute la CLASSE de bug
  (rate-limit ET la race de seed de la Decision 31 auraient aussi ete
  attenuee par ceci seul) - des tests d'integration qui frappent une
  **vraie** infra partagee (Mongo/Redis/MinIO reels, pas des mocks) sont
  plus fiables sequentiels que paralleles ; le cout (suite ~30-60s au
  lieu de ~15-20s) est juge acceptable face au risque de faux-echecs
  intermittents.
- Trade-offs : Suite de tests plus lente. Le test dedie au rate-limiting
  (`auth.e2e.test.ts`, "Rate limiting") reste le seul a appeler
  l'endpoint brut sans passer par le helper - il continue de nettoyer
  explicitement apres lui-meme pour ne pas polluer les tests suivants.
- Date : 2026-09-20

---

## Decision 33 - Back-office admin : authentification par Bearer token
  en memoire (zustand), pas par cookies

- Contexte : `apps/admin` (port 3001/3005) et `apps/api` (port 4000) sont
  des origines differentes du point de vue du navigateur. L'auth cookie
  de la Phase 2 (Decision 18) est concue pour un client **meme origine**
  (`SameSite=Lax` suffit alors) ; la rendre fonctionnelle cross-origin
  exigerait `credentials: true` + une liste blanche d'origines cote CORS
  (`app.enableCors()` actuel = `origin: '*'`, incompatible avec
  `credentials: true`).
- Options : A. Reconfigurer CORS avec une origine explicite +
  `credentials: true` pour que le flux cookie de la Phase 2 fonctionne
  cross-origin / B. Le SPA admin recupere `accessToken`/`refreshToken`
  dans le corps JSON (deja retournes par toutes les routes d'auth, prevu
  pour un futur client mobile - Decision Phase 2 sur le "dual token
  delivery"), les garde en memoire (zustand, **premier usage reel** du
  store installe en Phase 1) et les envoie en `Authorization: Bearer`
  sur chaque appel
- Choix : B.
- Raison : Reutilise un mecanisme déjà prevu et teste (le corps JSON des
  routes d'auth) sans toucher a la configuration CORS/cookies de la
  Phase 2 (qui reste pensee pour le futur `apps/web`, meme origine).
  Verifie reellement : `curl -H "Origin: http://localhost:3005"` contre
  l'API confirme `access-control-allow-origin: *` et une reponse 201 -
  le flux Bearer cross-origin fonctionne sans aucune modification cote
  API.
- Trade-offs : Session perdue si le storage local du navigateur est
  vide/prive (persist zustand -> localStorage) - acceptable pour un
  outil interne, pas le niveau de securite vise pour la Phase 13
  (mobile).
- Date : 2026-09-20

---

## Decision 34 - Back-office : creation de noeud via `window.prompt()`,
  pas un formulaire modal

- Contexte : `docs/IMPLEMENTATION_PLAN.md` demande explicitement un
  back-office "minimal" (l'admin complet est reserve a la Phase 12,
  `06_SCOPE.md`). `apps/admin` n'a aucun composant UI reutilisable avant
  cette session (aucun design system de composants construit).
- Options : A. Construire un vrai formulaire modal (react-hook-form,
  deja installe) pour chaque creation de noeud / B. `window.prompt()`
  pour le seul champ `name`, appelant ensuite la vraie API
  (`POST /catalog/nodes`) avec la vraie validation serveur
- Choix : B.
- Raison : "Minimal" au sens explicite du plan - chaque action reste
  **reelle** (vrai appel API, vraie validation, vraie mise a jour de
  l'arbre via invalidation TanStack Query), seule l'UX de saisie est
  volontairement rudimentaire. Construire un systeme de modales
  reutilisable pour un unique champ texte aurait ete disproportionne par
  rapport au perimetre demande.
- Trade-offs : Pas d'edition de `description`/`order`, pas de gestion de
  `requiredSkillIds` depuis l'UI (l'API les supporte deja) - documente
  comme limitation, a completer si la Phase 12 (dashboard admin complet)
  ne les reprend pas entre-temps.
- Date : 2026-09-20

---

## Decision 35 - `ServiceRequest` : machine a etats reduite a
  `DRAFT -> REQUESTED` (+ `CANCELLED`/`EXPIRED`), `MATCHING` prepare mais
  non exploite

- Contexte : `docs/prompt/02_SPEC_ENGINEERING.md` propose un cycle complet
  `DRAFT -> REQUESTED -> MATCHING -> RESPONDED -> NEGOTIATING ->
  PRICE_AGREED -> CONFIRMED/CANCELLED/EXPIRED`. Aucune Offre (Phase 7) ni
  Intervention (Phase 8) n'existe encore pour piloter les transitions a
  partir de `RESPONDED`.
- Options : A. Implementer le cycle complet des maintenant, avec des
  transitions "factices" en attendant les Phases 7/8 / B. Implementer
  uniquement `DRAFT -> REQUESTED` (soumission client) + `CANCELLED` (a
  tout moment avant matching) ; garder `MATCHING` et les etats suivants
  dans l'enum du contrat (pour que le contrat soit stable) mais sans
  aucune transition Phase 4 qui y mene ; `EXPIRED` reste defini sans
  declencheur automatique (necessiterait un job planifie, absent du
  projet).
- Choix : B (valide explicitement par l'utilisateur avant le "GO PHASE 4").
- Raison : Implementer `RESPONDED`/`NEGOTIATING`/`PRICE_AGREED`/
  `CONFIRMED` maintenant serait un faux workflow — rien ne peut
  legitimement y transitionner sans Offre/Intervention reelles
  (03_AGENT_PROTOCOL.md #2, regle absolue anti-mock). `MATCHING` reste
  dans le contrat car matching sur `REQUESTED` sera la toute premiere
  action de la Phase 5 — l'enum ne doit pas etre retouche a ce moment-la.
- Trade-offs : Une demande `REQUESTED` reste dans cet etat indefiniment
  jusqu'a la Phase 5 (pas de moteur de matching pour la faire progresser)
  — attendu et documente, pas un bug.
- Date : 2026-09-20

---

## Decision 36 - Localisation de la demande : position exacte stockee,
  `approximateCoordinates()` prepare mais non branche

- Contexte : `01_SPEC_PRODUCT.md` #17 : "Avant acceptation : localisation
  approximative. Apres confirmation : adresse exacte accessible au
  fournisseur autorise." Aucun fournisseur ne peut encore consulter une
  demande (pas de matching/offres avant la Phase 5) : il n'existe donc
  aucun lecteur non-proprietaire a proteger aujourd'hui.
- Options : A. Stocker uniquement la position approximative jusqu'a la
  Phase 5, puis migrer les documents vers la position exacte / B. Stocker
  la position **exacte** des la Phase 4 (source de verite unique, jamais
  a "upgrader" plus tard) et preparer `approximateCoordinates()` comme
  fonction pure testee dans `@fixiyi/shared-utils`, prete a etre appelee
  par le futur endpoint de lecture cote fournisseur (Phase 5), sans la
  brancher nulle part pour l'instant — meme statut que
  `ResourceOwnerGuard` (Decision 20).
- Choix : B (valide explicitement par l'utilisateur avant le "GO PHASE
  4").
- Raison : Une migration de donnees (A) est un risque et un travail
  reporte sans valeur ajoutee : la regle produit ne concerne QUE ce
  qu'un lecteur externe voit, pas ce qui est stocke. `GeoPointSchema` a
  ete deplace de `provider.ts` vers `common.ts` (primitive partagee, 2
  consommateurs reels desormais : `ProviderProfile.serviceAreas` et
  `RequestLocation`).
- Trade-offs : Le contrat expose la position exacte a quiconque peut lire
  la demande aujourd'hui (le client proprietaire uniquement,
  `RequestService.requireOwned` verifie l'appartenance) — aucun risque
  reel avant qu'un lecteur fournisseur n'existe.
- Date : 2026-09-20

---

## Decision 37 - Pipeline media generique : `targetType`/`targetId`
  (mirroring Decision 28), scan par signature binaire ecrit a la main,
  metadonnees image via `image-size`

- Contexte : `02_SPEC_ENGINEERING.md` #124 decrit le pipeline
  `CreateUploadSession -> SignedUpload -> ObjectStorage -> Scan ->
  Process -> Finalize`. Aucun service d'antivirus n'est provisionne dans
  cet environnement.
- Options (portee) : A. `Media` couple directement a `ServiceRequest`
  (champ `requestId`) / B. `Media` generique avec `targetType`/`targetId`
  (memes noms que `VerificationCase`, Decision 28), reutilisable par un
  futur type de cible (ex. pieces jointes de chat, Phase 6) sans
  breaking change de contrat.
- Options (Scan) : A. Se fier au `Content-Type` declare par le client /
  B. Verifier reellement les premiers octets de l'objet (magic bytes)
  contre le `Content-Type` declare, ecrit a la main
  (`media-signature.ts`) — signatures couvertes : JPEG/PNG/WEBP,
  MP4/WEBM, MP3/WAV/OGG.
- Options (Process, dimensions image) : A. Parser les en-tetes
  JPEG/PNG/WEBP a la main (risque reel de bugs subtils, notamment le
  scan de segments JPEG) / B. Dependance `image-size` (zero dependance
  transitive, tres maintenue, usage a sens unique — memes criteres que
  `libphonenumber-js`, Decision 19).
- Choix : B partout.
- Raison : `targetType`/`targetId` reutilise un vocabulaire et un pattern
  deja valides (Decision 28) plutot que d'en inventer un nouveau. La
  verification de signature binaire est reelle (detecte un fichier
  deguise) meme si ce n'est pas un antivirus — limitation documentee. Un
  parsing JPEG/PNG/WEBP a la main aurait ete disproportionne par rapport
  au risque de bug, contrairement au hand-rolling des cookies/CSRF
  (Decision 18) qui portait sur une logique petite et entierement sous
  controle.
- Trade-offs : Un rejet automatique (`REJECTED` + raison), pas une
  decision humaine comme dans `VerificationCase` — nouveau, documente :
  le pipeline Scan/Process est entierement mecanique, aucune revue
  humaine n'est prevue par le produit pour un media de demande.
  `MediaModule` n'a AUCUN controleur : ses routes HTTP vivent dans
  `RequestController` (`POST /requests/:id/media`, `.../finalize`) pour
  que la validation de propriete + d'editabilite de la demande reste
  centralisee dans `RequestService`, avant tout appel au pipeline —
  mime logique que pourquoi `VerificationController` possede ses propres
  routes de document plutot qu'un `DocumentController` separe.
- Date : 2026-09-20

---

## Decision 38 - `apps/web` : meme authentification Bearer-en-memoire
  que `apps/admin` (Decision 33), et nouveau workspace `tests/browser`
  (Playwright, installation reelle)

- Contexte : `apps/web` (port 3000) et `apps/api` (port 4000) sont deux
  origines differentes du point de vue du navigateur, exactement comme
  `apps/admin` (Decision 33) — le cookie de la Phase 2 reste pense pour
  un client meme-origine. L'utilisateur a explicitement demande un vrai
  outil de navigateur pilote pour verifier `apps/web`.
- Choix : Reutiliser tel quel le pattern Bearer + zustand
  (`useAuthStore`) de Decision 33 pour `apps/web`. Installer
  `@playwright/test` dans un nouveau workspace pnpm `tests/browser/`
  (`tests/` etait reserve depuis la Phase 1, jamais rempli), avec
  Chromium telecharge via `npx playwright install chromium`.
- Raison : Le probleme cross-origin est identique a celui deja resolu et
  verifie empiriquement en Phase 3 — aucune raison de reconfigurer CORS
  differemment pour ce second client. `tests/browser` reste separe de
  `apps/api`'s tests e2e (Vitest+Supertest, in-process) : il pilote un
  vrai navigateur contre la vraie stack Docker (`apps/web`:3000,
  `apps/api`:4000, Mongo/Redis/MinIO reels) — aucune couche reseau
  simulee.
- Trade-offs : Le scenario Playwright depend de l'etat reel de la stack
  Docker (doit etre demarree et a jour) — documente dans
  `tests/browser/playwright.config.ts` (`baseURL` configurable via
  `WEB_URL`).
- Date : 2026-09-20

---

## Decision 39 - Trois bugs reels trouves uniquement par le test
  navigateur reel (Playwright), invisibles aux tests e2e in-process
  d'`apps/api`

- Contexte : Le scenario Playwright complet (login OTP -> creation de
  demande -> upload media -> soumission) a echoue trois fois de suite
  pour des raisons qu'aucun test e2e existant (Vitest+Supertest,
  in-process, meme machine) n'aurait jamais pu detecter :
  1. `apiFetch` (apps/web ET apps/admin) envoyait toujours
     `Content-Type: application/json`, meme sans corps. Fastify rejette
     une requete qui declare ce header sans corps
     ("Body cannot be empty..."). `POST /requests` est le premier
     endpoint du projet appele sans corps depuis un client — invisible
     avant.
  2. `app.enableCors()` (sans options) ne renvoyait que
     `Access-Control-Allow-Methods: GET,HEAD,POST` en preflight reel,
     bloquant tout PATCH/DELETE envoye par un VRAI navigateur (verifie
     par `curl -X OPTIONS`). Latent depuis la Phase 3 (les boutons
     Desactiver/Reactiver du back-office admin auraient echoue de la
     meme maniere) — jamais detecte car aucun test precedent ne
     declenche un vrai preflight CORS.
  3. Les URLs presignees MinIO etaient signees avec
     `STORAGE_ENDPOINT=http://minio:9000` (nom de service Docker
     interne). Le conteneur `api` le resout ; le navigateur (sur la
     machine hote) non — `net::ERR_NAME_NOT_RESOLVED`. Invisible car les
     tests e2e d'`apps/api` tournent sur l'hote avec
     `STORAGE_ENDPOINT=http://localhost:9000` pour les DEUX usages
     (signature ET requete reelle).
- Corrections : (1) `apiFetch` n'ajoute `Content-Type` que si un corps
  est effectivement envoye (corrige dans `apps/web` ET `apps/admin`).
  (2) `app.enableCors({ methods: [...] })` explicite plutot que la
  detection automatique de Fastify/`@fastify/cors`, jugee non fiable.
  (3) Nouvelle variable `STORAGE_PUBLIC_ENDPOINT` (optionnelle,
  `env-schema.ts`) : `StorageService` garde un second `S3Client`
  (signature uniquement, aucun appel reseau) pour les URLs presignees,
  utilisant `STORAGE_PUBLIC_ENDPOINT ?? STORAGE_ENDPOINT`;
  `docker-compose.dev.yml` la fixe a `http://localhost:9000` pour le
  service `api`.
- Raison de tout documenter ici : c'est exactement la justification
  donnee par l'utilisateur pour exiger un test navigateur reel en Phase
  4 plutot que de se contenter des tests e2e in-process — confirmee par
  les faits.
- Trade-offs : Aucun — corrections strictement additives/correctives,
  aucun comportement existant valide par un test ne change.
- Date : 2026-09-20

---

## Decision 40 - Signaux de ranking sans donnees reelles : poids a 0,
  jamais de valeur inventee

- Contexte : `01_SPEC_PRODUCT.md` #14 liste 13 signaux de matching. Neuf
  ont une donnee reelle en Phase 5 (competences, services, zone,
  distance, urgence, experience, niveau de verification, disponibilite,
  exposition passee). Quatre n'en ont aucune : **reputation**,
  **fiabilite** et **historique** dependent de `Review`/
  `ReputationSnapshot` (Phase 10), **charge actuelle** depend
  d'`Intervention` (Phase 8).
- Options : A. Fabriquer une valeur plausible (note par defaut, charge
  estimee) pour que les 13 signaux "fonctionnent" / B. Retirer les 4
  signaux du schema jusqu'a la Phase 8/10 / C. Les garder dans
  `MatchingWeightsSchema` et `ScoreBreakdownSchema`, avec un poids **0**
  dans la configuration semee et un commentaire explicite
- Choix : C (valide explicitement par l'utilisateur avant le "GO PHASE 5").
- Raison : A serait exactement la donnee fabriquee interdite par
  03_AGENT_PROTOCOL.md #2 - et un score de reputation invente
  influencerait de vraies mises en relation. B obligerait a modifier le
  contrat ET la configuration en Phase 8/10. Avec C, activer la
  reputation sera un simple `PATCH /configuration`, sans changement de
  code ni de contrat. Le calcul les multiplie deja : `0 x signal = 0`,
  aucun cas particulier.
- Trade-offs : Quatre cles toujours nulles dans chaque `scoreBreakdown`
  stocke - bruit assume, verifie par un test dedie qui echouerait si une
  valeur non nulle y apparaissait.
- Date : 2026-09-20

---

## Decision 41 - `requiredSkillIds` d'une complexite : filtre dur, donc
  aucun poids "couverture de competences"

- Contexte : `01_SPEC_PRODUCT.md` #8 attache des `requiredSkillIds` a une
  `Complexity` (ex. "Certification haute tension"), et #14 cite les
  competences parmi les criteres de matching - ce qui laisse le choix
  entre un filtre et un critere de classement.
- Options : A. Couverture partielle autorisee, ponderee dans le score (un
  fournisseur a qui il manque une certification reste contactable, moins
  bien classe) / B. Filtre dur : le fournisseur doit detenir **toutes**
  les competences requises
- Choix : B.
- Raison : Une competence declaree "requise" pour une intervention
  electrique complexe est une question de securite, pas de preference -
  la degrader en penalite de classement reviendrait a envoyer quand meme
  la demande a quelqu'un de non qualifie si personne d'autre n'est
  disponible. Consequence directe : un poids "couverture de competences"
  vaudrait toujours 1 chez les candidats eligibles ; il a donc ete retire
  du schema plutot que de laisser un poids decoratif. Les 5 poids reels
  restants somment a 1.
- Trade-offs : Marche mince = moins de candidats eligibles ; c'est
  l'expansion de rayon (#18) qui sert de soupape, pas l'assouplissement
  des competences. Teste reellement (`matching.e2e.test.ts` : un
  fournisseur sans la competence requise n'est jamais contacte).
- Date : 2026-09-20

---

## Decision 42 - `ProviderAvailabilityStatus` : les 7 statuts au contrat,
  4 seulement reglables par le fournisseur

- Contexte : `01_SPEC_PRODUCT.md` #16 definit 7 statuts (`OFFLINE`,
  `AVAILABLE`, `BUSY`, `ON_THE_WAY`, `ARRIVED`, `IN_SERVICE`, `PAUSED`)
  et precise que "lorsqu'une intervention active existe, le systeme peut
  modifier automatiquement l'etat". Aucune `Intervention` n'existe avant
  la Phase 8.
- Choix : les 7 statuts sont dans le contrat
  (`ProviderAvailabilityStatusSchema`), mais
  `PATCH /providers/me/availability` n'accepte que
  `PROVIDER_SELF_SETTABLE_STATUSES` = `OFFLINE`/`AVAILABLE`/`BUSY`/
  `PAUSED`. Les trois autres sont pilotes par l'intervention en Phase 8.
- Raison : Meme logique que la Decision 35 - laisser un fournisseur se
  declarer `IN_SERVICE` sans aucune intervention reelle serait un etat
  mensonger. L'eligibilite du matching ne retient que `AVAILABLE` : tout
  autre statut signifie "pas maintenant".
- Trade-offs : Le statut par defaut est `OFFLINE`, donc un fournisseur
  cree en Phase 3 n'est pas matchable tant qu'il ne s'est pas declare
  disponible - voulu (ne jamais dispatcher vers quelqu'un qui n'a rien
  demande), mais a rendre visible dans l'onboarding fournisseur d'une
  phase ulterieure.
- Date : 2026-09-20

---

## Decision 43 - La queue BullMQ `matching` tourne dans `apps/api`, pas
  dans `apps/worker`

- Contexte : le dispatch progressif (#15) a besoin d'un vrai minuteur
  "attendre, puis envoyer la vague suivante". `apps/worker` existe depuis
  la Phase 1 mais n'a **que** Redis : aucune connexion Mongo, aucun acces
  au catalogue, aux profils fournisseur ni a la verification.
- Options : A. Donner Mongoose a `apps/worker` (duplication des schemas
  ou extraction d'un package de persistance partage) / B. Heberger le
  `Worker` BullMQ dans `apps/api`, aux cotes du domaine qu'il pilote
- Choix : B (valide explicitement par l'utilisateur avant le "GO PHASE 5").
- Raison : A serait de l'infrastructure prematuree (Decision 1 :
  monolithe modulaire, "extraction future possible") pour deplacer un
  simple declencheur. Le processeur ne fait qu'appeler
  `DispatchService.runBatch` - le jour ou un package de persistance
  partage sera justifie (Phase 9+), le deplacer vers `apps/worker` ne
  changera pas cette logique. `apps/worker` garde donc sa seule queue de
  diagnostic (Decision 9) ; `matching` est la **premiere vraie queue
  metier** du projet.
- Trade-offs : L'horloge du dispatch vit dans le processus HTTP -
  plusieurs instances d'API consommeraient la meme queue (BullMQ le
  gere), mais le decouplage "API scalable independamment du travail de
  fond" reste a faire en Phase 15.
- Date : 2026-09-20

---

## Decision 44 - Configuration metier en base (`SystemConfiguration`) +
  endpoint ADMIN/MANAGER, sans ecran

- Contexte : `01_SPEC_PRODUCT.md` #97 exige que rayons, ponderations,
  seuils et regles de transport soient **administrables** et "ne pas
  hardcoder ces regles dans les composants". La Phase 5 introduit les
  premieres vraies regles reglables du produit.
- Options : A. Variables d'environnement (comme `MIN_PROVIDER_AGE`) /
  B. Collection Mongo `system_configuration` (agregat prevu par #98),
  semee via `SeedLockService` (Decision 31), lue de maniere typee par le
  moteur, modifiable par `PATCH /configuration` derriere
  `@Roles("ADMIN","MANAGER")`
- Choix : B (valide explicitement par l'utilisateur avant le "GO PHASE 5").
- Raison : Une variable d'environnement n'est pas administrable a chaud
  et impose un redeploiement pour ajuster un rayon. La configuration est
  **revalidee par Zod a chaque lecture et avant chaque ecriture** : un
  document modifie a la main ne peut pas injecter des poids absurdes dans
  le moteur silencieusement. Pas d'ecran d'administration : le dashboard
  complet reste la Phase 12 (06_SCOPE.md).
- Trade-offs : Tracabilite minimale (`updatedBy`/`updatedAt` sur le
  document) plutot qu'un vrai `AuditLog` - cet agregat arrive en Phase
  10/12, et #97 demande un audit des modifications importantes ; a
  completer a ce moment-la.
- Date : 2026-09-20

---

## Decision 45 - `packages/ui` : design system maison, style par feuille
  CSS a tokens plutot que par classes Tailwind

- Contexte : `01_SPEC_PRODUCT.md` #82 demande un design system partage
  entre `apps/web` et `apps/admin`. Les presets `react-library.json`
  (tsconfig) et `react` (eslint) existaient depuis la Phase 1 sans aucun
  consommateur ; `packages/ui` est le premier.
- Options (style) : A. Classes Tailwind dans les composants (chaque app
  doit alors declarer le package comme source a scanner) / B. Feuille de
  style `@fixiyi/ui/css` exportee, ecrite avec les variables
  `--fixiyi-*` de `@fixiyi/design-tokens` - meme mecanisme d'export que
  ce package
- Choix : B.
- Raison : Le design system ne depend d'aucun framework CSS cote
  consommateur, et les pseudo-classes indispensables a l'accessibilite
  (`:focus-visible`) ne sont pas exprimables en styles inline. Trois
  contraintes sont **verifiees par un test** (`styles.test.ts`) plutot
  que promises : aucune couleur codee en dur (tout vient des tokens),
  aucune propriete directionnelle physique (donc RTL correct par
  construction), et les invariants WCAG 2.2 AA (focus visible >= 2px,
  cibles >= 24px, `prefers-reduced-motion`).
- Autres choix notables : le bundle porte une directive `"use client"`
  ajoutee par `tsup` (esbuild supprime les directives par fichier lors
  du bundling, et tous ces composants sont interactifs) ; pas de
  `@testing-library/jest-dom` (assertions DOM natives, une dependance et
  un fichier de setup en moins) ; Testing Library ne s'auto-nettoyant pas
  sans `globals: true`, le `cleanup()` est enregistre explicitement dans
  `src/test-setup.ts` - sans lui chaque rendu fuyait dans le test suivant.
- Trade-offs : Pas d'utilitaires Tailwind courts dans les composants du
  DS (les apps continuent d'utiliser Tailwind pour leur mise en page) ;
  8 composants seulement (Button, Input, Card, Badge, Loading,
  EmptyState, ErrorState, Modal), volontairement le strict necessaire
  aux ecrans existants. `Modal` est rendu en place plutot que dans un
  portail : l'overlay est `position: fixed`, et un portail exigerait des
  gardes client-only pour rester compatible SSR.
- Date : 2026-09-20

---

## Decision 46 - Quatre bugs reels de la Phase 5, dont trois invisibles
  hors execution reelle

- Contexte : comme en Phase 4 (Decision 39), les bugs les plus couteux
  n'ont ete reveles que par de l'execution reelle - infrastructure reelle
  et navigateur reel.
  1. **`RolesGuard` ignorait un `@Roles` pose au niveau classe**. Le
     garde ne lisait que `context.getHandler()` ; un controleur entier
     decore `@Roles("ADMIN","MANAGER")` aurait donc ete **ouvert a tout
     utilisateur authentifie**. Revele par TypeScript en posant le
     decorateur sur `ConfigurationController` (le type `MethodDecorator`
     a refuse l'usage au niveau classe), pas par un test. Corrige :
     `getAllAndOverride([getHandler(), getClass()])`, type du decorateur
     elargi, et test de non-regression dedie.
  2. **BullMQ refuse un id de job contenant `:`** ("Custom Id cannot
     contain :"). L'id deterministe `${matchId}:${batchIndex}` faisait
     echouer CHAQUE dispatch AUTO avec une 500 - apres insertion des
     candidats, donc invisible pour les tests qui ne verifiaient que les
     candidats. Corrige en `${matchId}-batch-${index}`.
  3. **Les pages authentifiees redirigeaient vers `/login` avant
     l'hydratation de zustand**. L'effet de redirection s'executait sur
     le premier rendu, avant que `persist` n'ait relu `localStorage` :
     tout rafraichissement d'une page authentifiee deconnectait une
     session parfaitement valide. Invisible jusqu'ici car la Phase 4 ne
     naviguait qu'apres login dans la meme session. Corrige par un hook
     `useAuthHydrated()` (`useSyncExternalStore` sur
     `persist.onFinishHydration`, sans `setState` dans un effet), dans
     `apps/web` **et** `apps/admin`.
  4. **Interference de donnees entre tests e2e** : les fournisseurs
     etant globaux et persistants dans la base de test partagee, ceux
     d'un test remplissaient le batch du suivant. Meme classe de probleme
     que la Decision 32, mais par les donnees et non par des compteurs.
     Corrige en donnant a chaque test **son propre sous-arbre catalogue**
     (cree via la vraie API admin) : un fournisseur d'un autre test
     n'offre alors tout simplement pas le service concerne.
- Trade-offs : Aucun - corrections strictement correctives. (1) et (3)
  sont des corrections de securite/experience qui depassent le perimetre
  de la Phase 5 mais touchaient du code existant.
- Date : 2026-09-20

---

## Decision 47 - Back-office : la creation de noeud passe de `window.prompt()`
  a un `Modal` + `Input` du design system

- Contexte : La Decision 34 acceptait `window.prompt()` pour nommer un
  noeud du catalogue - "genuinement l'appel a la vraie API avec la vraie
  validation, juste une UX non polie". C'etait un compromis raisonnable
  quand `packages/ui` n'existait pas encore. Il existe depuis la Phase 5,
  et le prompt natif n'est pas seulement "non poli" : il est
  intraduisible (donc incompatible avec fr/en/ar/ary,
  01_SPEC_PRODUCT.md #5), instylable, il bloque la boucle d'evenements,
  plusieurs navigateurs le suppriment silencieusement dans certains
  contextes, et il n'expose aucun libelle exploitable par un lecteur
  d'ecran.
- Options : (a) garder `window.prompt()` jusqu'a la Phase 12 (Admin) ;
  (b) le remplacer maintenant par le `Modal` + `Input` deja livres et
  deja testes.
- Choix : (b).
- Raison : Le composant existe, il est teste (piege de focus, `Escape`,
  `aria-labelledby`, retour du focus au declencheur), et le remplacement
  ne coute que quelques lignes d'etat local. Laisser un `window.prompt()`
  dans un produit qui se declare accessible WCAG 2.2 AA et multilingue,
  alors que le remplacant est deja dans le depot, aurait ete une dette
  gratuite.
- Trade-offs : Un peu d'etat local en plus dans la page catalogue
  (`pendingNode`, `nodeName`, `nameError`) la ou le prompt etait
  synchrone. En echange : validation de nom vide affichee dans le champ
  plutot que silencieuse, et annulation explicite.
- Date : 2026-09-21

---

## Decision 48 - `tokens.css` et `tokens.ts` : la synchronisation devient un
  test, pas une intention

- Contexte : La Phase 1 notait dans `tokens.css` "Kept in sync by hand
  for now ; revisit with a generator if drift becomes a real problem".
  La derive a eu lieu : `spacing`, `shadows`, `typography`, `zIndex` et
  `motion.easing` existaient dans `tokens.ts` et etaient **absents** de
  `tokens.css`. Consequence concrete : `packages/ui/src/styles.css`
  codait en dur ses ombres (`0 1px 2px rgb(0 0 0 / 6%)`), ses tailles de
  texte (`font-size: 14px`) et son `z-index: 50`, tout en pretendant ne
  consommer que des tokens - et le test d'invariant existant ne l'a pas
  vu parce qu'il ne cherchait que des couleurs hexadecimales.
- Options : (a) generer `tokens.css` depuis `tokens.ts` au build ;
  (b) garder deux fichiers ecrits a la main et faire echouer le build
  quand ils divergent.
- Choix : (b).
- Raison : Priorite 1 de 05_DECISION_POLICY.md, la simplicite. Un
  generateur ajoute une etape de build, un artefact genere a committer ou
  a ignorer, et une source de verite invisible dans le diff. Le test
  parse reellement `tokens.css` et verifie les deux sens (tout token TS a
  sa variable CSS avec la meme valeur ; toute variable CSS a son token
  TS), ce qui attrape exactement la meme classe de bug pour une fraction
  du cout. `breakpoints` est exclu explicitement : une custom property
  CSS ne peut pas servir dans une `@media`, l'exposer serait mensonger.
- Trade-offs : Deux fichiers restent a editer pour ajouter un token. Le
  test le rappelle immediatement au lieu de laisser la derive s'installer
  six mois.
- Date : 2026-09-21

---

## Decision 49 - Le mouvement est une couche a part, neutralisee en bloc sous
  `prefers-reduced-motion`

- Contexte : Les animations de la Phase 5 vivaient dans `styles.css`
  melangees aux composants (`fx-spin`, `fx-pulse`), et l'exemption
  `prefers-reduced-motion` listait nommement les deux classes
  concernees. Toute animation ajoutee plus tard aurait du penser a
  s'ajouter a cette liste - c'est-a-dire qu'elle aurait ete oubliee.
- Options : (a) continuer a enumerer les exemptions au cas par cas ;
  (b) isoler le mouvement dans `src/styles/animations.css` avec une regle
  d'exemption unique couvrant tous les utilitaires `.fx-animate-*`, et un
  test qui echoue si un utilitaire n'y figure pas.
- Choix : (b).
- Raison : WCAG 2.2 AA 2.3.3 n'est pas tenu par une bonne intention mais
  par une regle qu'on ne peut pas oublier d'appliquer. Le test
  `animations.test.ts` extrait la liste reelle des classes
  `.fx-animate-*` du fichier et verifie que **chacune** apparait dans le
  bloc `prefers-reduced-motion` ; ajouter une animation sans son
  exemption casse le build.
- Detail non evident : l'exemption pose `animation: none` et **pas**
  `animation-duration: 0.01ms`. Les utilitaires sont remplis en `both` ;
  une duree quasi nulle laisserait un `fade-in` fige sur son etat `from`,
  donc `opacity: 0` - l'element resterait invisible pour l'utilisateur
  qui a justement demande moins de mouvement.
- RTL : le glissement directionnel est exprime sur l'axe inline
  (`--fx-slide-offset`, negatif sous `[dir="rtl"]`) et non en
  `translateX` fixe ; les icones dont le sens depend de la direction de
  lecture (la fleche) portent `fx-icon--directional` et sont mirrorees
  sous `[dir="rtl"]`. Une fleche "suivant" non retournee pointe vers
  l'etape precedente en arabe.
- Trade-offs : Un fichier CSS de plus, importe par `styles.css` pour que
  les applications gardent un point d'entree unique (`@fixiyi/ui/css`).
  Verifie sur le vrai build Next.js : les 6 `@keyframes`, les 7
  utilitaires, les 2 blocs `prefers-reduced-motion` et les 2 regles
  `[dir="rtl"]` sont bien presents dans le CSS compile.
- Date : 2026-09-21

---

## Decision 50 - `Select` et `RadioGroup` ajoutes au design system plutot que
  reecrits dans chaque ecran

- Contexte : `apps/web` reimplementait un `<select>` habille en
  `fx-field__control` avec son `<label htmlFor>` ecrit a la main
  (composant local `LevelSelect`, utilise 5 fois dans le seul formulaire
  de demande), et une paire de `<input type="radio">` nus dans un
  `<fieldset>` pour l'urgence - cibles de 16px, etat selectionne porte
  par la seule puce native, focus invisible.
- Options : (a) laisser ces controles dans les pages ; (b) les remonter
  dans `@fixiyi/ui`.
- Choix : (b), avec 17 tests dedies.
- Raison : C'est exactement le motif qui a coute deux corrections
  identiques en Phase 4 (Decision 39, bug `Content-Type` corrige
  separement dans `apps/web` et `apps/admin`). Un controle de formulaire
  duplique est un cablage d'accessibilite duplique, donc une occasion
  dupliquee de l'oublier.
- Details tenus par les composants plutot que par l'appelant : `Select`
  se desactive tout seul quand sa liste d'options est vide (un niveau de
  cascade sans enfant n'est pas un jugement que l'appelant doit penser a
  passer) ; `RadioGroup` est generique sur son type de valeur, donc
  `onChange` rend `"NORMAL" | "URGENT"` et non `string`, et chaque option
  est un libelle cliquable de 44px (WCAG 2.2 AA 2.5.8) dont l'anneau de
  focus est pilote par `:has(input:focus-visible)`.
- Trade-offs : Aucun sur le comportement observable - les `data-testid`
  des 5 selects et du formulaire sont inchanges, les deux scenarios
  Playwright passent sans modification.
- Date : 2026-09-21

---

## Decision 51 - Rafraichissement du token cote client : une seule requete en
  vol, partagee par tous les appels qui prennent un 401

> Numerotation : la mission demandait « Decision 47 ou 48 » pour ce point et
> « Decision 49 » pour l'upload. Les numeros 47 a 50 etaient deja pris par la
> refonte du design system du tour precedent. Ce sont donc 51 et 52.

- Contexte : Bug B1 de `docs/INSPECTION_ECC_PHASE_0_5.md`. `apps/web` et
  `apps/admin` persistaient un `refreshToken` dans `localStorage` et ne
  l'utilisaient **jamais** : aucun appel a `POST /api/v1/auth/refresh`
  n'existait cote client, alors que l'endpoint existait cote API, complet
  et rate-limite (60/h). Passe `JWT_ACCESS_TTL` (15 min), chaque appel
  authentifie prenait un 401 `"Invalid or expired access token"`, et rien
  ne recuperait : la session morte restait en `localStorage`
  indefiniment, sans meme un retour vers `/login`.
- Options : (a) rejouer la requete apres un refresh, appel par appel ;
  (b) rejouer apres un refresh, mais avec **une seule requete de refresh
  en vol** partagee par tous les appelants simultanes ; (c) rafraichir
  preventivement sur un minuteur base sur `expiresIn`.
- Choix : (b).
- Raison : (a) est activement dangereux ici, et c'est le point non
  evident de cette correction. Le refresh token **tourne** a chaque
  usage, et `SessionService` traite la re-presentation d'un token deja
  tourne comme un rejeu : il revoque **toute la session**
  (`REUSE_DETECTED`). Or `/requests/new` declenche plusieurs appels
  authentifies au montage ; avec (a), N appels expirant ensemble
  lanceraient N refresh paralleles, dont N-1 presenteraient un token
  deja consomme — la « correction » deconnecterait l'utilisateur plus
  surement que le bug. Tous les appelants attendent donc la meme promesse
  (`refreshInFlight`) et rejouent avec le token que ce refresh unique a
  produit. (c) ajoute un minuteur a maintenir et ne couvre pas le cas
  d'une machine qui sort de veille avec un token deja expire.
- Details : `POST /auth/refresh` ne renvoie que des tokens
  (`AuthTokensSchema`), pas l'utilisateur ; le store recoit donc un
  nouvel `setTokens` qui preserve le `user` deja connu, au lieu de
  detourner `setSession`. En cas d'echec du refresh, on appelle
  simplement `clearSession()` : toutes les pages authentifiees
  redirigent deja vers `/login` quand `user` devient nul, donc aucune
  navigation `window.location` n'est necessaire — et aucune ne serait
  sure cote SSR depuis ce module.
- Dette assumee : le correctif est ecrit **deux fois**,
  `apps/web/src/lib/api-client.ts` et `apps/admin/src/lib/api-client.ts`,
  conformement a la demande explicite de l'utilisateur. L'extraction dans
  un package partage reste recommandee : ces deux fichiers sont
  identiques a deux commentaires pres, et la Decision 39 a deja fait
  payer cette duplication une fois (bug `Content-Type` corrige
  separement dans les deux apps).
- Tests : `tests/browser/tests/session-refresh.spec.ts`, 2 scenarios
  reels contre la stack Docker. Le premier verifie qu'un token expire est
  rattrape de facon transparente (**exactement un** appel a
  `/auth/refresh`, l'ecran se remplit, le token stocke a bien tourne) ;
  le second qu'une session dont le refresh token est mort aussi est
  purgee et renvoyee vers `/login` au lieu de laisser l'utilisateur
  bloque.
- Trade-offs : Un 401 legitime sur une route authentifiee coute
  desormais un aller-retour de refresh avant de remonter. Acceptable :
  c'est le cas rare, et l'alternative etait de casser toute session de
  plus de 15 minutes.
- Date : 2026-09-21

---

## Decision 52 - La taille declaree d'un media est signee dans l'URL
  presignee, et un media rejete voit son objet supprime

- Contexte : Bug B2 de `docs/INSPECTION_ECC_PHASE_0_5.md`. Precision
  utile, parce que la mission decrivait le probleme autrement :
  `MediaService.createUploadSession` **verifiait deja**
  `declaredSizeBytes <= MEDIA_MAX_SIZE_BYTES[kind]` et renvoyait
  `MEDIA_SIZE_LIMIT_EXCEEDED` — depuis la Phase 4. Le trou reel etait
  ailleurs : cette verification portait sur une **declaration**, et
  l'URL presignee emise ensuite n'imposait aucune taille. Un client
  pouvait declarer 1 Ko, passer le controle, puis PUT plusieurs Go
  directement sur MinIO. L'exces n'etait constate qu'au `finalize`,
  c'est-a-dire **apres** que les octets soient stockes — et comme aucun
  `DeleteObjectCommand` n'existait dans tout le depot, l'objet rejete
  restait dans le bucket pour toujours, reference par rien.
- Options : (a) garder la verification declarative et ajouter un
  nettoyage differe (balayage periodique des objets orphelins) ;
  (b) signer `ContentLength` dans l'URL presignee pour que le stockage
  lui-meme refuse un PUT de taille differente, et supprimer l'objet au
  moment du rejet.
- Choix : (b).
- Raison : (a) laisse la fenetre grande ouverte entre le PUT et le
  balayage — c'est exactement le scenario de saturation. (b) deplace
  l'application de la regle du code applicatif vers le stockage : S3/MinIO
  incluent `content-length` dans la signature, donc un PUT qui annonce
  une autre taille est refuse **avant** que les octets ne soient acceptes.
  Verifie reellement : MinIO repond `403 SignatureDoesNotMatch`, et
  `objectExists` confirme que rien n'a ete ecrit.
- Limite assumee et documentee : signer `ContentLength` impose une taille
  **exacte**, pas un plafond. `MediaService` connait la taille
  (`sizeBytes` fait partie de `CreateUploadSessionInput`), donc il en
  beneficie. `VerificationService` ne la connait pas — son
  `RequestDocumentUploadInput` ne porte pas de taille — donc ses uploads
  restent non bornes. Le parametre est optionnel et le commentaire de
  `createPresignedUploadUrl` dit explicitement pourquoi. Plafonner sans
  taille exacte demande une POST policy (`content-length-range`), ce qui
  transforme l'upload d'un PUT en formulaire multipart : c'est un lot de
  travail separe, deliberement **pas** glisse en douce dans cette
  correction. Remonte comme reste-a-faire dans
  `docs/PRE_PHASE_6_REPORT.md`.
- Suppression au rejet : `reject()` efface l'objet en plus de marquer le
  document `REJECTED`. La suppression est **best-effort** — un incident
  de stockage ne doit pas transformer un rejet propre en 500 — donc elle
  est journalisee et avalee, et le document garde son statut `REJECTED`
  dans tous les cas, ce qui est ce que le client voit.
- Effet de bord revelateur : un test existant declarait `sizeBytes: 20`
  tout en envoyant 26 octets. Personne ne s'en souciait tant que la
  taille declaree n'engageait rien ; elle engage desormais, donc le test
  a du dire la verite. C'est exactement la classe de mensonge silencieux
  que la correction supprime.
- Tests : `apps/api/test/request.e2e.test.ts` passe de 7 a 9 tests — un
  PUT plus gros que la taille declaree est refuse par le stockage (403,
  aucun objet ecrit, `finalize` renvoie ensuite `MEDIA_NOT_UPLOADED`), et
  l'objet d'un media rejete pour signature invalide n'existe plus apres
  le rejet. L'overshoot du test est volontairement petit : avec un corps
  d'un megaoctet, le serveur refuse la connexion avant que le client ait
  fini d'ecrire et `undici` se bloque au lieu de remonter la reponse —
  artefact client d'un upload refuse, pas une assertion plus faible.
- Date : 2026-09-21

---

## Decision 53 - Anti-contact : le deverrouillage est un point d'accroche de
  service, jamais une route ; « visible apres » = le numero VERIFIE du compte

- Contexte : 01_SPEC_PRODUCT.md #27 masque les coordonnees « avant
  acceptation » et autorise « le numero autorise » « apres acceptation » —
  d'une **offre**. Les offres sont la Phase 7. Le critere de sortie de la
  Phase 6 exige pourtant de prouver « masque avant, visible apres ».
- Options : (a) une route HTTP « debloquer » ; (b) repousser l'anti-contact
  en Phase 7 ; (c) un etat `contactPolicy` sur la conversation et une
  methode de service unique `ConversationService.unlockContact`, non
  exposee en HTTP, que l'acceptation d'offre appellera.
- Choix : (c).
- Raison : (a) annule la protection (un fournisseur l'appellerait
  lui-meme) et serait un faux workflow (03_AGENT_PROTOCOL #2). (b) viole le
  critere de sortie. (c) est le vrai chemin de code que la Phase 7
  empruntera (l'evenement `OfferAccepted` est deja declare dans
  `@fixiyi/contracts`) ; les tests l'appellent par injection de
  dependances. Un test verifie qu'aucune route `/unlock` ou `/contact`
  n'existe.
- Lecture retenue de « visible apres » : la conversation expose le
  **telephone verifie du compte** de l'autre partie (« le numero
  autorise », suivi de « Fixiyi ne fournit pas de VoIP ») et les messages
  suivants ne sont plus masques. Les messages masques **avant** restent
  masques : l'original n'est **jamais stocke**, seule la trace de la
  tentative l'est (`redactions: [{type}]`). C'est la seule garantie
  qu'aucune lecture, recherche, export ou bug futur ne le fasse fuiter —
  verifie en base : 0 numero brut dans les messages stockes.
- `unlockContact` cree la conversation si les parties n'ont jamais
  echange avant l'offre, et est idempotent (le premier horodatage est
  conserve).
- Trade-offs : un numero tape avant l'acceptation ne reapparait jamais,
  meme apres. Assume : le numero verifie du compte le remplace, et c'est
  le seul dont Fixiyi garantit l'identite.
- Date : 2026-09-21

---

## Decision 54 - Detection des coordonnees : validation par plan de
  numerotation, carte d'offsets en unites UTF-16

- Contexte : #27 demande de detecter numeros, emails, URLs, tentatives de
  contournement et « variantes textuelles evidentes ». Un detecteur trop
  large rend le chat inutilisable (il masquerait « 1500 DH », « 14h30 »,
  une date, un RIB) ; trop etroit, il est contourne en ecrivant
  « zero six douze... ».
- Choix :
  1. Les candidats telephone sont **confirmes par `libphonenumber-js`**
     (deja une dependance, region `MA` par defaut) au lieu d'un compte de
     chiffres. C'est ce qui garde propres les prix, heures, dates,
     adresses, RIB, compteurs, numeros de serie — 24 cas de faux positifs
     sont epingles en test.
  2. Variantes : chiffres arabes-indiens, persans et pleine largeur ;
     nombres en lettres en francais (y compris par paires : soixante-dix,
     quatre-vingt-dix-neuf), anglais, darija latine (arabizi) et arabe ;
     lettres sosies (`O`, `l`, `I`) ; espaces insecables (`\p{Zs}`, dont
     l'espace fine insecable de la typographie francaise), jamais un saut
     de ligne.
  3. Un numero colle a un autre nombre (« 300 0612345678 ») est isole en
     cherchant la plus longue sous-suite valide de groupes.
  4. Emails obfusques (`(at)`, `arobase`, `point`...) retenus seulement
     s'ils forment une adresse complete — sinon « at » et « point »
     seraient masques dans des phrases ordinaires.
  5. La mention d'une plateforme (« whatsapp », « insta ») est
     **journalisee**, pas masquee : le mot n'est pas une coordonnee.
- Detail d'implementation non evident : le masquage s'applique au texte
  **original** via une carte d'offsets tenue en **unites UTF-16**. Une
  premiere version iterait par point de code ; un seul emoji en debut de
  message decalait alors tous les offsets et masquait les mauvais
  caracteres. Corrige avant tout test, puis epingle par un test.
- Applique aux envois, aux **editions** (sinon l'edition devient le
  contournement) et aux **noms de pieces jointes**, avant que la ligne
  media n'existe (le nom stocke et la cle d'objet ne contiennent jamais la
  coordonnee).
- Limite : pas d'OCR — un numero ecrit dans une photo passe (aucun
  fournisseur provisionne ; l'IA est la Phase 11).
- Date : 2026-09-21

---

## Decision 55 - Temps reel : HTTP ecrit, la socket notifie ; salles par
  utilisateur ; adaptateur Redis

- Contexte : #49 — « le WebSocket n'est jamais la source de verite ». #50 —
  reconnexion, evenements manquants, idempotence, deduplication.
- Choix :
  - **Toutes les mutations passent par HTTP** : memes guards, meme
    validation Zod, meme rate limiting, memes erreurs Problem Details. La
    socket ne transporte que des notifications serveur -> client, plus un
    seul evenement client -> serveur ephemere, `typing`.
  - **Salles par utilisateur** (`user:<id>`), rejointes a la connexion. Le
    serveur decide qui recoit quoi d'apres les participants en base ; un
    client ne demande jamais a rejoindre une conversation, donc ne peut pas
    rejoindre celle d'un autre.
  - **Authentification a la poignee de main** (meme regle qu'`AuthGuard` :
    token valide ET session active), et un **balayage** periodique qui
    deconnecte les sockets dont la session a ete revoquee — une requete
    groupee par balayage, pas une par socket. Un logout distant coupe donc
    aussi le temps reel.
  - **Rattrapage** : `seq` monotone par conversation ; au retour le client
    demande `?after=<dernier seq>` a l'API. **Deduplication** : cle par id,
    la plus haute `version` gagne. **Idempotence** : `clientMessageId`.
  - **Adaptateur Redis** : une seule instance aujourd'hui, mais sans lui un
    second replica separerait silencieusement les utilisateurs.
- Raison : c'est l'application litterale de #49, et c'est aussi le plus
  simple — aucune logique d'ecriture dupliquee entre HTTP et socket.
- Suite de la Decision 51 : la socket relit le token a chaque
  (re)connexion et, sur refus `UNAUTHORIZED`, rafraichit via **la meme
  promesse unique** que HTTP — deux refresh concurrents declencheraient la
  detection de rejeu.
- Date : 2026-09-21

---

## Decision 56 - Nouvelles dependances temps reel

- `apps/api` : `@nestjs/websockets` et `@nestjs/platform-socket.io`
  (12.0.3, alignes sur Nest 12), `socket.io` (4.8.3),
  `@socket.io/redis-adapter` (8.3.0). `apps/api` (dev) et `apps/web` :
  `socket.io-client` (4.8.3).
- Raison : Socket.IO est **nomme** par la stack cible (01_SPEC_PRODUCT.md
  #52) et par l'IMPLEMENTATION_PLAN valide pour la Phase 6 ; ce n'est pas
  un choix de stack nouveau. Versions stables courantes, compatibilite
  verifiee avec les pairs de Nest 12 avant installation.
- Date : 2026-09-21

---

## Decision 57 - Accuses par filigranes, vues calculees par l'API pour
  chaque lecteur

- Contexte : sent / delivered / read (#26) pour chaque message.
- Choix : quatre **filigranes** sur la conversation (`client`/`provider` x
  `Delivered`/`Read`), avances par `$max` et bornes au dernier `seq`.
  « Lu » implique « distribue ». Le statut de chaque message, les dates
  limites d'edition et de suppression sont **calcules par l'API pour le
  lecteur** (`deliveryStatus`, `editableUntil`, `deletableUntil`) ; React
  n'affiche que ce qu'on lui donne (03_AGENT_PROTOCOL #2).
- Raison : dans un echange a deux, « l'autre a tout lu jusqu'a N » repond
  en O(1) pour tous les messages, sans une ligne par message. Un filigrane
  ne recule jamais, donc un accuse repete ou en retard est inoffensif — et
  un accuse qui n'a rien fait avancer n'est pas rediffuse (pas de tempete
  d'evenements).
- Date : 2026-09-21

---

## Decision 58 - Cycle de vie de la conversation lie a la candidature ; le
  client designe une candidature, pas un utilisateur

- Choix :
  - Une conversation lie le client d'une demande et **un fournisseur
    reellement dispatche** dessus (Phase 5) ; unique par
    `(requestId, providerUserId)`, ouverture idempotente.
  - Le client ouvre en nommant un **`candidateId`** : la candidature creee
    par le moteur est en elle-meme la preuve du contact, et une
    candidature d'une autre demande est refusee. (Premiere version :
    `providerUserId` — l'ecran client ne le connaissait meme pas.)
  - Ouvrir la conversation cote fournisseur fait passer la candidature de
    `NOTIFIED` a `VIEWED` — seules les `NOTIFIED` expirent, sinon une
    discussion engagee serait coupee au batch suivant.
  - Envoi refuse (`CONVERSATION_CLOSED`) si la demande est annulee ou la
    candidature declinee/expiree, **sauf** apres deverrouillage : apres
    acceptation, la conversation doit durer jusqu'a l'intervention.
  - Frontieres de module (#51) : le chat ne lit jamais `MatchCandidate` ;
    `MatchingModule` exporte trois requetes etroites.
- Date : 2026-09-21

---

## Decision 59 - Suppression controlee : cachee aux deux parties, conservee
  pour les litiges — **VALIDATION HUMAINE REQUISE**

- Contexte : « suppression controlee » (#26) ; un litige contient « le chat
  pertinent » (02_SPEC_ENGINEERING). Conserver ou purger le contenu d'un
  message supprime est un **choix juridique** (05_DECISION_POLICY :
  validation humaine ; loi marocaine 09-08 sur les donnees personnelles).
- Choix provisoire : l'expediteur peut supprimer son message dans les 24 h ;
  il disparait pour **les deux** participants, mais la ligne est
  **conservee** en base pour les litiges.
- Raison du defaut : c'est le choix **reversible** — un job de purge peut
  s'ajouter plus tard, alors qu'une purge immediate ne se rattrape pas. Et
  le contenu conserve est deja masque s'il etait protege.
- **A confirmer par l'utilisateur** avant la mise en production.
- Date : 2026-09-21

---

## Decision 60 - Rate limiting par utilisateur sur les routes authentifiees

- Contexte : le `RateLimitGuard` ne comptait que par IP. Derriere un NAT —
  ou un NAT d'operateur mobile, courant au Maroc — de nombreux
  utilisateurs partagent une IP : un seul aurait epuise le quota de tous
  (finding B4 de l'inspection).
- Choix : option `key: "user"` (retro-compatible, `ip` par defaut). Le chat
  l'utilise sur toutes ses routes d'ecriture (envoi 30/min, modifications
  60/min, ouverture 20/min, recherche 30/min, upload 20/min). Echec
  **ferme** si la route n'est pas authentifiee : se rabattre en silence sur
  l'IP masquerait une erreur de cablage.
- Limite : B4 n'est corrige que la ou `key: "user"` est utilise ; les
  routes OTP restent a juste titre par IP, et `trustProxy` reste a
  configurer pour la production.
- Date : 2026-09-21

---

## Decision 61 - Six bugs reels trouves pendant la Phase 6

Tous trouves par l'execution, pas par relecture :

1. **Offsets de masquage decales par un emoji** (carte par point de code au
   lieu d'unite UTF-16). Corrige avant tout test, epingle ensuite.
2. **Tests qui passaient a vide** : l'API resout `@fixiyi/contracts` depuis
   son `dist/`, perime ; la constante de masquage valait `undefined`, le
   texte masque contenait « undefined » et les comparaisons par gabarit
   passaient **des deux cotes**. Une seule assertion stricte l'a revele. Un
   test de precondition fait desormais echouer bruyamment un `dist`
   perime.
3. **Numeros de test invalides passe 99 connexions** : un compteur partage
   `runId + 2 chiffres` produisait un numero trop long, refuse en 400 par
   l'OTP, uniquement au 16e test d'un fichier. Numeros aleatoires valides
   desormais.
4. **Classe de caracteres corrompue par l'outillage** : l'echappement
   ` ` devenait un caractere litteral, puis un `sed` l'a transforme en
   `[ \t00a0...]` — admettant `0` et `a` comme separateurs. Les tests
   passaient toujours ; seule la relecture de la ligne l'a montre.
   Remplace par `\p{Zs}`, plus correct de toute facon.
5. **Indicateur « ecrit… » persistant** sous le message deja recu de la
   meme personne, jusqu'au delai d'inactivite. Trouve **dans les captures
   Playwright**. Un message recu l'efface ; envoyer arrete le sien ; un
   test avec un delai plus court que les minuteries le verrouille.
6. **Session Playwright injectee avec un refresh token deja consomme** :
   l'ancien assistant gardait le refresh token d'avant rotation. Latent
   tant qu'aucun 401 ne survenait ; avec la Decision 51, un 401 aurait
   presente un token consomme et revoque la session. Corrige en extrayant
   l'assistant partage.

- Date : 2026-09-21

---

## Decision 62 - Icone et couleur d'affichage sur les noeuds du catalogue
  (refonte Design System V2, D3)

- Contexte : la refonte Design System V2 (mission hors protocole,
  `docs/design/`) affiche les categories de services en tuiles, chacune
  avec une icone et une couleur de metier. Le noeud de catalogue
  (Decision 26 : une collection generique pour tous les niveaux) ne porte
  que `level`, `parentId`, `name`, `description`, `order`, `active`,
  `requiredSkillIds`.
- Options : (a) champs optionnels `icon` et `accentColor` sur le noeud,
  administrables dans le back-office ; (b) correspondance cote interface
  indexee par nom de categorie.
- Choix : (a).
- Raison : (b) casse au premier renommage fait dans le back-office. (a)
  laisse l'administrateur maitre de l'affichage et reste retro-compatible :
  les champs sont optionnels, les noeuds existants restent valides.
- Validation : **modification du modele de donnees principal**, donc
  soumise a validation humaine (05_DECISION_POLICY.md) — **validee par
  l'utilisateur le 2026-09-21**. Non encore implementee.
- A trancher a l'implementation : valeurs admises (icones de la liste
  fermee du Design System, couleurs limitees a la palette metiers) et
  heritage (un noeud sans valeur prend celle de son ancetre le plus
  proche).
- Detail : `docs/design/DECISIONS.md`, D3.
- Date : 2026-09-21

---

## Decision 63 - Rate limit par utilisateur sur TOUTES les routes d'ecriture

- Contexte : audit du 2026-09-21. La Decision 60 n'avait equipe que le
  chat ; 30 routes d'ecriture sur 46 n'avaient aucun quota (demandes et
  uploads, dispatch du matching, verification, entreprises, profil,
  catalogue, configuration, compte, accuses et finalisation du chat).
  C'etait la partie « rate limit » du finding B2 de l'inspection, jamais
  corrigee hors chat.
- Choix : un quota `key: "user"` par usage et par controleur (par minute :
  ecriture de demande 30, upload 20, dispatch 10, candidature 60,
  verification 20, entreprise 20, profil 30, catalogue admin 60,
  configuration 20, compte 20, accuses du chat 120, finalisation 20). Les
  trois routes non authentifiees (OTP, refresh) restent par IP ; `email`
  (authentifiee) passe de l'IP a l'utilisateur (B4).
- Garde-fou : `apps/api/src/common/rate-limit-coverage.test.ts` lit les
  metadonnees de tous les controleurs et echoue si une route d'ecriture
  n'a pas de quota, ou pas la bonne cle.
- Date : 2026-09-21

---

## Decision 64 - Secrets de signature controles au demarrage en production

- Contexte : audit du 2026-09-21. `JWT_SECRET`, `JWT_REFRESH_SECRET` et
  `OTP_SECRET` n'etaient controles que sur 16 caracteres ; la valeur
  publique de `.env.example` (42 caracteres) passait. Un deploiement qui
  l'oublie permet de forger un jeton pour n'importe quel utilisateur ou
  role.
- Choix : en `NODE_ENV=production` seulement, refus des valeurs d'exemple
  (`CHANGE_ME`, `not_for_production`), 32 caracteres minimum, et les trois
  secrets distincts. Le developpement reste permissif : le fichier
  d'exemple demarre toujours une pile locale.
- Date : 2026-09-21

---

## Decision 65 - Ecran de depart selon le role

- Contexte : audit du 2026-09-21. Apres connexion et sur `/`, tout
  utilisateur arrivait sur le formulaire client : la boite fournisseur
  (`/provider/requests`) n'etait joignable qu'en tapant son URL (route
  orpheline, 03_AGENT_PROTOCOL §2).
- Choix : `startRouteFor(user)` (`apps/web/src/lib/start-route.ts`) : un
  fournisseur commence sur sa boite, les autres sur la creation de
  demande ; utilise par l'accueil et la connexion.
- Limite : un fournisseur qui veut aussi commander n'a pas encore de lien
  vers le formulaire. La navigation par role (en-tete, barre basse) est la
  phase 6 de la refonte.
- Date : 2026-09-21

---

## Decision 66 - Jetons de `apps/web` dans `localStorage` : decision ouverte

- Contexte : audit du 2026-09-21 (ecc:react-reviewer). La Decision 33
  accepte des jetons persistes dans `localStorage` pour l'admin interne ;
  la Decision 38 a repris le meme schema pour l'application publique sans
  reexaminer ce compromis. Une faille XSS future permettrait de voler
  une session (refresh de 30 jours).
- Options : (a) garder, avec une politique CSP stricte ; (b) refresh en
  cookie httpOnly (API et web sur le meme site, CORS avec `credentials`) ;
  (c) jetons en memoire seulement (reconnexion a chaque rechargement).
- Statut : **changement d'architecture d'authentification, soumis a
  validation humaine** (05_DECISION_POLICY.md). Rien n'est change ; le
  commentaire du code, qui parlait a tort de stockage en memoire, est
  corrige.
- Date : 2026-09-21

---

## Decision 67 - Page Profil minimale dans la phase 6 de la refonte

- Contexte : la navigation de la phase 6 (refonte design) a besoin d'une
  entree Profil et d'un moyen de se deconnecter : aucun bouton de
  deconnexion n'existe dans `apps/web` ni dans `apps/admin`, alors que
  `POST /auth/logout` existe depuis la Phase 2. `GET /auth/me` existe aussi.
- Options : (a) page Profil minimale des la phase 6 ; (b) pas d'entree
  Profil, deconnexion dans un menu de compte de l'en-tete, vraie page Profil
  plus tard.
- Choix : (a), **decide par l'utilisateur le 2026-09-22**.
- Contenu, et rien d'autre : l'email de l'utilisateur (`GET /auth/me`), un
  bouton « Se deconnecter » (`POST /auth/logout`), un lien « Retour a
  l'accueil ». Aucune edition, aucune fonctionnalite metier.
- Detail : `email` est nullable (la connexion se fait par OTP telephone) ;
  la page affiche alors « Aucun e-mail renseigne » plutot qu'un champ vide.
- Trade-offs : page provisoire, remplacee par la vraie page Profil (phases
  7-8 produit ou phase 7-8 refonte). Le menu de compte de l'en-tete n'est
  plus necessaire dans `apps/web` ; `apps/admin`, sans page Profil, garde un
  bouton de deconnexion dans son en-tete.
- Date : 2026-09-22

---

## Decision 68 - Regles ECC globales : Fixiyi prime, ajouts ECC non adoptes

- Contexte : ECC v2.2.2 installe au niveau du compte (20/09/2026) charge des
  regles `~/.claude/rules/ecc/{common,typescript}/*.md` hors du depot.
  Analyse du 2026-09-22 : 3 contradictions avec Fixiyi (enveloppe
  `{success,data,error}` contre Problem Details, 02 #62 ; cinq documents de
  planification contre un seul `PHASE_X_PLAN.md`, 03 §3 ; agents lances sans
  demande contre le cycle de 08) et des ajouts plus stricts que la spec.
- Choix (**decide par l'utilisateur le 2026-09-22**) :
  - en cas de conflit, **Fixiyi prime**, comme le prevoit
    `08_ECC_INTEGRATION.md` ;
  - **non adoptes pour l'instant** : couverture minimale de 80 %, rate limit
    sur les routes de lecture, recherche externe prealable (GitHub, Context7,
    Exa) ;
  - **appliques quand on les rencontre, sans chasse systematique** : aucun
    `console.log` dans le code de production, fonctions de moins de 50
    lignes.
- Note : `apps/admin/CLAUDE.md` et `AGENTS.md` ne sont pas des regles du
  projet ; ils sont generes par `next dev` (Next.js 16) et commites avec la
  Phase 3 (`0596a3b`). Leur consigne (lire la doc embarquee de Next.js avant
  de coder) est compatible.
- Date : 2026-09-22

---

## Decision 69 - Commit de rollback de `08_ECC_INTEGRATION.md` perime

- Contexte : `08_ECC_INTEGRATION.md` donne comme rollback
  `git reset --hard d84703e` (fin de la Phase 5 produit). L'executer
  effacerait la Phase 6 produit, les correctifs B1/B2, les phases 1 a 5 de la
  refonte et l'audit — et c'est une action destructive soumise a validation
  (03 §2, 05).
- Choix (**decide par l'utilisateur le 2026-09-22**) : le fichier reste tel
  quel pour l'instant ; a la fin de la phase 6 de la refonte, la reference
  sera remplacee par le commit de fin de cette phase. D'ici la, ce rollback
  ne doit **pas** etre utilise, et aucun `reset --hard` n'est lance sans
  accord explicite de l'utilisateur.
- Date : 2026-09-22
