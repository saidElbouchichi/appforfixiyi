# DECISIONS — REFONTE DESIGN SYSTEM V2

Journal des decisions de la refonte (mission hors protocole, voir
`AUDIT.md`). Format identique a `docs/DECISIONS.md`.

Les 7 decisions ci-dessous ont ete **validees par l'utilisateur le
2026-09-21**, apres l'audit. Aucune n'est encore implementee : aucune
modification de code avant reception des parties 2/3 et 3/3 du master
prompt et du « GO Refonte Design ».

---

## D1 - L'orange par roles, pour tenir WCAG 2.2 AA

- Contexte : texte blanc sur l'orange primaire de la planche `#F97316` =
  **2,80:1**, sous le seuil texte (4,5:1) et sous le seuil des composants
  graphiques (3:1). Les boutons primaires de la maquette sont non conformes.
- Options : (a) `#F97316` tel quel ; (b) `#F97316` avec texte fonce
  `#1C1917` (6,24:1) ; (c) les trois oranges de la planche, chacun a un role.
- Choix : (c).
  - `#F97316` : marque et decor — logo, illustrations, fonds de mise en
    avant. **Jamais porteur de texte**, jamais seul porteur d'information
    sur fond blanc.
  - `#EA580C` (3,56:1) : icones, bordures, anneau de focus.
  - `#C2410C` (5,18:1) : texte et boutons portant du texte, liens.
- Raison : conformite AA sans ajouter une seule couleur a la palette.
- Trade-offs : les boutons primaires sont d'un orange plus profond que sur
  la planche. Accepte par l'utilisateur.
- Extension : meme principe pour les semantiques et les metiers — la teinte
  de la planche pour les fonds et pastilles, une nuance plus foncee,
  mesuree, pour le texte et les icones.
- Date : 2026-09-21

## D2 - Pas d'ecran sans backend

- Contexte : 3 des 6 ecrans de la planche reposent sur des fonctionnalites
  inexistantes.
- Choix : **exclus de la refonte**, realises dans leur phase, directement
  dans le nouveau style :
  - Reservation — Phases 7, 8, 9 ;
  - Suivi en temps reel — Phase 8 ;
  - Avis et confiance — Phase 10.
  Meme regle pour les donnees sans source : notes, nombre d'avis,
  interventions, prix « a partir de », services « populaires », favoris,
  « +12 000 clients satisfaits ».
- Raison : 03_AGENT_PROTOCOL.md §2 (pas de donnees statiques presentees
  comme reelles, pas de bouton decoratif, pas de route morte) reste en
  vigueur pendant la refonte.
- Date : 2026-09-21

## D3 - Icone et couleur des metiers portees par le catalogue

- Contexte : les tuiles de categories de la planche ont une icone et une
  couleur propres ; le catalogue n'a aucun champ pour les porter.
- Options : (a) champs optionnels sur les noeuds du catalogue,
  administrables ; (b) table de correspondance cote interface, indexee par
  nom.
- Choix : (a). « ServiceCategory » n'existe pas en tant que tel dans
  Fixiyi : l'equivalent est le **noeud de catalogue generique** (une seule
  collection `catalog_nodes` pour tous les niveaux, Decision 26). Les champs
  `icon` et `accentColor`, optionnels, s'ajoutent a ce noeud.
- Raison : (b) casserait au premier renommage d'une categorie dans le
  back-office. (a) laisse l'administrateur maitre de l'affichage.
- Nature : **modification du modele de donnees principal** — soumise a
  validation par 05_DECISION_POLICY.md, **validation obtenue**. Consignee
  aussi dans `docs/DECISIONS.md` (Decision 62).
- A preciser a l'implementation : valeurs admises (liste fermee d'icones du
  Design System, couleur limitee a la palette metiers) et regle
  d'heritage (un noeud sans valeur prend celle de son ancetre le plus
  proche).
- Date : 2026-09-21

## D4 - Logo et illustrations : pas d'image inventee

- Contexte : le logo n'existe qu'en pixels dans la planche ; aucune
  illustration ni photo n'est fournie.
- Choix :
  - le logo SVG sera fourni par l'utilisateur ; en attendant, pas de
    reproduction approximative de la marque ;
  - **avatars a initiales** a la place des photos ;
  - **placeholders neutres** a la place des illustrations ;
  - **jamais** de photo d'artisan inventee ou de banque d'images presentee
    comme un vrai prestataire.
- Statut : **en attente du fichier logo.**
- **Precision de l'utilisateur (2026-09-21)** : pas de logo SVG pour
  l'instant ; placeholders autorises :
  - logo : **texte « Fixiyi » en Inter 800, couleur `#C2410C`** (4,96:1 sur
    `#FAFAF9`). Option retenue plutot que l'icone composite « cle + eclair »
    proposee en alternative : dessiner un pictogramme reviendrait a creer un
    logo de marque non fourni ;
  - avatars : **initiales sur fond de couleur metier** (6 metiers). Les
    initiales sont du texte, donc soumises a 4,5:1 : paires fond/texte
    mesurees et testees — texte fonce `#1C1917` sur Electricien, Plombier,
    Climatisation, Peintre ; texte blanc sur Menuisier ; Serrurier passe a
    la nuance `#7C3AED` (5,70:1), `#8B5CF6` n'atteignant 4,5:1 ni en blanc
    (4,23) ni en fonce (4,13) ;
  - interdits : photos d'artisans inventees, illustrations de banque
    d'images, logos non fournis.
- Date : 2026-09-21

## D5 - Architecture : le monorepo existant, pas de React Native

- Contexte : le panneau d'integration decrit une structure React Native.
  L'application mobile est la Phase 13 et n'existe pas (Decision 12).
- Choix : correspondance vers l'existant.
  - `theme/` -> `packages/design-tokens`
  - `components/ui` -> `packages/ui`
  - `screens/` -> `apps/web/src/app/*` et `apps/admin/src/app/*`
- Date : 2026-09-21

## D6 - Polices chargees par `next/font`

- Contexte : la pile declare « Inter » mais aucune police n'est chargee ;
  le rendu actuel est la police systeme.
- Choix : `next/font` (integre a Next.js, aucune dependance ajoutee),
  **Inter** et **Noto Sans Arabic** (ar/ary), auto-hebergees au build.
- Trade-off : le build des images `web` et `admin` a besoin du reseau pour
  recuperer les polices.
- Date : 2026-09-21

## D7 - Une seule famille : Inter

- Contexte : la planche cite Plus Jakarta Sans en alternative.
- Choix : **Inter seule** (plus Noto Sans Arabic pour l'arabe, D6).
- Date : 2026-09-21
