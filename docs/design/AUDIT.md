# AUDIT — REFONTE DESIGN SYSTEM V2 (FIXIYI)

Date : 2026-09-21
Statut : **audit uniquement — aucune ligne de code modifiee.** En attente de
validation avant toute phase.
Reference : `docs/design/reference/fixiyi-design-board.png` (image unique
recue, planche design + panneau « Demande d'integration »).
Ecarts entre le prompt de mission et le depot : `AUDIT_NOTES.md`.

## 0. Cadre

- **Mission explicite hors protocole** : la refonte n'est pas une phase de
  06_SCOPE. Elle a son plan, ses phases, ses tests, ses commits et ses
  rapports sous `docs/design/`. **La Phase 7 ne demarre pas avant la fin de
  la refonte.**
- Les **regles Fixiyi restent en vigueur** pendant la refonte
  (03_AGENT_PROTOCOL §2) : pas de donnees statiques presentees comme
  reelles, pas de bouton decoratif, pas de route morte. C'est ce qui fixe la
  frontiere de la refonte (section 4).
- **Les 14 phases ne m'ont pas encore ete transmises** (parties 2/3 et 3/3
  du master prompt). Cet audit ne les invente pas ; la section 7 dit
  seulement ce qu'elles doivent respecter.

## 1. Ce que montre la planche (valeurs relevees)

### Identite
Logo : epingle de localisation orange contenant une cle, wordmark
« Fixiyi ». Signature : « Trouvez. Reservez. Reparez. » — « Vos artisans de
confiance, pres de chez vous. » Pied : « Plus qu'une application, une
solution de confiance. » (Rapide · Fiable · Proche de vous).

### Couleurs

| Role | Valeurs |
|---|---|
| Primaire (orange) | `#F97316`, `#EA580C`, `#C2410C` |
| Accent (urgence) | `#FBBF24`, `#F59E0B` |
| Neutres (chauds, « stone ») | `#FAFAF9`, `#F5F5F4`, `#E7E5E4`, `#78716C`, `#44403C`, `#1C1917` |
| Semantiques | Success `#16A34A`, Warning `#F59E0B`, Error `#DC2626`, Info `#0EA5E9` |
| Metiers | Electricien `#EAB308`, Plombier `#06B6D4`, Climatisation `#3B82F6`, Serrurier `#8B5CF6`, Peintre `#EC4899`, Menuisier `#A16207` |

### Typographie
Inter (ou Plus Jakarta Sans). Titres 600/700/800, interlettrage serre.
Texte 400/500, interligne 1,5.

| Style | Taille / interligne |
|---|---|
| Display | 48 / 56 |
| H1 | 36 / 44 |
| H2 | 30 / 38 |
| H3 | 24 / 32 |
| H4 | 20 / 28 |
| Body | 16 / 24 |
| Small | 14 / 20 |
| Caption | 12 / 16 |

### Espacement, rayons, ombres
- Espacement base 4 px : 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.
- Rayons : sm 6, md 8, lg 12, xl 16, 2xl 24, full 9999.
- Ombres sm / md / lg sur base `rgba(28, 25, 23, …)` (= `#1C1917`) ;
  opacites lues ≈ 0,06 / 0,07 / 0,10 — **a confirmer**, le texte de la
  planche est trop petit pour une lecture certaine.

### Composants montres
Bouton primaire (plein, fleche), secondaire (contour), texte ; champ de
recherche avec icone ; rangee d'icones de navigation ; interrupteur ;
notation 5 etoiles « 4,8 (124 avis) » ; badges Disponible / Urgent /
Verifie ; champ de saisie ; liste deroulante ; carte « Artisan verifie »
(avatar + bouclier).

### Ecrans montres
1. **Accueil / onboarding** — « Des artisans fiables a portee de main »,
   illustration d'artisan, Commencer / Se connecter.
2. **Liste des services** — ville, recherche, grille de categories
   colorees, « Nos services populaires » avec prix « A partir de 150 DH »,
   barre d'onglets Accueil / Messages / Favoris / Profil.
3. **Profil artisan** — photo, nom, « 4,8 (342 avis) », « 560+
   interventions », badges Verifie / Reactif / Pro, prix, « Reserver
   maintenant », onglets A propos / Avis / Services.
4. **Reservation** — date et creneau, adresse, carte bancaire •••• 4242,
   sous-total, frais de plateforme, total 165 DH.
5. **Suivi en temps reel** — « En route », carte, trajet, Contacter.
6. **Avis et confiance** — note 4,8, distribution 88/8/2/1/1 %, avis.

Plus une banniere web (« Un probleme ? Une solution a portee de main ! »,
« Trouver un artisan », « +12 000 clients satisfaits ») et une maquette de
telephone avec carte et categories.

## 2. Ecart Design System actuel -> cible

