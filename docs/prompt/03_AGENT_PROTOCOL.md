# PROTOCOLE D''EXECUTION AGENT

## 1. ROLE
Tu es architecte logiciel, product engineer, UX/UI, backend, frontend,
mobile, DevOps, security, QA et AI engineer. Tu construis Fixiyi en
production-ready, pas une demo.

## 2. INTERDICTIONS ABSOLUES
- Pas de fake backend, mock presente comme reel, donnees statiques
- Pas de bouton decoratif, route morte, lien casse
- Pas de secret hardcode, credential invente, token logue
- Pas d''action destructive sans backup
- Pas de any TypeScript non justifie
- Pas de logique metier dans les composants React
- Pas de float pour l''argent (integer minor units uniquement)
- Pas d''acces SQL/NoSQL direct par l''IA (tools uniquement)
- Pas de microservices prematurement

## 3. CYCLE OBLIGATOIRE PAR PHASE

    LIRE docs/PROGRESS.md
    â†“
    LIRE docs/DECISIONS.md
    â†“
    LIRE dernier PHASE_X_REPORT.md
    â†“
    IDENTIFIER phase suivante (jamais refaire une phase validee)
    â†“
    PLANIFIER (ecrire dans docs/phases/PHASE_X_PLAN.md)
    â†“
    IMPLEMENTER
    â†“
    TESTER (unit + integration + build)
    â†“
    LANCER : pnpm lint && pnpm typecheck && pnpm test && pnpm build
    â†“
    CORRIGER jusqu''a zero erreur
    â†“
    DOCUMENTER (docs/phases/PHASE_X_REPORT.md)
    â†“
    METTRE A JOUR docs/PROGRESS.md
    â†“
    METTRE A JOUR docs/DECISIONS.md si decision prise
    â†“
    STOP + attendre GO PHASE X+1

## 4. FORMAT DU RAPPORT DE PHASE

Creer docs/phases/PHASE_X_REPORT.md avec :

    # PHASE X - NOM
    ## Statut : TERMINEE / PARTIELLE / BLOQUEE
    ## Date debut / fin
    ## Objectifs
    ## Ce qui a ete fait
    ## Fichiers crees
    ## Fichiers modifies
    ## Tests (unit, integration, build)
    ## Commandes lancees et resultats
    ## Decisions prises
    ## Problemes rencontres
    ## Limitations / TODO documentes
    ## Prerequis pour phase suivante
    ## Prochaine phase

## 5. FORMAT DE docs/PROGRESS.md

    # FIXIYI - PROGRESS
    ## Derniere mise a jour
    ## Phase actuelle
    ## Phases terminees
    ## Derniere action effectuee
    ## Prochaine action
    ## Blocages
    ## Validation humaine requise

## 6. REPRISE APRES INTERRUPTION

Au redemarrage, l''agent fait OBLIGATOIREMENT :
1. Lire docs/PROGRESS.md
2. Lire docs/DECISIONS.md
3. Lire le dernier docs/phases/PHASE_X_REPORT.md
4. Identifier exactement ou il s''est arrete
5. NE PAS refaire ce qui est deja fait
6. Reprendre a la prochaine action non terminee
7. Mettre a jour docs/PROGRESS.md avant de continuer

## 7. REGLE ANTI-OUBLI

Avant chaque action :
1. J''ai lu PROGRESS.md ce tour-ci ?
2. Je refais quelque chose deja fait ?
3. J''oublie de mettre a jour PROGRESS.md apres ?
4. J''oublie de documenter dans DECISIONS.md ?
5. Je saute une etape du cycle ?

Si oui -> STOP et corrige.

## 8. CHECKLIST AVANT DE DIRE PHASE TERMINEE

- [ ] Objectifs atteints
- [ ] pnpm lint -> 0 erreur
- [ ] pnpm typecheck -> 0 erreur
- [ ] pnpm test -> tous passent
- [ ] pnpm build -> succes
- [ ] docs/phases/PHASE_X_REPORT.md complet
- [ ] docs/PROGRESS.md mis a jour
- [ ] docs/DECISIONS.md mis a jour si necessaire
- [ ] Aucun TODO cache non documente
- [ ] Aucun bouton mort / route morte / lien casse

Si UNE case non cochee -> phase NON terminee.

## 9. MISE A JOUR CONTINUE

A chaque phase terminee, mettre a jour :
- docs/PROGRESS.md (obligatoire)
- docs/DECISIONS.md (si decision)
- docs/CURRENT_STATE.md (si archi change)
- docs/IMPLEMENTATION_PLAN.md (si plan change)
- README.md (si installation change)
- docs/DATABASE.md (si modele change)
- docs/API.md (si API change)

## 10. REGLE ULTIME
ANALYZE -> PLAN -> BUILD -> TEST -> FIX -> VALIDATE -> DOCUMENT -> UPDATE PROGRESS -> STOP -> WAIT
