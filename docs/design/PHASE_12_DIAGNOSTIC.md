# PHASE 12 (REFONTE) — ANIMATIONS — DIAGNOSTIC

Date : 2026-09-27. Plan : `PHASE_12_PLAN.md`. Preuves :
`docs/design/evidence/phase12/`.

## 1. Audit mesure

**Instrument** : `document.getAnimations()` dans Chromium reel contre la
stack Docker. Il rend toutes les animations et transitions CSS **en cours ou
encore appliquees**, avec leur cible, leur duree, leurs iterations et leurs
proprietes animees. Sondes : `tests/browser/audit/probe-motion.spec.tsx`,
`probe-chat-motion.spec.ts`, `probe-list-replay.spec.ts`.

| Mesure | Nombre | Criteres |
|---|---|---|
| Banc de composants (modale, feuille, palette, menu, toast, attente, urgence) | 7 scenes x 2 modes | M1 a M5 du plan |
| Routes reelles de `apps/web`, sessions reelles, plus un survol | 12 scenes x 2 modes | M1 a M5 |
| Fil de discussion : envoi, reouverture, nouvel envoi | 1 parcours, 6 lectures | historique contre arrivee |
| Accueil : premiere visite contre retour en cache | 2 lectures | idem |

**L'instrument mord** : une animation infinie posee sur un element **sans
classe `fx-`** (elle echappe aux deux regles de mouvement reduit) est
rapportee dans les deux modes (`motion-avant.json`, scene `control`). Sans
cette verification, les zeros du §2 ne voudraient rien dire.

## 2. Ce qui tenait deja (mesure, pas suppose)

| Critere | Resultat |
|---|---|
| M1 mouvement reduit | **tenu partout** : sous `reduce`, aucune animation au-dela de 1 ms, aucune boucle (hors controle) |
| M2 jetons | toutes les durees sont des jetons (150 / 200 / 300 ms) ou un multiple ecrit dans le source (1 500 ms = `slower` x 3) |
| M3 WCAG 2.2.2 | seules les attentes bouclent (spinner, squelette, barre indeterminee) ; la pulsation d'urgence s'arrete a **4,5 s** (3 x 1,5 s), sous les 5 s |
| M5 cout | `transform` / `opacity` partout, sauf trois cas justifies en §5 |

## 3. Defauts reels

### 3.1 Le chat rejoue son historique a chaque ouverture

- **Mesure** (`chat-motion-avant.json`) : 4 messages envoyes, reouverture ->
  **4 animations d'entree**, simultanees. Une conversation de 50 messages en
  jouerait 50.
- **Cause** : `fx-animate-slide-in-bottom` sur **chaque** `<li>` de message,
  sans distinction.
- **Impact** : l'animation d'entree dit « ceci vient d'arriver ». Posee sur
  l'historique, elle dit faux, et elle noie le seul message qui arrive
  vraiment.
- **Correction** : `lib/arrivals.ts`. Le plus haut `seq` present quand le
  premier chargement se termine fixe la ligne de base ; seuls les messages
  au-dessus entrent. `seq` ne fait que croitre, donc les pages plus anciennes
  chargees ensuite restent immobiles. Ligne de base fixee **pendant le
  rendu**, pas dans un effet : la premiere image sait deja ce qui est
  historique. 7 tests unitaires.
- **Apres** (`chat-motion-apres.json`) : reouverture -> **0** ; un nouvel
  envoi -> **1**, le sien.

### 3.2 Les listes rejouent leur entree sur des donnees deja la

- **Mesure** (`list-replay-avant.json`) : accueil, premiere visite -> 3
  animations ; retour par la navigation, catalogue en cache, sans squelette
  -> **3 encore**.
- **Cause** : la cascade (`fx-animate-stagger`) est posee au montage, que
  les donnees arrivent ou non.
- **Correction** : `lib/use-entrance.ts`. Une liste n'entre que si l'ecran a
  **d'abord montre son chargement** (etat lu une fois, au montage). Applique
  aux sept listes alimentees par une requete : accueil, services, cascade du
  formulaire, mes demandes, conversations, boite artisan, candidats.
