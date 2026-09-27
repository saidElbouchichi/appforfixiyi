# PHASE 11 (REFONTE) — ACCESSIBILITE — RAPPORT

Date : 2026-09-26, corrige le 2026-09-27. Statut : **TERMINEE**. Plan :
`docs/design/PHASE_11_PLAN.md` (§8 = complements apres le GO). Diagnostic :
`docs/design/PHASE_11_DIAGNOSTIC.md`. Preuves : `docs/design/evidence/phase11/`.

## 1. Ce que le plan annoncait, et ce que la mesure a trouve

Le plan annoncait **deux** defauts. Les mesures du plan avaient ete perdues au
redemarrage ; elles ont ete **refaites**, avec leurs scripts gardes cette fois
(`tests/browser/audit/`). Au lieu de deux defauts, la mesure en trouve **sept**,
et l'un des deux defauts annonces n'etait pas le bon.

| # | Defaut | Critere | Comment il a ete trouve |
|---|---|---|---|
| 1 | Les 11 routes s'appellent toutes « Fixiyi » (l'admin : « Fixiyi Admin ») | **2.4.2 (A)** | lecture du code de l'annonceur de Next 16 |
| 2 | Apres une navigation, un lecteur d'ecran **n'entend rien** | 4.1.3 / 2.4.2 | consequence du 1, mesuree (`probe-navigation.json`) |
| 3 | Deux `EmptyState` sautent `h1 -> h3` (`/conversations`, `/provider/requests`) | 1.3.1 | audit, **annonce par le plan** |
| 4 | Un troisieme : « Aucun message », dans une conversation vide | 1.3.1 | **le test rouge**, pas l'audit |
| 5 | Le bandeau de protection du chat fait 594 px : la page defile en largeur **a 360 px comme a 320** | 1.4.10 | audit, verifie a 320 / 360 / 768 |
| 6 | Les `<li>` du chat sont orphelins : `role="log"` sur l'`<ol>` efface le role de liste | 1.3.1 | axe, **des qu'un message existe** |
| 7 | Heure d'un message envoye a **4,17:1** ; citation de reponse a **4,42:1** (auteur) et **3,62:1** (extrait) | 1.4.3 | axe (heure) ; une ligne `opacity` relue dans `chat.css` (citation) |

Tous se trouvent sur des ecrans **avec des donnees reelles**. L'audit d'avant
le redemarrage mesurait une conversation vide ; il ne pouvait voir ni le 6 ni
le 7.

### Le defaut 5 aurait du etre vu en phase 10

Le bandeau deborde deja a 360 px (`scrollWidth` 618). La phase 10 affirmait
« zero debordement sur 44 mesures ». Mais elle n'a pas documente sa liste de
routes, et le mot « conversations » n'apparait ni dans son plan ni dans son
rapport : la page de conversation n'y figurait vraisemblablement pas. Ce
rapport ne va pas plus loin que cela.

## 2. Le choix d'une seule voix (decide par l'utilisateur)

Le plan prevoyait de **deplacer le focus sur le `h1`** apres chaque
navigation. La mesure a change la question :

- L'annonceur de Next ne parle que si `document.title` **change**. Avec un
  titre unique, il etait muet.
- Donner un titre a chaque page (2.4.2, niveau A, obligatoire) le fait parler.
- Deplacer le focus fait lire la cible au lecteur d'ecran.

Faire les deux, c'est **annoncer la page deux fois**. Il fallait donc choisir
une seule voix. **Retenu : un titre par route, et l'annonceur natif de Next
comme seule voix. Pas de focus programme.** Aucun code d'annonce n'a ete
ajoute : il suffisait de donner a l'annonceur un titre a lire.

### Limite acceptee — ecrite noir sur blanc

**Apres une navigation declenchee par un lien du contenu (une tuile, par
exemple), le focus tombe sur `body`.** La tabulation suivante reprend la ou
etait le lien (mesure : le champ de recherche de `/services`), et non en haut
de la page.

