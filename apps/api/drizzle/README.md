# Migrations du socle

Génération officielle avec `drizzle-kit generate`, puis exécution via le script local `db:migrate`. Les journaux et snapshots accompagnent le SQL ; ne pas les modifier à la main.

La migration initiale est additive. Son retrait est volontairement réservé à `db:reset --confirm-local-reset`, qui vérifie l'environnement, le loopback et le nom exact de la base. Le reset supprime physiquement la table des personas fictives et le schéma `drizzle` contenant le journal des migrations, puis rejoue migration et seeds. Aucune donnée métier n'est présente. Sur une future base déployée, conserver la table additive lors d'un rollback applicatif ; toute suppression ultérieure exigera une migration dédiée et un backup vérifié (DATA-08).
