# PHASE 9 (REFONTE) — ETATS — PLAN

Date : 2026-09-25. Statut : **plan ecrit, implementation en cours**
(consolidation, pas de nouvelle fonctionnalite ; l'utilisateur n'a pas
demande de barriere de relecture cette fois).

`PLAN.md` classe les phases 9, 10, 11 et 13 comme des passes de
**consolidation** : chaque phase anterieure a deja livre ses etats. Cette
phase ne rattrape donc pas un manque, elle enleve les divergences.

## 1. Audit — ce que les 14 ecrans font aujourd'hui

Mesure, pas impression : les 14 `page.tsx` de `apps/web` et `apps/admin`.

**Ce qui est deja bon** : chaque ecran qui charge quelque chose a un
`Skeleton`, un `ErrorState` et, quand la liste peut etre vide, un
`EmptyState`. Les libelles de chargement suivent deja une meme forme
(« Chargement de/des/du X… »). Rien a rattraper.

**Les quatre divergences reelles** :

### A. Le meme ternaire, onze fois

```tsx
message={xQuery.error instanceof ApiError ? xQuery.error.message : "Impossible de charger X."}
```

Onze copies dans onze fichiers. Chacune peut deriver : oublier le
`instanceof` et afficher `[object Object]`, ou perdre le repli.

### B. Du vocabulaire moteur a survecu dans les etats

La phase 8 a nettoye les ecrans mais pas leurs **etats** :
`label="Chargement du matching…"` et `"Impossible de charger le matching."`
parlent encore la langue de `matching.service.ts`. C'est le meme defaut,
cache un cran plus bas.

### C. Reessayer, la ou reessayer sert

Cinq `ErrorState` n'offrent pas de `onRetry`. Trois ont raison de ne pas en
offrir — « Acces refuse » (x2) et « Profil introuvable » : reessayer ne
changera rien. Deux sont de vraies pannes de chargement qui devraient en
avoir.

### D. Deux formulations pour une meme situation

« Aucune demande » (liste du client) et « Aucune demande pour le moment »
(boite de l'artisan). Meme vide, deux phrases.

(« Catalogue vide » cote admin et « Catalogue en cours de constitution » cote
visiteur sont **volontairement** differents : un operateur et un visiteur
n'ont pas besoin de la meme phrase.)

## 2. Ce que la phase fait

1. **Un helper** `errorMessage(error, fallback)` dans `apps/web/src/lib` —
   le ternaire dit une fois. Meme principe que `labels.ts` en phase 8 :
   la duplication est ce qui derive.
2. **Les deux libelles « matching »** passent en langue du client.
3. **`onRetry` ajoute** aux deux erreurs de chargement qui en manquent ; les
   trois autres restent sans, et le rapport dit pourquoi.
4. **Les deux vides harmonises**.
5. **Un test qui verrouille** : aucun etat n'affiche de terme technique, et
   tout `ErrorState` de chargement offre un `onRetry`.

## 3. Ce que la phase ne fait pas

- Pas de nouvel etat la ou il n'en manque pas.
- Pas de refonte visuelle des composants `Skeleton` / `ErrorState` /
  `EmptyState` : ils viennent de la phase 4 et sont testes.
- Pas d'invention : un vide reste un vide.

## 4. Tests

- Unitaires : `errorMessage` (ApiError, erreur inconnue, message vide).
- Un test de coherence sur les sources, comme `env-usage.test.ts` l'a fait
  pour la configuration : il lit les ecrans et echoue si un etat contient un
  terme du moteur ou si une erreur de chargement n'offre pas de reprise.
- Playwright : les 49 scenarios passent sans modification.

## 5. Risques

- **Le test de coherence lit les sources** : il peut devenir bruyant s'il est
  trop strict. Il ne verifie que deux choses precises, et sa liste de termes
  interdits est courte et explicite.
- **Harmoniser n'est pas uniformiser** : deux publics differents gardent deux
  phrases differentes (le cas admin/visiteur ci-dessus).
