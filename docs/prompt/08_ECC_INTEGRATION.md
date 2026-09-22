# ECC INTEGRATION — Fixiyi

## Principe

ECC v2.2.2 est installé au scope User (global) avec hook profile
Minimal. Il est utilisé UNIQUEMENT dans Fixiyi.

## Hiérarchie des règles (CRITIQUE)

1. Règles Fixiyi (03_AGENT_PROTOCOL.md, 05_DECISION_POLICY.md, 06_SCOPE.md)
2. Contrats Fixiyi (01_SPEC_PRODUCT.md, 02_SPEC_ENGINEERING.md)
3. Commandes utilisateur (GO PHASE X, STOP, etc.)
4. ECC agents et skills (uniquement si compatibles)

En cas de conflit, Fixiyi gagne toujours.

## Lecture obligatoire avant chaque phase

AVANT CHAQUE PHASE, lire dans l'ordre :
1. docs/prompt/06_SCOPE.md
2. docs/prompt/03_AGENT_PROTOCOL.md
3. docs/prompt/05_DECISION_POLICY.md
4. docs/PROGRESS.md
5. docs/DECISIONS.md
6. docs/phases/PHASE_{N-1}_REPORT.md
7. docs/phases/PHASE_N_PLAN.md (si existe)

## Cycle par phase (avec ECC)

LIRE PROGRESS.md → LIRE DECISIONS.md → LIRE PHASE_{N-1} →
IDENTIFIER phase → PLANIFIER → [ECC: /ecc:plan] →
IMPLÉMENTER → TESTER → [ECC: /ecc:review] →
[ECC: /ecc:security] → CORRIGER → DOCUMENTER → COMMIT →
METTRE À JOUR PROGRESS.md → STOP → attendre GO PHASE X+1

## Commandes ECC disponibles

- /ecc:plan — Planification
- /ecc:review — Code review
- /ecc:security — Audit sécurité
- /ecc:tdd — TDD workflow
- /help — voir toutes les commandes

## Commandes Fixiyi (inchangées)

- GO PHASE X
- CONTINUE PHASE X
- STOP
- Vérification Fixiyi
- Reprise Fixiyi
- Prompt anti-oubli

## Règles de commit

APRÈS CHAQUE ÉTAPE VALIDÉE :
- git add .
- git commit -m "type: description"
- git log --oneline -3

APRÈS CHAQUE PHASE VALIDÉE :
- Commit dédié avec message clair
- Puis GO PHASE X+1

## Rollback

Commit de référence : d825a8a (fin phase 6 de la refonte design, 2026-09-22)
En cas de problème : git reset --hard d825a8a

À tenir à jour à la fin de chaque phase (Décision 69) : le commit précédent
(d84703e, fin Phase 5 produit) était périmé et aurait effacé la Phase 6
produit, les correctifs B1/B2, la refonte et l'audit.

`reset --hard` est destructif : jamais lancé sans accord explicite de
l'utilisateur (03_AGENT_PROTOCOL §2, 05_DECISION_POLICY).

## Résumé

- Hiérarchie : Fixiyi > ECC
- Version ECC : v2.2.2
- Hooks : Minimal
- Mémoire : Fixiyi uniquement
- Lecture obligatoire avant chaque phase

En cas de conflit, Fixiyi gagne toujours.
