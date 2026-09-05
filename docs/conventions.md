# Conventions de nommage

> **Résumé** : Nommage de tout : casing, fichiers, routes, événements, jobs, permissions, statuts, rooms — et stabilité absolue des noms publics.

## CONV-01 — Casing

| Élément | Convention |
|---|---|
| Classes, composants React | `PascalCase` |
| Fonctions, variables | `camelCase` |
| Constantes globales | `UPPER_SNAKE_CASE` |
| Dossiers de fonctionnalités | `kebab-case` (ou convention unique du projet) |
| Fichiers React | `PascalCase.tsx` |
| Fichiers backend | `feature.layer.ts` (ex. `deployment.service.ts`) |
| Tables et colonnes SQL | `snake_case` |
| Variables d'environnement | `UPPER_SNAKE_CASE` |
| Hooks React | `useSomething` |
| Booléens | préfixes `is`, `has`, `can`, `should` |

Ces règles DOIVENT être imposées par lint quand c'est possible (ARCH-14).

## CONV-02 — Noms métier explicites

Préférer `calculateSubscriptionProration()`, `markDeploymentAsFailed()`, `findActiveSubscription()`, `canUserCancelDeployment()` à `processData()`, `handleItem()`, `updateStatus()`, `checkAccess()`.

## CONV-03 — Routes API

Ressources cohérentes, généralement au pluriel :

```
/projects
/projects/:projectId
/projects/:projectId/deployments
```

Endpoints vagues interdits (`/do-action`, `/process`). Les actions métier hors CRUD sont explicites : `/deployments/:id/cancel`, `/invoices/:id/mark-paid`. Voir `api.md`.

## CONV-04 — Événements métier

Des faits passés, nomenclature stable et versionnée :

```
deployment.created.v1
deployment.completed.v1
subscription.cancelled.v1
lead.submitted.v1
```

Interdits : `data.updated`, `item.changed`, `process.executed`.

## CONV-05 — Commandes et jobs

Commandes = intentions : `deployment.start.v1`, `report.generate.v1`. Jobs explicites : `deployment.execute.v1`, `invoice.send.v1`, `provider.sync.v1`.

## CONV-06 — Permissions

Clés stables `resource.action` : `project.read`, `deployment.cancel`, `invoice.manage`, `user.role.assign`. Interdites : les permissions liées à une page ou un bouton (`adminPageAccess`, `showSpecialButton`). Voir `permissions.md`.

## CONV-07 — Statuts

Explicites, limités, documentés, identiques entre code, base et API. Interdits : `done`, `ok`, `processed`, `active2`.

## CONV-08 — Rooms temps réel

`tenant:{tenantId}:project:{projectId}` — voir `realtime.md` (RT-04).

## CONV-09 — Stabilité des noms publics

Un nom de contrat public, d'événement, de permission ou de room NE DOIT PAS être renommé sans bénéfice réel ni plan de migration (G-12) : impacts sur frontends, workers, consommateurs, logs, dashboards, audits, intégrations. Voir `evolution.md`.
