# API CoverView Core

Le socle et ses limites sont documentés dans [platform/README.md](src/platform/README.md).

Depuis la racine, `pnpm --filter api dev` lance Fastify et `pnpm --filter api build` produit le serveur Node ESM. Les commandes DB passent par une validation locale stricte ; `pnpm --filter api db:reset --confirm-local-reset` supprime la table des personas et le schéma du journal Drizzle, puis rejoue migration et seeds. Cette opération destructive volontaire est réservée à la base locale nommée par la configuration.

Le développement utilise le watcher natif de Node avec le chargeur TypeScript `tsx`. Ce choix conserve le redémarrage automatique et résout le blocage observé sous Turborepo/Windows avec la commande `tsx watch`, alors que son lancement direct fonctionnait. Le lancement filtré `pnpm dev --filter api`, le redémarrage après modification et le lancement global des quatre applications ont été exécutés.

La génération `pnpm --filter api db:generate` est hors connexion. Les migrations SQL versionnées sont dans `drizzle/`, et leurs conditions de restauration dans [drizzle/README.md](drizzle/README.md).