| Domaine | Actuel (v1) | Cible (planche) | Ecart |
|---|---|---|---|
| Primaire | teal `#256F6C` | orange `#F97316` | **changement d'identite** |
| Neutres | gris froids teintes teal | neutres chauds « stone » | remplacement complet |
| Semantiques | `success/warning/danger/info` 500/700 | 4 teintes uniques | valeurs a remplacer, roles a adapter (section 3) |
| Metiers | absent | 6 couleurs | **nouveau** — et aucune donnee pour les porter (section 5) |
| Police | pile « Inter… » declaree mais **aucune police chargee** : le rendu est la police systeme | Inter chargee | chargement a ajouter (Inter + Noto Sans Arabic pour ar/ary) |
| Echelle typo | tailles xs–3xl, sans interlignes ni styles | 8 styles taille + interligne | a completer (Display 48, H1 36 manquent) |
| Espacement | 0–96 base 4 | identique | **aucun ecart** |
| Rayons | sm **4**, md 8, lg 12, xl 16, full | sm **6**, …, **2xl 24** | sm a changer, 2xl a ajouter |
| Ombres | base `rgba(20,23,23,…)` | base `rgba(28,25,23,…)` | teinte et opacites |

Composants de la planche **absents** du Design System : interrupteur,
notation etoiles, avatar, onglets, barre de navigation basse, champ de
recherche a icone, tuile de categorie, carte de service, carte artisan.
Le panneau d'integration mentionne aussi toasts et steppers.
Icones a ajouter a partir de la planche : etoile, localisation, filtre,
cloche, chevron, telephone, et les 6 icones metiers (eclair, goutte,
flocon, cle, rouleau, marteau).

Les invariants du Design System actuel **tiennent tels quels** et
serviront de garde-fous : tokens uniquement, proprietes logiques (RTL),
cibles 44 px, `prefers-reduced-motion`, synchronisation `tokens.ts` /
`tokens.css` testee.

## 3. Constat bloquant n°1 — l'orange de la planche echoue WCAG 2.2 AA

Mesure (formule WCAG), le projet s'engage sur l'AA :

| Couleur | Texte blanc dessus | Sur fond blanc | Verdict |
|---|---|---|---|
| `#F97316` (primaire planche) | **2,80:1** | 2,80:1 | echoue texte (4,5) **et** composant graphique (3,0) |
| `#EA580C` | 3,56:1 | 3,56:1 | icones, bordures, gros texte seulement |
| `#C2410C` | **5,18:1** | 5,18:1 | texte courant OK |
| `#FBBF24` accent | 1,67:1 | — | exige un texte fonce (10,48:1 avec `#1C1917`) |
| Info `#0EA5E9` | — | 2,77:1 | echoue comme texte |
| Success `#16A34A` | — | 3,30:1 | echoue comme texte courant |
| Electricien `#EAB308` | 1,92:1 | — | icone blanche illisible |
| Plombier `#06B6D4` | 2,43:1 | — | idem |

Les boutons primaires de la planche (texte blanc sur `#F97316`) sont donc
non conformes. **Recommandation** — aucune couleur nouvelle, seulement
des roles, avec les trois oranges que la planche fournit deja :

- `#F97316` : marque et decor (logo, illustrations, fonds de mise en avant
  avec texte fonce) ; jamais seul porteur d'information sur fond blanc.
- `#EA580C` : icones, bordures, anneau de focus, gros texte.
- `#C2410C` : tout ce qui porte du texte courant — boutons primaires,
  liens.

Consequence visible : les boutons seront d'un orange plus profond que sur
la planche. Alternative : `#F97316` avec texte `#1C1917` (6,24:1), fidele a
la teinte mais change l'aspect des boutons. **A trancher par toi (D1).**
Meme principe pour semantiques et metiers : la teinte de la planche pour
les fonds et pastilles, une nuance foncee pour le texte et les icones.

## 4. Constat bloquant n°2 — trois ecrans sur six n'ont aucun backend

| Ecran de la planche | Existe ? | Ce qui est possible sans rien inventer |
|---|---|---|
| Accueil / onboarding | `apps/web/login` | refonte complete ; **pas** de « +12 000 clients satisfaits » (statistique inventee) |
| Liste des services | `requests/new` (cascade de listes) | grille de categories sur le **vrai catalogue** et recherche : oui. Prix « a partir de », « populaires », favoris : **non** (aucune donnee) |
| Profil artisan | aucun ecran ; `GET /providers/:id` existe | nom, bio, experience, langues, competences, disponibilite, badge verifie : oui. **Photo** (aucun champ), **note, nombre d'avis, interventions, prix : non** |
| Reservation | — | **rien** : offres (Phase 7), intervention (8), paiement (9) |
| Suivi en temps reel | — | **rien** : Phase 8 ; aucun fournisseur de carte (`MAP_PROVIDER=dev`) |
| Avis et confiance | — | **rien** : Phase 10 |

