# PHASE 12 (REFONTE) — ANIMATIONS — RAPPORT

Date : 2026-09-27. Statut : **TERMINEE**. Plan : `PHASE_12_PLAN.md`.
Diagnostic : `PHASE_12_DIAGNOSTIC.md`. Preuves : `evidence/phase12/`.

## 1. Objectif et resultat

« Micro-interactions » (`PLAN.md`). La consigne : une animation n'existe que
si elle aide a comprendre, jamais pour decorer, et `prefers-reduced-motion`
est respecte.

Le mouvement existait deja (Decision 49, phase 4). La phase l'a **mesure
dans le navigateur** pour la premiere fois (`document.getAnimations()`),
avec un instrument verifie avant d'etre cru (une animation temoin, hors des
deux regles de mouvement reduit, est vue dans les deux modes).

- **Ce qui tenait** : mouvement reduit partout, durees et courbes issues des
  jetons, WCAG 2.2.2 (seules les attentes bouclent ; l'urgence pulse 4,5 s),
  proprietes composees.
- **Ce qui ne tenait pas** : des animations d'entree qui **rejouaient sur du
  contenu deja la** — tout l'historique du chat a chaque ouverture, les
  listes a chaque retour, la carte de connexion a chaque visite. Une entree
  dit « ceci arrive » ; ici elle disait faux.

**Aucune animation ajoutee. Trois retirees la ou elles mentaient.**

## 2. La regle retenue : une entree = une arrivee (Decision 82)

| Contenu | Avant | Apres |
|---|---|---|
| Message envoye ou recu, fil ouvert | entre | entre |
| Historique a l'ouverture (4 messages) | 4 entrees | **0** |
| Pages de messages plus anciennes | entrent | immobiles |
| Liste qui remplace son squelette | entre | entre |
| Meme liste, retour en cache | entre (3) | **0** |
| Carte de `/login` | glisse a chaque visite | immobile |

Mise en oeuvre : `lib/arrivals.ts` (ligne de base sur `seq`, 7 tests) et
`lib/use-entrance.ts` (etat de chargement lu au montage), sept listes.

## 3. Fichiers

- `apps/web/src/lib/arrivals.ts`, `arrivals.test.ts`, `use-entrance.ts`
- `apps/web/src/app/conversations/[id]/{page,message-item}.tsx`
- `apps/web/src/app/{page,services/page,requests/page,conversations/page,provider/requests/page,requests/[id]/match/page,requests/new/service-cascade}.tsx`
- `apps/{web,admin}/src/app/login/page.tsx`
- `tests/browser/tests/motion.spec.ts` (nouveau, 3 scenarios)
- `tests/browser/support/{test,rate-limits,global-setup}.ts`, onze specs
  (import de `test`)
- `tests/browser/audit/probe-*motion*.spec.*`, `probe-list-replay.spec.ts`

## 4. Tests

`motion.spec.ts` relit le mouvement dans le navigateur :

1. le chat anime ce qui arrive, jamais l'historique ;
2. une liste entre quand elle arrive, pas quand elle est deja la ; la page
   de connexion ne s'anime pas ;
3. sous mouvement reduit rien ne bouge au-dela de 1 ms ; sinon, seule une
   attente bouge plus de 5 s — sur 7 routes.

| Etape | Resultat | Preuve |
|---|---|---|
| Contre les anciennes images | **2 rouges** (1 et 2), le 3 vert — la mesure disait que M1/M3 tenaient | `rouge-avant-correction.txt` |
| Apres correction, images reconstruites | 3/3 | `vert-apres-correction.txt` |
| Deux regressions reintroduites (carte qui glisse ; `stagger` retire de la regle de mouvement reduit), image reconstruite | rouge sur chacune, par le bon controle | `mutation-casse.txt` |

| Suite | Avant | Apres |
|---|---|---|
| Playwright | 55 | **58** — 58/58, deux passes enchainees |
| `apps/web` (vitest) | 59 | **66** |
| Monorepo (vitest) | 842 | **849** |

La premiere passe complete a donne **56/58** : la suite depassait le quota
OTP de l'API (32 verifications pour 30 par heure, lu dans Redis). Corrige
cote tests par une remise a zero par test, plafond inchange (Decision 83,
diagnostic §3.4). Preuve : `playwright-complet-avant-quota-56sur58.txt`.

## 5. Commandes

```
pnpm turbo run lint typecheck test build --force   # 15/15, 15/15, 14/14, 10/10
pnpm test:coverage                                 # 15/15, planchers tenus
docker compose -f docker-compose.yml -f docker-compose.dev.yml build web admin
cd tests/browser && npx playwright test            # 58/58 (x2)
npx playwright test --config audit/playwright.config.ts probe-motion probe-chat-motion probe-list-replay
```

Lint sans avertissement. Couverture `web` 20,05 % -> 20,58 %.

## 6. Decisions

- **82** — une animation d'entree n'est jouee que pour un contenu qui arrive.
- **83** — la suite navigateur remet les quotas de l'API a zero avant chaque
  test.

## 7. Problemes rencontres

- Premier echec complet 56/58 (quota), explique par la mesure (§4).
- Ma sonde de liste a casse apres la correction (elle visait la classe
  retiree) : instrument corrige, pas le produit.
- Lancer un seul fichier Playwright efface `screenshots/`, qui est aussi
  l'`outputDir` : cause des captures « supprimees » vues en phase 11.

## 8. Limitations

- Pas de verification au lecteur d'ecran ni sur appareil reel : le
  mouvement est lu dans le DOM de Chromium.
- Une liste revisitee en cache n'anime pas les lignes qui arrivent ensuite en
  direct (diagnostic §6).
- `outputDir` partage avec les captures nommees : a separer en phase 14.

## 9. Prerequis et prochaine phase

Gates sans cache, couverture, images `web` et `admin` reconstruites, 58/58 x2,
captures examinees. Prochaine : **phase 13, tests** (enchainee, Decision 81).
