# Vérification Admin — 24 heures

Demande explicite du 11 septembre 2026 : espacer les revérifications d’identité dans Admin. La preuve MFA passe de 15 minutes à 24 heures. Les nouvelles connexions ouvertes depuis Admin utilisent `AUTH_ADMIN_SESSION_TTL_SECONDS=86400` par défaut, toujours limitées par la session WorkOS ; les sessions existantes gardent leur expiration initiale. La politique est documentée dans le README identity.

Vérifié : 22 tests passent (politique MFA, routes identity avec PostgreSQL isolé et fournisseur WorkOS simulé explicitement, gestion administrative). Acceptation juste avant 24 heures, refus à 24 heures, preuve absente/future, absence d’habilitation ; nouvelles sessions Admin de 24 heures, Wallet de 8 heures, expiration distante prioritaire et absence de droit implicite par choix de surface. Le test préexistant d’expiration MFA administrative utilise désormais la limite demandée de 24 heures.

Types API, lint ciblé, build API et validation de configuration passent. API de preview redémarrée avec succès, frontends existants conservés. Aucun secret, session ou permission existante modifié en base ; aucune migration/dépendance. Une durée WorkOS réelle de 24 heures n’est pas prouvée par les doubles de test.
