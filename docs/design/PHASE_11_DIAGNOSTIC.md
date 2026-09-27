# PHASE 11 (REFONTE) — ACCESSIBILITE — DIAGNOSTIC

Date : 2026-09-27. Complement de `PHASE_11_REPORT.md`, ecrit a la reprise,
**avant** le commit de la phase. Preuves : `docs/design/evidence/phase11/`.

## 1. Audit mesure

| Instrument | Mesures | Critere |
|---|---|---|
| axe-core 4.10 (WCAG 2.2 AA), Chromium reel contre la stack Docker | 11 routes x 2 largeurs = 22, plus une conversation vide et une avec reponse citee | zero violation |
| Structure DOM | memes 22 | un `h1`, aucun saut de titre, `lang`, titre distinct et suffixe |
| Comportement | 5 navigations clavier / annonceur, modal, reflow 320 px, espacement 1.4.12, 2.5.8 | voir `PHASE_11_REPORT.md` §5 |
| **Suite Playwright complete** (ajoute a la reprise) | 55 scenarios, **deux passes enchainees** | 55/55 a chaque passe |

La derniere ligne est celle que la phase avait mal lue : voir §3.

## 2. Defauts reels (produit)

Les sept defauts du rapport (§1 du rapport) : titres identiques (2.4.2),
annonceur muet, trois sauts `h1 -> h3`, bandeau du chat qui deborde a 360 px
(1.4.10), liste du chat sans role de liste (1.3.1), heure et citation sous
4,5:1 (1.4.3). Mesure, cause, impact et correction : rapport §1 et §3.
Tous corriges, test de non-regression vu rouge puis vert puis casse expres.

## 3. Defauts reels (instrument) — trouves a la reprise

### 3.1 Le rapport annoncait 55/55, la preuve disait 54/55

`PHASE_11_REPORT.md` §7 renvoyait a `playwright-complet.txt` pour « suite
complete 55/55 ». Ce fichier disait **1 failed, 54 passed**. Les deux autres
passes gardees disaient 54/55 et 53/55. Aucune des trois n'etait verte. Le
chiffre du rapport ne venait donc d'aucune mesure. C'est la faute la plus
grave de la phase : un rapport qui cite une preuve qui le contredit.
`PROGRESS.md` l'avait recopie.

Consequence visible : `screenshots/20-22-chat-*.png` avaient disparu du
depot de travail — le scenario du chat n'atteignait jamais ses captures.

### 3.2 Deux scenarios instables, et leurs causes mesurees

**`chat.spec.ts` (et, latent, `matching.spec.ts`) — la boite de l'artisan
n'est pas vide.**

- Symptome : l'artisan ouvre « la premiere » demande de sa boite et arrive
  dans une autre conversation que celle du client.
- Premiere hypothese — *le nouveau `accessibility.spec.ts`, qui passe
  desormais avant `chat.spec.ts`, pollue la boite* : **fausse**. Les deux
  fichiers enchaines passent (4/4) ; le scenario d'accessibilite n'utilise
  que du DIRECT.
- Cause mesuree dans Mongo : `matching.spec.ts` lance un dispatch **AUTO**.
  Apres la passe, **2 matchs restent ACTIFS**, une vague toutes les 120 s,
  jusqu'a 5 vagues (`system_configuration.matching`). Ces vagues ont notifie
  des artisans crees par des passes suivantes — dont des « Chat Pro » et des
  « Nav Pro ». Les trois passes de la phase ont ete lancees a 7-10 minutes
  d'intervalle, en plein dans cette fenetre ; la passe du 2026-09-27, lancee
  apres un jour d'arret, a vu le chat passer.
- Le produit a raison : un artisan peut recevoir plusieurs demandes. C'est
  le test qui supposait une boite a une seule ligne (`.first()`, et
  `toHaveCount(0)` apres refus dans `matching.spec.ts`).

**`services.spec.ts:50` — la session perdue juste apres la connexion.**

- Symptome : `domain-select` introuvable ; la page affichee est `/login`.
- Cause lue dans la trace : `POST /auth/otp/verify` **interrompu** (statut
  -1) par le `page.goto("/services")` du test, lance 23 ms plus tard.
  `loginThroughUi` rendait la main **au clic** « verifier ». Les autres
  appelants attendaient ensuite l'URL de depart ; celui-ci non. Defaut latent
  depuis la phase 7, revele par la charge.

### 3.3 Corrections, et preuve qu'elles mordent

| Correction | Fichier |
|---|---|
| `loginThroughUi` attend que l'URL quitte `/login` : connecte veut dire session stockee | `tests/browser/support/journeys.ts` |
| Description unique par demande ; l'artisan agit sur **sa** ligne (`filter({ hasText })`), et « ligne disparue » remplace « boite vide » | `tests/chat.spec.ts`, `tests/matching.spec.ts` |

Rien n'a ete change dans le produit : les deux defauts etaient dans les tests.

Les deux conditions ont ete **reproduites expres**
(`audit/probe-flake.spec.ts`, sortie `probe-flake.txt`), sans attendre le
hasard :

| Sonde | Ancien code | Nouveau code |
|---|---|---|
| A : verification ralentie a 1,5 s, puis `goto` | session perdue (`legacySignedIn: false`) | connecte (`fixedSignedIn: true`) |
| B : l'artisan a une demande etrangere plus recente | `.first()` prend l'etrangere (`legacyPicksOurs: false`) | 1 ligne, la bonne |

## 4. Faux defauts

- Hypothese « pollution par `accessibility.spec.ts` » : fausse (§3.2).
- Capture « Messages » jointe a l'echec de `services.spec.ts` : elle vient
  d'une autre page du contexte, pas de l'etat final (qui est `/login`, lu dans
  `error-context.md`). Lire le contexte d'erreur, pas seulement l'image.

## 5. Corrections appliquees / retirees / reportees

- **Faites** : les sept defauts produit (rapport) ; les deux instabilites de
  la suite (§3).
- **Retire** : le chiffre « 55/55 » non mesure du rapport, remplace par les
  passes du §1.
- **Reportes** : focus apres navigation (limite acceptee, Decision 80) ;
  texte indicatif du chat coupe a 320 px (a decider) ; test au lecteur
  d'ecran reel (non automatisable).

## 6. Reste ouvert

- **Focus sur `body` apres une navigation par un lien du contenu.** Le lien
  d'evitement existe (phase 5) et reste le premier arret clavier, mais la
  tabulation qui suit la navigation ne passe pas par lui. Amelioration
  future possible, non implementee : deplacer le focus vers le contenu **sans**
  double annonce, ce qui demande de pouvoir faire taire l'annonceur de Next.
- Les matchs AUTO laisses par la suite continuent de dispatcher quelques
  minutes. Les tests en sont desormais independants ; la base de dev, elle,
  accumule des candidatures de test (sans effet sur le produit).

## 7. Verification ECC

| Regle | Resultat |
|---|---|
| Aucun `console.log` en production | OK (diff `apps/`, `packages/` : aucun). Les sondes d'audit en ont : c'est leur sortie, hors suite |
| Fonctions < 50 lignes | OK pour le code ajoute ; `ConversationPage` reste long de son JSX (Decision 79) |
| Fichiers < 800 lignes | OK (le plus long touche : `chat.css`, 247) |
| Pas de `any` | OK |
| Couverture | planchers tenus (`web` 59 tests, `pageTitle` teste) |
| Rate limiting | aucune route touchee |
| Regle 3bis | `Alert` (partie 2B) reutilise pour le bandeau ; annonceur natif de Next plutot que du code maison |
