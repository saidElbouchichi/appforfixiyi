# PHASE 11 (REFONTE) — ACCESSIBILITE — PLAN

Date : 2026-09-26. Statut : **GO recu le 2026-09-26, plan complete (§8)**.

> Le §8, ecrit apres le GO, **remplace** le §4 la ou ils divergent : une
> mesure faite apres le redemarrage a montre que le defaut 1 n'etait pas celui
> que je croyais, et qu'un troisieme defaut se cachait derriere un « OK ».

Sources lues : `docs/PROGRESS.md`, `docs/DECISIONS.md` (62 a 79),
`docs/design/PHASE_10_REPORT.md`, `docs/design/PLAN.md` (ligne 22 :
« Accessibilite | audit WCAG 2.2 AA — consolidation »),
`docs/design/AUDIT.md` (§3 : le constat bloquant n°1 etait deja un constat
d'accessibilite — l'orange de la planche echouait AA, d'ou D1),
`docs/prompt/08_ECC_INTEGRATION.md`.

## 1. Methode

Trois instruments, et **chacun verifie avant d'etre cru** — la discipline de
la phase 10, qui a evite d'y « corriger » 22 faux positifs.

| Instrument | Portee |
|---|---|
| **axe-core 4.10.2**, charge depuis un CDN au moment de l'audit (rien ajoute au depot) | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` sur **11 routes x 2 largeurs = 22 mesures** |
| **Mesures de structure** dans le DOM | titres, landmarks, lien d'evitement, `lang`, `<title>` |
| **Mesures de comportement** au clavier | anneau de focus, focus masque (2.4.11), piege clavier, focus apres navigation, dialogue modal, reflow/zoom/espacement |

### 1.1 L'instrument mord-il ?

Un resultat a zero violation ne vaut rien tant qu'on n'a pas montre que le
meme instrument en rapporte quand il y en a. **Quatre fautes connues ont ete
injectees dans la page** (image sans `alt`, bouton sans nom, champ sans
label, texte a 1,07:1) : axe les a nommees toutes les quatre —
`image-alt`, `button-name`, `label`, `color-contrast` — sur la page qui en
rapporte zero sans elles.

### 1.2 Un faux positif, attrape par la verification

Ma mesure d'anneau de focus a d'abord signale **quatre `select` sans
anneau** sur `/requests/new`. Verification : ils sont **desactives**
(`becameActive: false` — le focus ne s'y pose meme pas), parce que la cascade
du catalogue n'est pas encore remplie. Le `select` actif, lui, porte
`outline: solid 2px rgb(234, 88, 12)` — exactement la couleur de focus de D1.

Troisieme phase de suite ou mon instrument a un angle mort, et troisieme fois
que la verification le rattrape avant le rapport.

## 2. Resultat de la mesure

### Ce qui passe

| Critere | Mesure |
|---|---|
| axe-core, WCAG 2.2 AA | **0 violation** sur 22 mesures |
| 1.4.10 Reflow | OK a **320 px** — sous les 360 du perimetre |
| 1.4.4 Zoom 200 % | OK |
| 1.4.12 Espacement du texte | OK avec les surcharges exactes du critere |
| 2.1.1 / 2.1.2 Clavier | 13 arrets, aucun piege, **le lien d'evitement est le premier arret** |
| 2.1.2 Dialogue modal | focus retenu sur 12 tabulations ; `Escape` ferme **et rend le focus au declencheur** |
| 2.4.7 Anneau de focus | present, 2 px `#EA580C` (D1) |
| 2.4.11 Focus non masque (2.2) | aucun element focalise sous l'en-tete ou la barre basse |
| 3.3.8 Authentification (2.2) | `autocomplete="one-time-code"` sur le code, `tel` sur le telephone |
| Structure | 1 `h1` par page, landmarks, `lang`. `<title>` present — **mais identique partout : echec 2.4.2, voir §8.2** |

Le niveau composant etait deja solide avant cette phase : **155 requetes
`getByRole`** et **52 tests** nommes accessibilite dans `packages/ui`, plus
les contrastes mesures par test depuis la phase 1 (D1). L'audit le confirme
au niveau page.

### Les deux defauts reels

**1. Le focus retombe sur `<body>` apres une navigation cote client.**
Mesure : clic sur une tuile de l'accueil -> `/services`, `document.activeElement`
revient au `body`. Consequence concrete : une personne au lecteur d'ecran
n'est pas prevenue qu'elle a change de page, et une personne au clavier
recommence sa tabulation depuis le haut. C'est le defaut classique d'une
navigation applicative, et aucun test de composant ne peut le voir.

**2. Deux `EmptyState` creent un saut `h1 -> h3`.**
`EmptyState` a `headingLevel = 3` par defaut ; appele directement sous le
`h1` d'une page vide (`/conversations`, `/provider/requests`), il saute le
niveau 2. WCAG 1.3.1 : la hierarchie des titres porte de l'information.

### Un non-defaut, note pour qu'on ne le « corrige » pas

`apps/admin` n'a pas de `contentinfo` (pas de pied de page). Ma mesure l'a
signale ; **WCAG ne l'exige pas**. Un outil d'operateur n'a pas besoin d'un
pied de page, et en ajouter un pour satisfaire une case serait du remplissage.

## 3. Ce que le second regard a apporte

`design:accessibility-review` a ete invoquee comme prevu
(`08_ECC_INTEGRATION.md`), **apres** mes mesures, pour qu'elle soit un second
regard et non un substitut.

**Ce qu'elle est** : une liste de controle WCAG **2.1** AA et un gabarit de
rapport. Pas un instrument — elle ne mesure rien.

**Ce qu'elle a apporte, et c'est reel** : elle a nomme trois choses que mes
instruments ne couvraient pas, et que j'ai mesurees ensuite —
**zoom 200 %**, **reflow**, **espacement du texte (1.4.12)**. Les trois
passent, mais je ne les avais pas verifiees.

**Ce qu'elle n'apporte pas** : elle cible WCAG **2.1**, le projet vise
**2.2**. Les trois criteres ajoutes par la 2.2 — 2.4.11 focus non masque,
2.5.8 taille de cible, 3.3.8 authentification accessible — ne figurent pas
dans sa liste. Je les avais mesures ; sa checklist ne les aurait pas demandes.
Elle cite aussi 2.5.5 (44 px, niveau AAA en 2.1) la ou la 2.2 exige 24 px en
AA : le depot vise deja 44, donc sans consequence ici.

**Conflit avec D1-D7 : aucun.** Elle ne propose aucune couleur, aucune
police, aucun composant. Rien a arbitrer.

## 4. Ce que la phase fait

1. ~~**Le focus suit la navigation.**~~ **Remplace par le §8.3** : un titre
   par route, et c'est l'annonceur natif de Next qui annonce la page. Pas de
   focus programme.
2. **Les deux sauts de titre disparaissent** : `headingLevel={2}` la ou un
   `EmptyState` est enfant direct du `h1`. Le defaut par defaut de
   `EmptyState` reste 3, qui est juste dans le cas courant (dans une `Card`).
3. **Un test de non-regression** qui rejoue axe **et** les mesures de
   structure sur les routes principales. Cela demande d'ajouter
   `@axe-core/playwright` en devDependency de `tests/browser` — c'est la
   seule dependance nouvelle, et elle ne quitte pas les tests.

## 5. Ce que la phase ne fait pas

- **Aucun ajout de pied de page a l'admin** (§2).
- **Aucune retouche de couleur, de police ou de composant** : la mesure ne
  demande rien, et D1-D7 sont tranchees.
- **Aucun test avec un lecteur d'ecran reel** (VoiceOver / NVDA). Ils ne
  s'automatisent pas ; c'est une limite de cette phase, pas un oubli, et elle
  est ecrite comme telle dans le rapport.
- Rien d'invente.

## 6. Tests

- Le test de non-regression ci-dessus, **verifie en le cassant** comme en
  phases 9 et 10.
- Les 52 scenarios existants passent sans modification.
- Planchers de couverture tenus.

## 7. Risques

- **Deplacer le focus a chaque navigation peut devenir hostile** s'il est mal
  place (par exemple sur un element qui disparait). Il ira sur le titre de la
  page, element stable et deja present partout — la mesure l'a confirme :
  1 `h1` par page, sur les 11 routes.
- **`@axe-core/playwright` ajoute une dependance** : cantonnee au workspace
  de tests, absente de tout ce qui est livre.
- **Zero violation aujourd'hui ne vaut pas zero demain** : c'est precisement
  ce que le test de non-regression existe pour tenir.

## 8. Complements apres le GO (2026-09-26)

### 8.1 Les mesures ont ete perdues — elles sont refaites

Les scripts et sorties de l'audit du §2 n'avaient pas ete gardes ; le
redemarrage les a effaces. Le rapport ne citera que des mesures **refaites**,
avec leurs scripts et leurs sorties dans `docs/design/evidence/phase11/`.
Le harnais d'audit vit dans `tests/browser/audit/` (configuration a part : il
ne fait pas partie de la suite de non-regression).

### 8.2 Le defaut 1 etait mal decrit, et il en cachait un autre

Mesure (`evidence/phase11/probe-navigation.json`), lue dans le code de
Next 16 (`app-router-announcer.js`) :

- L'annonceur de route de Next **ne parle que si `document.title` change**.
  Les 11 routes de `apps/web` s'appellent toutes « Fixiyi » (et celles de
  l'admin « Fixiyi Admin ») : apres une navigation, l'annonceur est **vide**.
  Un lecteur d'ecran n'entend rien.
- **WCAG 2.4.2 (niveau A) echoue** : un titre identique sur toutes les pages
  ne decrit ni leur sujet ni leur but. Mon premier audit l'avait classe « OK »
  parce qu'il verifiait qu'un `<title>` *existait*. Quatrieme angle mort de
  l'instrument, attrape cette fois par la lecture du code du framework.
- Apres un clic sur une tuile, le focus tombe sur `body` ; la tabulation
  suivante reprend **au milieu de la page** (le champ de recherche de
  `/services`), pas en haut.

### 8.3 Le choix : une seule voix, celle de Next (decide par l'utilisateur)

Deplacer le focus fait toujours lire la cible au lecteur d'ecran. Donner un
titre a chaque page fait parler l'annonceur de Next. Faire les deux, c'est
**annoncer la page deux fois**. Il faut donc choisir une seule voix.

**Retenu : un titre par route, et l'annonceur natif de Next comme seule
voix. Pas de focus programme dans `app-chrome.tsx`.** Pourquoi :

1. 2.4.2 est de niveau A, donc obligatoire, et un focus programme ne le
   corrige pas.
2. La double annonce degraderait l'experience au lecteur d'ecran.
3. La solution native existe deja ; il manquait seulement de lui donner un
   titre a lire.

**Limite acceptee, ecrite au rapport** : apres une navigation declenchee par
un lien du contenu, le focus reste sur `body`, et la tabulation suivante
reprend la ou le lien etait. Le lien d'evitement (« Aller au contenu ») existe
deja : il est pose par `AppShell` depuis la phase 5 et teste. Mais cette
tabulation ne passe pas par lui. Il ne resout donc pas cette limite.

Mise en oeuvre : `title.template` dans chaque layout racine
(`%s — Fixiyi`, `%s — Fixiyi Admin`), et un `layout.tsx` minimal par segment.
Les pages sont des composants client et ne peuvent pas exporter `metadata`
elles-memes. Chaque titre reprend le `h1` de sa page. Pour les routes
dynamiques, le titre est statique (« Conversation », « Profil de l'artisan ») :
le calculer demanderait un appel authentifie cote serveur, et ce n'est pas le
role de cette phase.

### 8.4 WCAG 2.5.8 : mesure refaite, pas seulement citee

La phase 10 l'a mesure (44 mesures, `responsive.spec.ts` le verifie) et a
corrige le seul echec, le champ de fichiers de 20 px. L'audit de cette phase
remesure le critere sur ses 22 mesures, avec la meme regle (la cible d'un
controle dans un `label`, c'est le label). La phase 10 est citee comme
reference, la mesure comme preuve.

### 8.5 Fin de phase — ce qui complete le §6

1. Test de non-regression : axe (`@axe-core/playwright`), structure (un `h1`,
   landmarks, `lang`), **un titre distinct par route**, **l'annonceur non vide
   apres une navigation**. Il doit etre rouge avant la correction, et le
   rester quand on le casse expres.
2. `pnpm lint`, `typecheck`, `test`, `build` **sans cache**.
3. Images `web` **et** `admin` reconstruites (les deux recoivent des titres),
   puis tous les scenarios Playwright rejoues contre elles.
4. Captures examinees et deposees dans `evidence/phase11/`.
5. Revue ECC du diff.
6. `docs/design/PHASE_11_REPORT.md`.
7. Reference de rollback de `08_ECC_INTEGRATION.md` : `b551446` -> commit de
   la phase 11 (Decision 69), puis `PROGRESS.md`.
8. Commit de phase, puis commit de documentation du rollback.