- C'est un **compromis accepte** : 2.4.2 est obligatoire, et la double annonce
  serait une regression pour les lecteurs d'ecran. Le lecteur d'ecran, lui,
  est desormais prevenu (voir §4).
- Pour les liens de la barre de navigation, le focus reste sur le lien : il
  ne se perd pas.
- **Correction d'une premisse** : il etait prevu de noter « ajouter un lien
  d'evitement » comme amelioration future. Or **ce lien existe deja** :
  « Aller au contenu », pose par `AppShell` depuis la phase 5
  (`packages/ui/src/components/Layout.tsx:117`), teste
  (`Layout.test.tsx:71`), et **premier arret clavier sur les 11 routes**
  (mesure). En revanche, il ne leve pas cette limite, parce que la
  tabulation qui suit une navigation **ne passe pas par lui**. Pour la lever
  sans double annonce, il faudrait une piste qui n'est pas tranchee :
  deplacer le focus **sans** titre annonce par Next. Elle n'est pas a portee
  tant que l'annonceur ne peut pas etre desactive.

## 3. Les corrections

| # | Correction | Fichiers |
|---|---|---|
| 1-2 | Un titre par route, `pageTitle(nom)` -> « nom — Fixiyi » ; un `layout.tsx` serveur minimal par segment (les pages sont client et ne peuvent pas exporter `metadata`) | `apps/{web,admin}/src/lib/segment-layout.tsx`, 12 `layout.tsx` |
| 3-4 | `headingLevel={2}` sur les trois `EmptyState` | `conversations/page.tsx`, `provider/requests/page.tsx`, `conversations/[id]/page.tsx` |
| 5 | Le bandeau est une **phrase**, pas un statut : `Badge` (`nowrap`) remplace par `Alert` (composant « Alert / Banner » de la partie 2B, memes jetons `info`) | `conversations/[id]/page.tsx` |
| 6 | `role="log"` sur un conteneur ; la liste ne contient que des `<li>` | `conversations/[id]/page.tsx`, `chat.css` |
| 7 | Heure et extrait sans `opacity` ; dans la bulle envoyee, la citation prend `--fixiyi-color-action-hover` (plus fonce) au lieu d'un voile qui eclaircit | `chat.css` |

**Aucune couleur, aucune police, aucun composant nouveau.** Les deux
changements visibles sont le bandeau (une carte d'alerte au lieu d'une
pastille) et la citation dans une bulle envoyee (un orange plus profond,
`AVANT-` / `APRES-citation.png`).

### Titres : une premiere version etait fausse

La premiere version utilisait `title.template` (« %s — Fixiyi »). L'audit
« apres » a montre trois titres **sans** le nom du site : « Nouvelle demande »,
« Recherche de fournisseurs », « Conversation ». En effet, un layout parent
(`requests/`, `conversations/`) qui declare un titre en simple chaine prive
ses enfants du modele. Le test ne verifiait que des titres **distincts** ; il
exige maintenant aussi le suffixe, et il a ete vu rouge sur exactement ces
trois routes. Correction : titres **absolus**, un seul mecanisme, sans
heritage cache.

## 4. Le test de non-regression

`tests/browser/tests/accessibility.spec.ts`, trois scenarios, avec de vraies
sessions contre la stack Docker (`@axe-core/playwright`, seule dependance
nouvelle, cantonnee a `tests/browser`) :

1. **Chaque ecran** (11 routes, plus une conversation vide et une avec
   reponse citee), a **320 et 1440 px** : axe WCAG 2.2 AA a zero, `lang="fr"`,
   un seul `h1`, aucun saut de titre, aucun defilement horizontal. Puis sur
   l'ensemble : **aucun titre partage**, et **tous suffixes** du nom du site.
2. **Ce qu'entend un lecteur d'ecran** : apres chaque navigation, le titre
   change, et l'annonceur de Next dit ce nouveau titre.
3. **L'admin** nomme ses pages.

### Verifie en le cassant

