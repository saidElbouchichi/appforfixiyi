# PHASE 14 (REFONTE) — NETTOYAGE — PLAN

Date : 2026-09-27. Enchainee sans GO intermediaire (Decision 81).

Sources lues : `docs/PROGRESS.md`, `docs/DECISIONS.md` (20, 74, 81 a 85),
`PHASE_13_REPORT.md` et `PHASE_13_DIAGNOSTIC.md`, `PLAN.md` (ligne 25 :
« refactoring, `09_DESIGN_SYSTEM_RULE.md`, `00_README.md` point 9 »),
`docs/prompt/00_README.md`, `README.md`.

> **Ordre reel, dit tel quel** : ce plan a ete ecrit **apres** la mesure
> initiale (knip, licences, origine des `PARSE_ERROR`), et apres une
> correction faite pendant l'investigation, celle du denominateur de
> couverture (§2, point 3), parce que la cause n'etait visible qu'en la
> corrigeant. Toutes les autres corrections suivent ce plan.

## 1. Consigne

Retirer le code mort, supprimer les dependances inutiles, documenter les
licences, verifier la coherence globale ; et, par `PLAN.md`, ecrire la regle
du design system (`09_DESIGN_SYSTEM_RULE.md`) et l'ajouter au point 9 de
l'ordre de lecture de `00_README.md`.

## 2. Mesure (faite avant ce plan)

1. **knip 5** (ponctuel, rien ajoute au depot) : 43 constats bruts. Verifies
   un a un :
   - **2 dependances mortes reelles** : `react-hook-form` (`web`, `admin`,
     importe nulle part) et `source-map-support` (`api`, cite seulement dans
     `package.json`) ;
   - **5 faux positifs** : `audit/playwright.config.ts` (passe par
     `--config`), `postcss` « non liste » (la configuration nomme seulement
     le plugin), `next` dans `tsconfig` (plugin du service de langage),
     `ResourceOwnerGuard` / `OwnedBy` (**Decision 20** : prets et testes,
     sans consommateur a dessein) ;
   - **12 exports « inutilises »** : tous utilises **dans leur propre
     fichier** — un mot-cle `export` superflu, pas du code mort ;
   - **25 types exportes** : ils decrivent des signatures publiques.
2. **Licences** : 369 paquets de production, aucun copyleft.
3. **`PARSE_ERROR` de couverture** (24, depuis au moins la phase 11) : la
   couverture des fichiers qu'aucun test n'importe est calculee sur du JSX
   non transforme (`"jsx": "preserve"`, exige par Next) et echoue. **Toutes
   les pages sortaient du denominateur** : `web` 16,4 % reels (et non 38 %),
   `admin` 22,3 % (et non 64,6 %).
4. Reportes des phases 12-13 : `outputDir` Playwright partage avec les
   captures nommees ; `new: true` de Mongoose deprecie (4 usages).
5. Coherence : `README.md` perime (« phases 1 a 5 sur 14 », React Hook
   Form) ; sections perimees de `PROGRESS.md` (« Derniere action
   effectuee » = phase 6).

## 3. Taches, dans l'ordre

1. Denominateur de couverture : `oxc.jsx` dans les deux configurations de
   test ; planchers **rebases** sur la mesure honnete (Decision 86).
2. Dependances mortes retirees ; gates relancees (la preuve qu'elles
   etaient mortes, c'est que rien ne casse).
3. `export` superflus retires **dans les fichiers de la refonte seulement**
   (polices, support des tests). Ceux de `apps/api` sont hors du perimetre
   de la refonte : signales, pas touches.
4. `outputDir` Playwright separe des captures nommees.
5. `new: true` -> `returnDocument: "after"` (option non depreciee, meme
   comportement) ; suites e2e de l'API relancees.
6. `docs/LICENSES.md`.
7. `docs/prompt/09_DESIGN_SYSTEM_RULE.md` et point 9 de `00_README.md`.
8. `README.md` et sections perimees de `PROGRESS.md`.

## 4. Criteres de fin

- knip ne rapporte plus que les faux positifs et exports documentes au §2 ;
- 0 `PARSE_ERROR` ; planchers verts sur le denominateur honnete ;
- lancer un seul fichier Playwright ne supprime plus aucune capture nommee ;
- 0 avertissement de depreciation Mongoose dans les tests de l'API ;
- gates sans cache, couverture, mutation, Playwright complet (images
  reconstruites : `web` et `admin` perdent une dependance).

## 5. Risques

- **Baisser un plancher** contredit la lettre de la Decision 74. C'est la
  mesure qui etait fausse, pas le code qui a recule ; la decision est ecrite
  (86), le chiffre faux est corrige partout ou il est cite.
- `returnDocument` : option de Mongoose 8+, verifiee par les suites e2e
  reelles de l'API (Mongo), pas par un mock.
- Retrait d'une dependance : les images Docker sont reconstruites et la suite
  complete rejouee, pas seulement `build`.
