# Migrations du socle

Génération officielle avec `drizzle-kit generate`, puis exécution via le script local `db:migrate`. Les journaux et snapshots accompagnent le SQL ; ne pas les modifier à la main.

Les migrations du socle et d’identité sont additives. Un rollback applicatif conserve leurs tables, notamment les identités et l’audit. Toute suppression de données réelles exigera une migration dédiée et un backup vérifié (DATA-08). Le reset local destructif exige désormais deux confirmations ; sa portée et sa procédure vivent dans [platform](../src/platform/README.md#données-et-exploitation), sans copie ici. Il ne révoque aucune session chez WorkOS et ne fait pas partie du démarrage normal.
0007 ajoute les demandes documentaires et l’audit d’enrichissement. L’index unique de files est créé avant la FK composite (ordre corrigé après génération, snapshots inchangés). Garder la table et les événements en rollback ; un down destructif effacerait des demandes privées. Les lecteurs du DTO profil doivent comprendre document_extracted avant activation du producteur.
