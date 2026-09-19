# ENVIRONNEMENT D''EXECUTION

## Detection obligatoire en Phase 0

Executer et documenter :

    uname -a (ou ver sur Windows)
    node --version
    pnpm --version
    docker --version
    docker compose version
    git --version

## Si un outil manque
- Documenter dans docs/CURRENT_STATE.md
- Utiliser docker-compose.yml si Docker dispo
- Sinon, creer docs/SETUP_REQUIRED.md
- NE PAS continuer une phase qui depend d''un outil manquant
- NE PAS installer de services systeme sans confirmation

## Cas particuliers

### Workspace vide
1. Creer structure monorepo
2. Initialiser pnpm + Turborepo
3. Creer packages vides avec package.json
4. Creer configs (tsconfig, eslint, prettier)
5. docs/CURRENT_STATE.md = "initialise, pret Phase 1"
6. STOP + validation

### Workspace avec code existant
1. Auditer chaque fichier
2. Classer : KEEP / REFACTOR / REPLACE / REMOVE
3. Documenter dans docs/CURRENT_STATE.md
4. Proposer plan de migration
5. STOP + validation

## Variables d''environnement
Voir .env.example a la racine.
Si un credential reel est necessaire -> demander a l''utilisateur,
ne jamais inventer, ne jamais hardcoder.

## Services de dev
- MongoDB : mongodb://localhost:27017
- Redis : redis://localhost:6379
- MinIO : http://localhost:9000 (console : 9001)
- MinIO credentials : minioadmin / minioadmin