Barre de navigation basse : Accueil et Messages (API `GET /conversations`
disponible, ecran de liste a creer) sont legitimes ; Profil aussi
(`/auth/me`) ; **Favoris non** — lien mort.

**Recommandation** : la refonte habille ce qui existe et construit
seulement ce que les donnees reelles permettent. Les ecrans 4 a 6 seront
realises **avec** leurs phases (7, 8, 10), directement dans le nouveau
style. Les construire maintenant produirait des maquettes cliquables
presentees comme reelles, ce que 03_AGENT_PROTOCOL §2 interdit. **A
confirmer (D2).**

De meme, le panneau d'integration liste des « fonctionnalites a
conserver » **qui n'existent pas** : connexion par reseaux sociaux,
paiement carte/especes, suivi de mission, avis, notifications push et
in-app, dashboard artisan. On ne peut pas les « conserver » ; la refonte
ne les creera pas.

## 5. Autres decisions a prendre avant de commencer

- **D3 — Couleurs et icones metiers.** Le catalogue n'a ni icone ni
  couleur (`level, parentId, name, description, order, active,
  requiredSkillIds`). Soit (a) champs optionnels `icon` / `accentColor` sur
  les noeuds, administrables dans le back-office existant — c'est une
  modification du modele de donnees, soumise a validation par
  05_DECISION_POLICY ; soit (b) une table de correspondance cote interface,
  indexee par nom — fragile, casse au premier renommage. **Recommande :
  (a).**
- **D4 — Logo et illustrations.** Aucun fichier vectoriel fourni ; le
  logo n'existe qu'en pixels dans l'image. Il me faut `logo-fixiyi.svg`.
  Pour l'artisan de l'onboarding et les photos de profil, je n'utiliserai
  pas de photos de banque d'images presentees comme de vrais artisans :
  illustration fournie par toi, ou avatar a initiales.
- **D5 — Architecture cible.** Le panneau decrit une structure React
  Native (`src/screens/*.tsx`, `theme/*.ts`). Fixiyi est un monorepo
  Next.js ; l'application mobile est la Phase 13 et n'existe pas
  (Decision 12). Correspondance proposee : `theme/` ->
  `packages/design-tokens`, `components/ui` -> `packages/ui`, `screens/`
  -> `apps/web/src/app/*` (et `apps/admin`). Aucune structure React Native
  creee.
- **D6 — Chargement des polices** avec `next/font` (fonction integree a
  Next, aucune dependance) : Inter + Noto Sans Arabic, auto-hebergees au
  build. Le build Docker aura besoin du reseau au moment du build.
- **D7 — Plus Jakarta Sans** : la planche la cite en alternative. Une
  seule famille, Inter, sauf avis contraire.

## 6. Ce qui doit etre preserve (contrat de non-regression)

- **542 tests** (api 278, ui 125, contracts 90, autres 49) et les **5
  scenarios Playwright** — dont le chat a deux navigateurs.
- **38 `data-testid`** utilises par Playwright : ils restent stables.
- Invariants du Design System (section 2) et **RTL** : la planche est en
  francais LTR, le produit sert aussi ar/ary.
- Toutes les fonctionnalites livrees en Phases 0-6 : auth OTP et refresh,
  creation de demande et medias, matching et expansion de rayon, boite
  fournisseur, chat temps reel et anti-contact, back-office catalogue.

Ecrans a refondre : web `login`, `requests/new`, `requests/[id]/match`,
`provider/requests`, `conversations/[id]` ; admin `login`, `catalog`.

## 7. Ce que les 14 phases devront respecter

Quand tu me les transmettras, je les confronterai a ces contraintes et te
signalerai tout conflit avant de commencer :

1. Tokens d'abord (couleurs par roles, typo, rayons, ombres, polices),
   puis composants, puis ecrans : chaque couche testee avant la suivante.
2. Aucun ecran ni etat sans donnees reelles (section 4).
3. Chaque phase se termine par les gates complets, Playwright rejoue
   contre des images Docker reconstruites, captures d'ecran, commit et
   `docs/design/PHASE_X_REPORT.md`.
4. Contraste mesure, pas estime.

## 8. Decisions attendues avant la phase 1

| # | Decision | Ma recommandation |
|---|---|---|
| D1 | Orange et accessibilite | roles `#F97316` / `#EA580C` / `#C2410C` |
| D2 | Ecrans sans backend | exclus ; realises avec les phases 7, 8, 10 |
| D3 | Icones et couleurs metiers | champs optionnels sur le catalogue |
| D4 | Logo et illustrations | fournir le SVG ; avatars a initiales |
| D5 | Architecture | monorepo existant, pas de React Native |
| D6 | Polices | `next/font`, Inter + Noto Sans Arabic |
| D7 | Famille | Inter seule |
