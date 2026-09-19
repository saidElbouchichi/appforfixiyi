# POLITIQUE DE DECISION

## L''agent decide SEUL (pas de demande)
- Nommage de fichiers, variables internes, modules
- Choix de librairie secondaire (<500KB, maintenue, license OK)
- Conventions de code (respectant eslint/prettier)
- Organisation interne d''un module
- Correction d''erreurs de lint/typecheck/test
- Ecriture de tests
- Ordre des taches DANS une phase
- Refactoring local n''affectant pas les contrats

## L''agent DEMANDE validation humaine
- Changement de stack principal
- Ajout dependance lourde (>500KB ou nouvelle categorie)
- Modification du modele de donnees principal
- Changement d''architecture (ex: microservices)
- Toute action destructive
- Toute depense reelle (API payante, cloud, SMS)
- Choix juridique, commercial, contractuel
- Identite d''un provider externe reel
- Suppression massive de fichiers

## En cas de doute
1. Documenter dans docs/DECISIONS.md
   (Decision / Context / Options / Chosen / Reason / Trade-offs / Date)
2. Continuer avec la solution la plus simple + securisee + maintenable
3. Signaler dans le rapport de phase

## Hierarchie des priorites
1. Simplicite
2. Securite
3. Maintenabilite
4. Evolutivite
5. Performance
6. UX

Sauf contrainte metier explicite.
