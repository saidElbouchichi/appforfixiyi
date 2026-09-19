# FIXIYI - PROMPT MASTER

## Ordre de lecture obligatoire pour l''agent IA
1. 06_SCOPE.md
2. 03_AGENT_PROTOCOL.md
3. 04_ENVIRONMENT.md
4. 05_DECISION_POLICY.md
5. 01_SPEC_PRODUCT.md
6. 02_SPEC_ENGINEERING.md
7. 07_EXAMPLES.md

## Regle d''or
Ne JAMAIS coder sans avoir :
- lu tous les fichiers ci-dessus
- execute la Phase 0 (audit)
- produit docs/CURRENT_STATE.md
- produit docs/IMPLEMENTATION_PLAN.md
- produit docs/PROGRESS.md
- recu validation humaine pour passer a la Phase 1

## Reprise de session
A chaque nouvelle session, l''agent DOIT :
1. Lire docs/PROGRESS.md en premier
2. Lire docs/DECISIONS.md
3. Lire le dernier docs/phases/PHASE_X_REPORT.md
4. Reprendre EXACTEMENT a la phase suivante
5. Ne JAMAIS refaire une phase deja validee

## Commandes utilisateur reconnues
- GO PHASE X : demarrer la phase X
- CONTINUE PHASE X : reprendre la phase X
- STOP : arreter et resumer
- Verification Fixiyi : audit etat reel
- Reprise Fixiyi : reprendre apres interruption
- Prompt anti-oubli : recadrer l''agent
