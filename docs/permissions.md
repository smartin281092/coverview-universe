# Rôles, permissions et politiques d'autorisation

> **Résumé** : Permission ≠ rôle ≠ entitlement ≠ feature flag ; policies centralisées ; vérification à chaque frontière (API, WS, worker, fichier) ; propagation immédiate des retraits de droits.

## PERM-01 — Rôle ≠ permission

Un rôle est un regroupement de permissions (`organization_admin` → `project.read`, `deployment.cancel`, `member.invite`…). La logique métier vérifie une **permission ou une politique**, jamais un nom de rôle :

```ts
// Interdit
if (user.role === "admin") { … }
// Correct
authorization.require(user, "deployment.cancel", deployment);
```

## PERM-02 — Dimensions d'autorisation

Une décision peut dépendre de : identité, organisation (tenant), permission, propriété, relation à la ressource, état de la ressource, plan d'abonnement, feature activée, règle métier. RBAC seul peut être insuffisant : combiner RBAC, ABAC, ownership et policy-based authorization selon le besoin.

## PERM-03 — Politiques centralisées

Les règles d'accès importantes vivent dans des policies (`DeploymentPolicy.canCancel`, `RealtimeEventPolicy`…). NE JAMAIS réimplémenter la même règle dans plusieurs routes, workers, handlers WebSocket ou frontends.

## PERM-04 — Vérifier à chaque frontière (G-02)

Appel API, abonnement WebSocket, commande WebSocket, worker agissant pour un utilisateur, opération sensible, accès et téléchargement de fichier (STOR-05), mutation administrative.

## PERM-05 — Changement de rôle ou de permission

Invalider les caches de permissions ; réévaluer les abonnements temps réel et retirer les rooms interdites (RT-11) ; renouveler ou révoquer la session si nécessaire (AUTH-04) ; auditer (SEC-07) ; notifier les applications concernées. Une permission retirée cesse de produire des effets rapidement.

## PERM-06 — Pas de permissions négatives

Éviter `cannot_delete_project`. Préférer une liste explicite de permissions accordées ; les interdictions exceptionnelles sont des politiques documentées.

## PERM-07 — Rôles personnalisés

S'ils existent : ils référencent des permissions stables ; certaines permissions sensibles sont non assignables ; les changements sont audités ; les rôles système ne sont pas supprimables librement ; les dépendances sont vérifiées avant suppression.

## PERM-08 — Permissions côté frontend

Le frontend PEUT utiliser les permissions reçues pour masquer une action, désactiver un bouton, adapter la navigation, éviter une requête. Cela ne remplace JAMAIS la validation backend.

## PERM-09 — Permission ≠ entitlement ≠ feature flag

- `report.generate` : permission (sécurité) ;
- `advanced_reporting` : entitlement (plan commercial) ;
- `new_report_builder` : feature flag (technique, temporaire — EVO-04).

NE JAMAIS fusionner ces trois concepts dans un booléen unique.
