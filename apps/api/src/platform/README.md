# Platform

## Résumé

Socle technique de CoverView Core : configuration, processus HTTP, sondes de santé et données techniques de preview. Aucun domaine métier n'est encore implémenté.

## Périmètre

Fastify utilise les contrats partagés, PostgreSQL via Drizzle et le client Redis officiel. MinIO et Mailpit sont sondés uniquement en mode adaptateur local. Aucun email, fichier, appel WorkOS, paiement ou traitement externe n'est émis.

## Règles métier et invariants

Les gardes exécutables de `config.ts` appliquent ENV-08/09 et BACK-07. La migration ne crée que des données techniques de démonstration ; les rôles de preview ne définissent ni tenancy ni permissions produit. Liveness et readiness sont distincts (OBS-04).

## Permissions

Les sondes sont publiques et ne retournent que l'état global. `/local/personas` existe seulement si le mode local validé est actif ; le socket et l'hôte HTTP doivent être loopback. Les personas ne sont pas des comptes de connexion et ne donnent accès à aucune opération métier. S-000b introduira l'authentification WorkOS réelle.

## État réel

API et connexions techniques implémentées ; les résultats exécutés sont consignés dans le ledger S-000a. Personas fictives persistées, aucune preuve d'authentification ou d'isolation produit. Adaptateurs externes métier absents.

## Données et exploitation

`local_preview_personas` conserve uniquement des identifiants techniques et des libellés/adresses fictifs. Propriétaire : platform. Catégorie : fixture locale, sans PII réelle ni donnée privée utilisateur. Export/rétention produit non applicables ; suppression physique lors du reset local explicite, jamais de durée légale inventée. Les identifiants sont déclarés une seule fois dans `db/seed/personas.mjs` (ENV-03).

Readiness interroge PostgreSQL (et le schéma en mode fixture), Redis, puis les sondes MinIO/Mailpit locales. Les appels externes sont bornés ; les logs de dépendances indiquent leur nom, sans URL ni credential. L'arrêt ferme la base et borne le délai de terminaison.

## Vérification

`pnpm --filter api check:env`, `typecheck`, `test` et `build` vérifient le socle. La suite `database.test.ts` démarre un vrai PostgreSQL jetable via Testcontainers, rejoue migration/seeds et vérifie les contraintes SQL. Les tests écrits dans cette slice ne constituent pas une revue humaine indépendante (TEST-10).