| Etape | Resultat | Preuve |
|---|---|---|
| Avant correction | **3/3 rouges**, 14 erreurs couvrant les defauts 1 a 6 | `rouge-avant-correction.txt` |
| Citation ajoutee au test | rouge sur `.fx-reply-quote__author, __excerpt` | `rouge-citation.txt` |
| Apres correction | **3/3 verts** | `vert-apres-correction.txt` |
| Trois regressions reintroduites dans le code, image reconstruite | rouge sur chacune, par le bon controle : `color-contrast: time`, `h1 -> h3` sur `/conversations`, `/` et `/profile` qui partagent un titre | `mutation-casse.txt` |

### Trois pieges de mon instrument, attrapes avant le rapport

- **L'annonceur** : ma premiere version du scenario 2 est passee **au vert
  avant toute correction**. La zone live garde son dernier texte : une
  annonce faite pendant la redirection du login (« Fixiyi ») y etait restee,
  et elle egalait un titre qui ne changeait jamais. Le scenario exige
  desormais un titre **nouveau** a chaque etape (`audit/probe-announcer2`).
- **Les titres** : « distincts » ne suffisait pas (voir §3).

- **Une animation prise pour une couleur** : une sonde a mesure 3,98:1 sur
  une bulle qui venait d'etre envoyee, texte `#fefefe` sur `#cb5f32`, une teinte
  qui n'est aucun de nos jetons. Il s'agissait d'un etat intermediaire de
  l'animation d'entree. Une fois l'animation terminee, il n'y a plus aucune
  violation (`probe-animation.json`). Le test attend desormais la fin des
  animations **finies** avant de lancer axe (un spinner ne finit jamais), ce
  qui ferme ce risque d'instabilite.

S'y ajoute le faux positif du plan (des `select` desactives sans anneau). Pour
la quatrieme phase de suite, l'instrument avait des angles morts ; c'est la
verification qui les a trouves, pas l'instrument lui-meme.

## 5. Mesure complete, avant / apres

`audit-avant.json` / `audit-apres.json` — 11 routes x 2 largeurs = 22 mesures,
plus reflow et espacement du texte par route :

| Critere | Avant | Apres |
|---|---|---|
| axe WCAG 2.2 AA | 4 violations (conversation avec message) | **0** |
| Sauts de titre | 4 (2 ecrans x 2 largeurs) + 1 vu par le test | **0** |
| Titres distincts | 1 sur 11 | **11 sur 11** |
| Annonceur apres navigation | vide x 5 | **le nouveau titre x 5** |
| 1.4.10 Reflow 320 px | echec sur la conversation | **OK partout** |
| 1.4.4 Zoom 200 % / 1.4.12 Espacement | OK | OK |
| **2.5.8 Taille de cible** — remesuree (cible = label pour un controle dans un label) | 0 sous 24 px | 0 |
| 2.4.7 Anneau / 2.4.11 Focus non masque / 2.1.2 Piege | 0 / 0 / 0 | 0 / 0 / 0 |
| Lien d'evitement premier arret | 11/11 | 11/11 |
| Modal : focus retenu, `Escape`, retour au declencheur | 0 sortie sur 12 tab., retour OK | idem |

2.5.8 : la phase 10 l'avait mesure et corrige (champ de fichiers a 20 px),
et `responsive.spec.ts` le verifie. Il a ete **remesure ici**, avec la meme
regle, sur les 22 mesures.

## 6. Revue ECC

`ecc:code-reviewer` sur le diff : 0 CRITICAL, 1 HIGH, 0 MEDIUM, 2 LOW.

- **HIGH — verifie, reclasse, corrige.** Une bulle *envoyee et supprimee*
  portant une citation afficherait du texte gris sur le nouveau fond fonce
  (~1:1). **Non atteignable dans le produit** : un message supprime revient de
  l'API sans `replyTo` (`apps/api/src/chat/message-view.ts:100`), et la
  suppression cote client fusionne cette vue serveur
  (`use-chat-thread.ts:198`). Mais le composant `MessageBubble` accepte bien
  cette combinaison ; le selecteur l'exclut desormais
  (`.fx-bubble--own:not(.fx-bubble--deleted)`). C'est un defaut latent du
  composant, pas un defaut visible.
