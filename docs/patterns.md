# POO pragmatique et design patterns

> **Résumé** : Fonction pour les transformations pures, objet pour identité/état/invariants ; entités, value objects, services, DI, repository, adapter ; singletons restreints, machines à états, policies.

## PAT-01 — Fonction ou objet

Utiliser une **fonction** pour une transformation simple sans état : calculs purs, mapping, sérialisation, validation, composants React, hooks. Utiliser un **objet** lorsqu'il existe une identité, un état contrôlé, des invariants, un cycle de vie ou plusieurs implémentations : entités, value objects, machines à états, intégrations, stratégies, services avec dépendances.

## PAT-02 — Encapsuler les transitions

Préférer `deployment.markAsSucceeded(result)` à `deployment.status = "succeeded"`. Les transitions importantes DOIVENT être contrôlées.

## PAT-03 — Protéger les invariants

Un objet métier NE DOIT PAS pouvoir exister dans un état invalide. Selon le besoin : constructeur, factory, méthode de création, méthode métier, schéma de validation, contrainte de base.

## PAT-04 — Composition avant héritage

```ts
class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly authorization: AuthorizationService,
    private readonly eventPublisher: EventPublisher,
  ) {}
}
```

Éviter les chaînes d'héritage complexes.

## PAT-05 — Pas de God Objects

`ApplicationManager`, `SystemService`, `GlobalProcessor` sont interdits. Une classe est suspecte si elle a trop de dépendances, connaît plusieurs domaines, accumule des méthodes sans cohésion, ou change pour des raisons très différentes.

## PAT-06 — Entités et value objects

Entité = identité (`User`, `Organization`, `Project`, `Invoice`, `Deployment`). Value object = valeur (`Money`, `EmailAddress`, `Percentage`, `DateRange`, `ProjectSlug`) — idéalement immuable et validé à la création. `Money` est obligatoire pour les montants (DATA-11).

## PAT-07 — Domain services et application services

Domain service : règle n'appartenant naturellement à aucune entité, impliquant plusieurs objets, indépendante de la technique. Application service : orchestre un cas d'utilisation — charger, vérifier les permissions, appeler le domaine, persister, produire les effets secondaires.

## PAT-08 — Pas de modèles anémiques

Les objets métier importants protègent leurs règles. Les DTO et modèles de lecture peuvent rester simples.

## PAT-09 — SOLID avec pragmatisme

SOLID sert les responsabilités, contrats, dépendances, composition — jamais à justifier une interface par classe, des couches supplémentaires, une abstraction sans variation réelle ou une fragmentation.

## PAT-10 — Dependency injection

Injecter explicitement les dépendances importantes. Éviter les conteneurs globaux opaques quand une injection simple suffit.

## PAT-11 — Repository

Exprimer des opérations métier : `findActiveSubscriptionForOrganization()` plutôt que `findOne(filters)`. NE PAS recréer un ORM générique au-dessus de l'ORM. Les méthodes multi-tenant intègrent le tenant (DATA-09).

## PAT-12 — Adapter

Encapsuler chaque fournisseur externe (paiement, email, stockage, Git, identité, IA). Le domaine ne dépend JAMAIS des structures ou erreurs d'un SDK externe.

## PAT-13 — Strategy et Factory

Strategy : uniquement si plusieurs comportements interchangeables existent réellement (fournisseurs, règles de calcul, retries, méthodes d'auth). Factory : uniquement si la création est réellement complexe ou variable — pas pour masquer un `new`.

## PAT-14 — Singleton

Réservé aux ressources techniques uniques par processus : configuration, logger, pool de base, client de queue, métriques, client de stockage. NE JAMAIS y stocker : utilisateur courant, organisation courante, permissions, session, état métier, room active, données liées à une requête. Un singleton Node.js n'est unique que dans son processus.

## PAT-15 — Machine à états

Transitions explicites pour les processus complexes :

```
draft → queued → running → succeeded
                        ↘ failed → retrying → running
```

Une colonne `status` NE DOIT PAS être modifiée librement depuis plusieurs endroits.

## PAT-16 — Policy

Centraliser les décisions d'accès complexes (`DeploymentPolicy`, `RealtimeEventPolicy`) — lisibles et testables. Voir `permissions.md` (PERM-03).
