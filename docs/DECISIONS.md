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