- LOW — `console.log` dans les sondes d'audit : c'est leur sortie. Elles
  vivent hors de la suite (`tests/browser/audit/`, configuration a part) et
  sont gardees comme trace de la methode.
- LOW — pas de test unitaire pour `pageTitle` cote admin : il est identique a
  celui de `web`, qui est teste, et le scenario 3 le couvre de bout en bout.

## 7. Tests et gates

| Suite | Avant | Apres |
|---|---|---|
| Playwright | 52 | **55** — 55/55 **deux passes enchainees** (`playwright-complet.txt`, `playwright-complet-enchaine.txt`, 2026-09-27) |
| `apps/web` (vitest) | 57 | **59** (`pageTitle`) |
| Monorepo (vitest) | — | **842** |

### Correction a la reprise (2026-09-27) : le 55/55 n'etait pas mesure

La premiere version de ce tableau annoncait « 55/55 » en citant
`playwright-complet.txt`. **Ce fichier disait 1 failed, 54 passed**, et les
deux autres passes gardees disaient 54/55 (`-run2-`) et 53/55 (`-run3-`). Le
chiffre ne venait d'aucune mesure. Deux scenarios etaient instables, par des
defauts **des tests** (aucun dans le produit) : la boite de l'artisan recevait
des vagues AUTO laissees par une passe precedente (`chat`, `matching`), et
`loginThroughUi` rendait la main avant la fin de la connexion (`services`).
Causes mesurees, correction, et preuve qu'elle mord :
`PHASE_11_DIAGNOSTIC.md` §3. Le « 55/55 » ci-dessus est celui de la reprise.

`pnpm lint` 15/15 **sans avertissement**, `typecheck` 15/15, `test` 14/14,
`build` 10/10, **sans cache** (`--force`). Planchers de couverture tenus
(`web`, `ui`). Images `web` et `admin` reconstruites.

**Note de transparence** : une premiere passe de `pnpm test` a echoue sur un
depassement de 5 s dans `Controls.test.tsx` (Checkbox, non touche), alors que
tournaient en meme temps une reconstruction Docker et un agent de revue.
Relance au calme : 235/235 dans `packages/ui`, 14/14 taches. C'est un effet de
charge, que la seconde passe n'a pas reproduit.

## 8. Ce que la phase ne fait pas

- **Aucun test avec un lecteur d'ecran reel** (NVDA, VoiceOver) : ils ne
  s'automatisent pas. Ce que l'on sait de l'annonce vient du texte de
  l'annonceur de Next, lu dans le DOM, et non d'une voix entendue. C'est une
  limite, pas un oubli.
- Le focus apres navigation : voir §2, limite acceptee.
- Titres des routes dynamiques **statiques** (« Conversation », « Profil de
  l'artisan ») : les calculer demanderait un appel authentifie cote serveur.
- Titre de `/catalog` (admin) pose mais **non verifie de bout en bout** :
  il faut un compte ADMIN, que les tests n'ont pas.
- Pas de pied de page ajoute a l'admin (WCAG ne l'exige pas).
- **Signale, pas traite** — vu dans les captures, pas mesure par
  l'instrument : a 320 px, le texte indicatif du champ de saisie du chat
  (« Ecrire un message ») passe a la ligne et se fait couper dans une zone
  d'une ligne (`AVANT-` et `APRES-conversation-320.png`). C'etait deja le cas
  avant cette phase, et le champ garde son nom accessible. **A decider avec
  l'utilisateur.**
- `design:accessibility-review` n'a pas ete reinvoquee : le second regard est
  celui du plan, §3.

## 9. Prerequis et prochaine phase

- Prerequis tenus : gates sans cache, 55/55 deux passes enchainees, images
  `web` et `admin` reconstruites (titres presents en navigateur), captures du
  chat regenerees et examinees.
- Prochaine phase : **12, animations** — enchainee sans arret (Decision 81).
