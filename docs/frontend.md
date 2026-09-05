# Frontend

> **Résumé** : Organisation par feature, trois types d'état séparés, client API centralisé, cache explicite, états d'UI complets, routes partageables, accessibilité, protection des doubles soumissions.

## FRONT-01 — Un fichier par page

```
pages/
  DashboardPage.tsx
  ProjectsPage.tsx
  ProjectDetailsPage.tsx
```

Une page complexe PEUT avoir son dossier (`ProjectDetailsPage/` avec ses sous-composants et `useProjectDetails.ts`).

## FRONT-02 — Un fichier par composant significatif

Fichier séparé si le composant est réutilisé, représente un concept identifiable, possède sa propre logique, utilise des hooks, reçoit plusieurs props, mérite des tests, ou alourdit son parent. Un petit composant trivial reste dans le fichier parent. Pas un fichier par fragment HTML.

## FRONT-03 — Colocaliser

`ProjectCard/ProjectCard.tsx` + `.test.tsx` + `.module.css`. NE PAS créer automatiquement `.types.ts`, `.constants.ts`, `.utils.ts` pour du contenu trivial.

## FRONT-04 — Organiser par fonctionnalité

```
features/projects/
  README.md
  api/  components/  hooks/  pages/  schemas/  state/
```

Un élément ne passe dans `shared` que lorsqu'il a plusieurs consommateurs réels.

## FRONT-05 — Discipline du dossier shared

Chaque élément partagé DOIT avoir un objectif clair, une API stable, plusieurs consommateurs, une responsabilité limitée. `shared` n'est pas une zone sans propriétaire.

## FRONT-06 — Trois types d'état

- **Server state** (utilisateurs, projets, factures…) : via une bibliothèque de requêtes et de cache.
- **Client state global** (navigation temporaire, préférences, panneaux) : store dédié.
- **État local** (champ, modal, sélection) : dans le composant.

NE PAS tout mettre dans un store global.

## FRONT-07 — Le backend reste l'autorité (G-11)

Le frontend n'est jamais l'autorité pour : permissions, rôles, montants, prix, transitions, règles métier, statuts définitifs.

## FRONT-08 — Client API centralisé

Un client cohérent gère : URL de base, authentification, sérialisation, validation des réponses critiques, erreurs, timeouts, annulation, correlation IDs, renouvellement de session. Pas d'appels réseau dispersés aux comportements différents. Voir ARCH-13 pour clients partagés vs spécialisés.

## FRONT-09 — Stratégie de cache explicite

Pour chaque ressource, définir : quand elle est chargée, quand elle est fraîche, quand elle est invalidée, comment une mutation la modifie, comment un événement temps réel l'affecte (RT-16 : invalidation plutôt que duplication).

## FRONT-10 — États d'interface

Chaque écran connecté gère : chargement, succès, vide, erreur, permission refusée, ressource introuvable, session expirée, action en cours, action échouée.

## FRONT-11 — Routes partageables

Les URLs importantes représentent l'état affiché : `/projects/:projectId/deployments/:deploymentId`, jamais un écran dépendant uniquement d'un état global non rechargeable.

## FRONT-12 — Accessibilité dès le développement

HTML sémantique, labels, navigation clavier, focus visible, messages d'erreur accessibles, boutons correctement désactivés, contrastes suffisants, alternatives textuelles.

## FRONT-13 — Doubles soumissions

Action en cours : afficher l'état, désactiver si pertinent, s'appuyer sur l'idempotence backend (API-04), retries prudents.
