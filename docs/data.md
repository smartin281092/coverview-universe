# Base de données et règles de données

> **Résumé** : Garanties SQL maximales, transactions ciblées, concurrence, pagination bornée, migrations expand-contract réversibles ; tenancy explicite (tenant_id + RLS en défense) ; UTC partout, argent jamais en float, soft delete par entité, PII/RGPD.

## DATA-01 — Utiliser les garanties de la base

Clés étrangères, contraintes uniques, `NOT NULL`, contraintes de vérification, transactions, index adaptés. La base DOIT empêcher autant que possible les états invalides.

## DATA-02 — Transactions ciblées

Une transaction couvre les opérations qui doivent réussir ou échouer ensemble. Interdits : appels externes dans une transaction, transactions longues, calculs lourds sous verrou, transaction couvrant un parcours entier.

## DATA-03 — Concurrence

Selon le besoin : contraintes uniques, verrous optimistes, version de ligne, opérations atomiques, `SELECT FOR UPDATE`, clés d'idempotence. NE JAMAIS supposer qu'une opération ne sera exécutée qu'une fois.

## DATA-04 — Requêtes N+1

Analyser les accès répétés (listes, boucles, workers, événements, resolvers). Jointures, agrégations ou chargements groupés lorsque nécessaire.

## DATA-05 — Index selon les usages réels

À partir des filtres fréquents, tris, jointures, contraintes d'unicité, requêtes lentes observées. Pas d'indexation systématique. Tables multi-tenant : index composites commençant par `tenant_id` (DATA-09).

## DATA-06 — Pagination

Limite par défaut, limite maximale, tri stable, curseur déterministe. NE JAMAIS charger une table sans borne (G-14).

## DATA-07 — Migrations expand-contract

Pour toute évolution sensible : 1) ajouter le nouveau schéma ; 2) supporter ancien et nouveau ; 3) migrer les données ; 4) basculer les lectures ; 5) supprimer l'ancien plus tard. Une migration DOIT rester compatible avec la version N-1 du code en production (DEL-06).

## DATA-08 — Réversibilité

Chaque migration DOIT être réversible (down), ou son irréversibilité documentée avec un plan de restauration. Un backup DOIT précéder toute migration sensible en production (DEL-07). Les migrations sont reproductibles de zéro (`db:reset` fonctionne toujours).

## DATA-09 — Modèle multi-tenant explicite

- Modèle par défaut : **schéma partagé + colonne `tenant_id`** (`organization_id`). Schéma-par-tenant ou base-par-tenant uniquement sur exigence forte (réglementaire, très gros clients, isolation contractuelle) et via ADR.
- `tenant_id` : `NOT NULL` + clé étrangère sur toute table multi-tenant ; index composites `(tenant_id, …)`.
- Les repositories DOIVENT scoper par tenant : `findProjectByIdAndOrganization(projectId, organizationId)`, jamais `findProjectById(projectId)` sur une ressource tenant.
- **RLS PostgreSQL en défense en profondeur** : DEVRAIT être activée sur les tables sensibles (`SET LOCAL app.tenant_id` par transaction) — le code applicatif reste la première barrière, RLS rattrape les oublis.
- Toute opération cross-tenant (admin, batch système) utilise une identité système explicite et est auditée (SEC-07).
- Des tests d'isolation sont obligatoires sur les parcours sensibles (TEST-01).

---

# Règles transversales de données

## DATA-10 — Dates et heures

- En base : `timestamptz`, toujours en UTC. En API : ISO 8601 avec offset. La conversion en heure locale se fait uniquement à l'affichage.
- Si le fuseau est une donnée métier (planification, rendez-vous), le stocker séparément (IANA, ex. `Europe/Paris`) en plus de l'instant UTC.
- Jamais de date manipulée comme chaîne ambiguë (`DD/MM/YYYY`) en dehors de l'affichage.

## DATA-11 — Argent et nombres

- Montants : entiers en unité mineure (centimes) ou `NUMERIC` — **JAMAIS de float**. Code devise ISO 4217 stocké à côté du montant.
- Règles d'arrondi documentées par domaine (TVA, proratas, remises) et centralisées dans un value object `Money` (PAT-06).
- Pourcentages et quantités précises : `NUMERIC` avec échelle définie.

## DATA-12 — Identifiants

Identifiants exposés : UUID v7 ou identifiants préfixés (`proj_x7k2…`, style Stripe) — DEVRAIENT être préférés. NE PAS exposer d'auto-increment séquentiels (énumération, fuite de volumétrie).

## DATA-13 — Soft delete vs hard delete

- Politique explicite **par entité**, documentée dans le README du module — sinon les décisions seront incohérentes.
- Défaut pour les entités métier nécessitant audit ou restauration : soft delete (`deleted_at timestamptz null`).
- Conséquences obligatoires du soft delete : filtrage systématique dans les requêtes (scope par défaut), contraintes d'unicité via index partiels (`WHERE deleted_at IS NULL`), exclusion des listes et des événements.
- Hard delete (ou anonymisation) obligatoire pour l'effacement RGPD (DATA-14) et pour les données réellement temporaires. La suppression DOIT se propager au stockage objet (STOR-06).

## DATA-14 — PII et RGPD

- Tenir un inventaire des champs PII par table (classification : identifiante, sensible, technique). Minimiser la collecte.
- Rétention définie par catégorie de donnée ; purge automatisée (cron, JOB-06).
- Droits à implémenter : accès/export (portabilité), rectification, effacement — l'effacement supprime ou anonymise en base **et** dans le stockage objet ; les backups expirent selon leur propre rétention documentée.
- JAMAIS de PII dans : logs (OBS-01), clés de stockage objet (STOR-03), URLs, identifiants exposés, payloads d'événements au-delà du nécessaire.
- Anonymisation (irréversible) vs pseudonymisation (réversible avec clé) : choisir explicitement selon l'usage.
- Données de production : jamais copiées telles quelles en local (ENV-04).
