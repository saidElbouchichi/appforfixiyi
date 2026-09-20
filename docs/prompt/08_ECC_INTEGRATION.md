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

## Cycle par phase (avec ECC)

LIRE PROGRESS.md → LIRE DECISIONS.md → IDENTIFIER phase →
PLANIFIER → [ECC: /ecc:plan] → IMPLÉMENTER → TESTER →
[ECC: /ecc:review] → [ECC: /ecc:security] → CORRIGER →
DOCUMENTER → COMMIT → METTRE À JOUR PROGRESS.md → STOP →
attendre GO PHASE X+1

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

Commit de référence : d84703e (fin Phase 5)
En cas de problème : git reset --hard d84703e

## Résumé

- Hiérarchie : Fixiyi > ECC
- Version ECC : v2.2.2
- Hooks : Minimal
- Mémoire : Fixiyi uniquement

En cas de conflit, Fixiyi gagne toujours.