- **Apres** (`list-replay-apres.json`) : premiere visite 3, retour **0**.
  Images a 60 ms : `premiere-visite-60ms.png` (tuiles en cours d'entree) /
  `retour-cache-60ms.png` (tuiles deja la).

### 3.3 La carte de connexion glisse a chaque ouverture de la page

- **Mesure** : `/login` -> 1 animation, sur la carte ; la carte n'est pas
  remontee entre les etapes telephone et code, donc elle ne joue **qu'a
  l'arrivee sur la page**.
- **Impact** : decorative au sens strict — elle ne signale ni un etat, ni
  une arrivee, ni une attente.
- **Correction** : retiree dans `apps/web` et `apps/admin`. Le fondu du
  message d'erreur, lui, reste : il signale un changement d'etat.

### 3.4 La suite Playwright depassait le quota OTP de l'API

- **Mesure** : suite complete 56/58, `session-refresh` x 2 refuses par
  « Too many requests ». Compteur lu dans Redis apres la passe :
  **`otp-verify` = 32 pour un plafond de 30 par IP et par heure**.
- **Cause** : toute la suite parle depuis une seule IP ; les compteurs
  n'etaient remis a zero qu'une fois par passe. Les trois scenarios de
  mouvement ont fait passer la suite au-dessus du plafond. C'est
  vraisemblablement aussi l'echec isole de `session-refresh` en passe 3 de la
  phase 11 (non prouve : cette passe n'a pas garde Redis).
- **Correction** (tests seulement, **plafond du produit inchange**) : une
  fixture automatique remet les compteurs a zero avant **chaque test**,
  comme le fait deja l'e2e de l'API (Decision 32). Les onze specs importent
  `test` depuis `support/test.ts`. Decision 83.
- **Apres** : 58/58, deux passes enchainees.

## 4. Faux defauts et pieges de l'instrument

- **Un squelette qui scintille sur `/requests/:id/match`** : mesure prise
  des le `h1`, alors que la liste des candidats chargeait encore. Ce n'est pas
  un squelette bloque ; le test attend le contenu avant de mesurer.
- **Les animations finies restent dans `getAnimations()`** tant qu'elles
  remplissent (`both`) : les comptes « 1, 2, 3, 4 » pendant l'envoi sont
  cumulatifs, pas quatre entrees par envoi.
- **Ma sonde de liste est tombee apres la correction** : elle attendait
  `.fx-animate-stagger`, precisement la classe que la correction retire au
  retour. Elle vise maintenant le `data-testid` de la liste.
- **Lancer un seul fichier Playwright vide `screenshots/`**, qui est aussi
  l'`outputDir` : les captures nommees commitees disparaissent jusqu'a la
  prochaine suite complete. C'est l'origine des captures du chat
  « supprimees » constatees en debut de phase 11. Signale ; la suite complete
  les regenere.
- Un domaine « Test Manuel » sans icone apparait sur l'accueil : une donnee
  de la base de **dev**, creee a la main. Pas un defaut d'interface.

## 5. Corrections appliquees / retirees / reportees

- **Faites** : §3.1 a §3.4.
- **Gardees apres examen** (elles disent quelque chose) : entree des
  surcouches (modale, feuille, palette, menu, toast : d'ou vient la couche) ;
  fondu du message d'erreur et du recapitulatif (etat) ; coordonnees et
  fichiers televerses (arrivee) ; attentes en boucle ; pulsation d'urgence
  (3 fois, puis immobile) ; retours de survol et d'appui (150 ms).
- **M5, proprietes hors `transform` / `opacity`, justifiees** :
  `background-color` et `box-shadow` au survol (150 ms, une fois) ;
  `background-position` du squelette (quelques lignes, le temps d'un
  chargement) ; `inline-size` de la barre de progression determinee (elle
  mesure une quantite). Aucune n'est dans une boucle couteuse.
- **Rien d'ajoute** : aucune animation nouvelle. La mesure ne demandait
  aucun ajout, et la consigne refuse le decoratif.

## 6. Reste ouvert

- Une liste qui se remplit **en direct** apres un retour en cache (nouveaux
  candidats d'une vague) n'anime pas ses nouvelles lignes : `useEntrance` lit
  l'etat au montage. Choix de simplicite ; les lignes arrivent de toute facon
  avec leur statut.
- La regle « une entree = une arrivee » est tenue par le test navigateur et
  par `arrivals.test.ts`, pas par un test de `packages/ui` : c'est un usage
  des utilitaires, pas une propriete des composants.

## 7. Verification ECC

| Regle | Resultat |
|---|---|
| `console.log` en production | aucun (`apps/`, `packages/`) ; les sondes d'audit en ont, c'est leur sortie |
| Fonctions < 50 lignes | code ajoute : `settleBaseline` 3 lignes, `useEntrance` 2 |
| Fichiers < 800 lignes | le plus long touche : `motion.spec.ts`, 139 |
| `any` | aucun |
| Couverture | `web` 20,05 % -> **20,58 %** ; planchers tenus (15/15) |
| Rate limiting | aucune route touchee ; plafonds de l'API inchanges (§3.4) |
| Regle 3bis | `useEntrance` reprend le motif « lire une fois au montage » ; la remise a zero par test reprend celle de l'e2e de l'API |
