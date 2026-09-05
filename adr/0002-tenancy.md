# ADR-0002 — Identités et frontières métier

Date : 2026-09-05 · Statut : cadrage retenu ; schéma et matrice de droits à spécifier.

## Contexte

La bible §9, §19, §67/69/70 et R2/R15 décrit une identité unique avec plusieurs rôles, des comptes de foyer distincts, des accès partenaires limités et des usages professionnels. Le défaut du harness « organisation B2B pour tout » ne suffit pas à décrire ce produit.

## Décision

Séparer identité, propriété de données, unité économique foyer, appartenance professionnelle et permission effective. Le foyer est une unité de calcul Retire, **pas un droit d'accès global**. Une organisation WorkOS et un rôle dans une interface ne dispensent pas d'une policy métier par ressource. Les applications principales consomment une base métier commune ; les frontières Exchange suivent la bible §12.

Le détail de partage, consentement, délégation conseiller et rôles professionnels demeure ouvert ; aucune table définitive ni accès implicite n'est créé dans cette préparation. La première slice qui matérialise ces droits doit les préciser, les sourcer et tester les refus inter-utilisateurs/inter-espaces.

## Alternatives et conséquences

Rejeter « un compte partagé par foyer » et « une organisation donne accès à toutes les données » : incompatibles avec les identités distinctes et le partage autorisé de la source. Rejeter aussi un grand tenant CoverView accordant à tous les utilisateurs l'accès global. Le mapping vers WorkOS se fera selon AUTH-11 ; les fixtures suivront ENV-09.

## Migration

Aucune migration applicative aujourd'hui. L'ADR évoluera avec le plan du modèle de données, avant persistance des droits.
