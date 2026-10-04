# API CoverView Core

Lot3 Partner : [qualité/enquêtes, communications, statistiques et objectifs](src/modules/partner-workspace/docs/quality-pilotage.md), contrats/SDK privés et intégrité0059. Aucune captation, émission externe ni signature réelle ajoutée ; activation en attente.

Lot2 Partner : routes privées de marketplace, conditions et registre économique, mandat Wallet distinct ; [règles et activation0058 en attente](src/modules/partner-workspace/docs/marketplace-economy.md). Aucun virement ni connexion bancaire ajouté.

L'[orientation vers CoverView](src/modules/partner-workspace/docs/counsel-orchestration.md) relie bilan privé, demande datée, sélection sourcée et collaboration acceptée. La [coordination Wallet](src/modules/partner-workspace/docs/coordinated-bookings.md) réserve atomiquement plusieurs propositions exactes.0057 est additive hors catalogue ; les bases partagées restent inchangées.

Le socle et ses limites sont documentés dans [platform/README.md](src/platform/README.md). La connexion WorkOS, les sessions et habilitations appartiennent à [identity](src/modules/identity/README.md), qui documente leur activation et les preuves encore manquantes.

Depuis la racine, `pnpm --filter api dev` lance Fastify et `pnpm --filter api build` produit le serveur Node ESM. Les commandes DB passent par une validation locale stricte. Le reset détruit également identités et audit, exige deux confirmations et ne fait pas partie du démarrage : [procédure propriétaire](src/platform/README.md#données-et-exploitation).

Le développement utilise le watcher natif de Node avec le chargeur TypeScript `tsx`. Ce choix conserve le redémarrage automatique et résout le blocage observé sous Turborepo/Windows avec la commande `tsx watch`, alors que son lancement direct fonctionnait. Le lancement filtré `pnpm dev --filter api`, le redémarrage après modification et le lancement global des quatre applications ont été exécutés.

La génération `pnpm --filter api db:generate` est hors connexion. Les migrations SQL versionnées sont dans `drizzle/`, et leurs conditions de restauration dans [drizzle/README.md](drizzle/README.md).
