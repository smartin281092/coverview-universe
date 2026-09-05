# Platform

## Résumé

Socle technique de CoverView Core : configuration, processus HTTP, sondes de santé et données techniques de preview. Le module [identity](../modules/identity/README.md) est propriétaire de l’authentification, des identités personnelles et des permissions associées.

## Périmètre

Fastify utilise les contrats partagés, PostgreSQL via Drizzle et le client Redis officiel. MinIO et Mailpit sont sondés uniquement en mode adaptateur local. Platform enregistre le module identity ; lorsque `AUTH_ENABLED=true`, celui-ci utilise WorkOS. Les sondes et les fixtures platform n’émettent aucun email, fichier ou paiement métier.

## Règles métier et invariants

Les gardes exécutables de `config.ts` appliquent ENV-08/09 et BACK-07. Les rôles de preview ne définissent ni tenancy ni permissions produit. Les migrations identity ajoutent des tables distinctes sans convertir les personas en utilisateurs. Liveness et readiness sont distincts (OBS-04).

## Permissions

Les sondes sont publiques et ne retournent que l'état global. `/local/personas` existe seulement si le mode local validé est actif ; le socket et l'hôte HTTP doivent être loopback. Les personas ne sont pas des comptes de connexion et ne donnent accès à aucune opération métier. Les règles de propriété, d’habilitation et de MFA vivent dans [identity](../modules/identity/README.md#permissions).

## État réel

API et connexions techniques implémentées ; preuves du socle dans [S-000a](../../../../roadmap/evidence/S-000a.md), intégration de l’identité et limites externes dans [S-000b](../../../../roadmap/evidence/S-000b.md). Les personas restent fictives. Le succès des sondes de santé n’est pas une preuve de connexion WorkOS.

## Données et exploitation

`local_preview_personas` conserve uniquement des identifiants techniques et des libellés/adresses fictifs. Propriétaire : platform. Catégorie : fixture locale, sans PII réelle ni donnée privée utilisateur. Export/rétention produit non applicables ; suppression physique lors du reset local explicite, jamais de durée légale inventée. Les identifiants sont déclarés une seule fois dans `db/seed/personas.mjs` (ENV-03).

Readiness interroge PostgreSQL (et le schéma en mode fixture), Redis, puis les sondes MinIO/Mailpit locales. Les appels externes sont bornés ; les logs de dépendances indiquent leur nom, sans URL ni credential. L'arrêt ferme la base et borne le délai de terminaison.

`loadEnvironment` charge la configuration locale `.env`, puis valide l’environnement du processus. Le fichier d’exemple laisse `AUTH_ENABLED=false`. Pour l’activer, l’opérateur injecte les credentials WorkOS et la clé de session uniquement dans le processus API ; la [procédure identity](../modules/identity/README.md#activer-et-vérifier-localement) précise les origines, l’émetteur et les vérifications. Aucune variable secrète ne doit être placée dans `.env` ni transmise au build des frontends.

`pnpm db:migrate` et `pnpm db:seed` sont gardés sur une base CoverView locale/test en loopback. Le reset exige en plus la base exacte `coverview_local`, `--confirm-local-reset` **et** `--confirm-identity-reset`. La commande opérateur `pnpm db:reset -- --confirm-local-reset --confirm-identity-reset` supprime les sept tables identity, leur audit, la table des personas et le journal Drizzle, puis rejoue migrations et seeds. Elle ne révoque pas les sessions distantes WorkOS. Ne l’utiliser qu’après autorisation explicite de perdre ces données et contrôle de la base cible ; elle ne fait partie ni du démarrage normal ni du rollback applicatif. Cette documentation n’exécute pas de reset.

Les migrations identity sont additives : revenir à l’application N-1 conserve les tables et l’audit. Leur suppression serait une opération distincte nécessitant une stratégie d’export/restauration et une autorisation explicite.

## Vérification

`pnpm --filter api check:env`, `typecheck`, `test` et `build` vérifient le socle. La suite `database.test.ts` démarre un vrai PostgreSQL jetable via Testcontainers, rejoue migration/seeds et vérifie les contraintes SQL. Les tests écrits dans cette slice ne constituent pas une revue humaine indépendante (TEST-10).
