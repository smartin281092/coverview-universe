# Client HTTP CoverView

Les opérations qualité, communications et pilotage/objectifs sont composées dans le client Partner existant, avec validation Zod, annulation et idempotence. Le type de transport commun évite une dépendance circulaire. [Règles lot3](../../apps/api/src/modules/partner-workspace/docs/quality-pilotage.md).

## Résumé

Frontière HTTP commune des surfaces, dérivée des schémas de `@coverview/contracts`.

## Périmètre

Sondes de disponibilité, personas locales, identité, espace privé, accès équipe, appareils, déconnexion, MFA et profil personnel ; timeout, annulation, corrélation et validation runtime sur chaque réponse. Profil : lecture/sauvegarde/confirmation, brouillon anonyme et renouvellement, rattachement et historique paginé du préremplissage. Les types publics dérivent des schémas de contrats.

## Règles métier et invariants

Aucun accès base ou règle métier. Toute réponse externe est validée ; les erreurs exposent un code stable, sans message fournisseur. La route de connexion reçoit une surface fermée, une éventuelle réauthentification et la continuation profil autorisée ; aucune URI de retour libre. Les segments et curseurs sont encodés.

## Permissions

Les sondes/personas omettent les credentials. Les lectures et mutations d’identité utilisent credentials include et cache no-store ; aucun header Authorization ni token durable. Chaque mutation exige le CSRF en mémoire de `/me` et une clé d’idempotence UUID fournie par l’appelant. Celui-ci conserve exactement cette clé lors d’un retry ; le client n’effectue aucun retry automatique. Le serveur décide des droits et de l’exposition des données.

Le timeout ordinaire reste de cinq secondes ; logout et révocation d’un appareil disposent de quinze secondes pour recevoir le résultat borné du serveur. Un timeout ne prouve jamais l’échec de la commande et doit garder la clé de reprise.

Les commandes de brouillon utilisent le CSRF renvoyé par son entrée anonyme ; son cookie opaque reste HttpOnly. Les commandes de profil connecté utilisent la session et son CSRF. Révisions optimistes et clés de rejeu sont fournies par le parcours propriétaire ; aucune métadonnée d’extraction n’est fabriquée par ce client.

## État réel

Client HTTP connecté à l’API ; la sélection locale d’une persona ne crée aucune session. Les tests HTTP couvrent isolation des credentials, absence des champs supplémentaires de token dans le DTO, bornes de réponse, codes de refus, timeout et conservation CSRF/idempotence. Aucun de ces tests simulant fetch ne prouve le login WorkOS réel.
