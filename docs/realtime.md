# Temps réel : WebSockets, SSE, rooms

> **Résumé** : SSE pour l'unidirectionnel simple, WebSocket sinon ; rooms construites côté serveur uniquement ; autorisation à la connexion, à l'abonnement ET à la diffusion ; révocation temps réel, reconnexion, séquence, resynchronisation par l'API.

## RT-01 — Choisir le transport

- **SSE (Server-Sent Events)** DEVRAIT être préféré lorsque le flux est unidirectionnel serveur→client à fréquence modérée : notifications, progression de jobs, invalidation de cache. Reconnexion et reprise natives (`Last-Event-ID`), simple HTTP, pas d'infrastructure dédiée.
- **WebSocket** lorsque le besoin est bidirectionnel, à haute fréquence ou à faible latence : collaboration, commandes, flux denses.
- Les règles d'authentification et d'autorisation de ce document s'appliquent aux deux transports.

## RT-02 — Pas une source de vérité (G-09)

La base et l'API restent l'autorité. Après reconnexion, le client récupère l'état actuel via l'API.

## RT-03 — Vocabulaire

**Namespace** : grande catégorie fonctionnelle. **Room** : regroupement de connexions autorisées autour d'une ressource. **Événement** : message structuré diffusé. **Subscription** : demande explicite d'un client. Ne pas employer ces termes comme synonymes.

## RT-04 — Nomenclature des rooms

Convention stable, tenant inclus dans les systèmes multi-tenant :

```
tenant:{tenantId}
user:{userId}
tenant:{tenantId}:project:{projectId}
tenant:{tenantId}:deployment:{deploymentId}
```

Un nom de room est un identifiant technique — JAMAIS une permission.

Éviter les rooms de rôle (`admins`, `premium-users`) : les rôles changent. Préférer rooms de ressource, de tenant, d'utilisateur, et l'autorisation par événement. Une room de capacité PEUT exister uniquement si elle est entièrement gérée côté serveur et réévaluée à chaque changement de permission.

## RT-05 — Authentifier la connexion

Vérifier la session et son expiration (AUTH-10), résoudre l'utilisateur, résoudre le tenant actif, identifier l'application consommatrice, charger les permissions nécessaires, refuser les connexions invalides.

## RT-06 — Autoriser chaque subscription

1) valider le payload ; 2) résoudre la ressource ; 3) vérifier le tenant ; 4) vérifier la permission ; 5) vérifier la relation à la ressource ; 6) rejoindre uniquement si autorisé ; 7) tracer les abonnements sensibles.

NE JAMAIS faire confiance à un identifiant de room fourni par le client : le client demande une ressource logique, **le serveur construit ou valide le nom technique**.

## RT-07 — Autoriser aussi la diffusion

Appartenir à une room ne donne pas droit à tous ses événements. Avant de diffuser un événement sensible : déterminer l'audience, vérifier la permission requise, filtrer les champs, supprimer les données sensibles, utiliser un événement public dédié.

## RT-08 — Politique d'exposition par type d'événement

Chaque type d'événement WebSocket a une politique documentée :

```
deployment.status.updated.v1 → permission : deployment.read
deployment.logs.appended.v1  → permission : deployment.logs.read
invoice.payment.failed.v1    → permission : billing.manage
```

L'accès peut dépendre : permission, tenant, propriété, rôle, plan, état de la ressource, confidentialité du payload.

## RT-09 — Contrats publics distincts

Événements WebSocket : stables, versionnés, validés, documentés, minimaux. JAMAIS un objet ORM diffusé tel quel (EVT-04).

## RT-10 — Le producteur ne choisit pas l'audience

Un module produit `deployment.completed.v1`. Le **gateway temps réel** : 1) résout la ressource ; 2) détermine les utilisateurs concernés ; 3) vérifie les politiques ; 4) construit l'événement public ; 5) diffuse dans les rooms autorisées. Un producteur ne peut JAMAIS envoyer des données vers une room construite depuis une entrée utilisateur.

## RT-11 — Révocation en temps réel

Permission retirée : retirer la socket des rooms interdites, interrompre les subscriptions, invalider les caches de permissions, éventuellement forcer une reconnexion, cesser d'envoyer les événements. Pour les permissions très sensibles, ne pas se fier uniquement à un cache chargé à la connexion. Voir PERM-05, AUTH-04.

## RT-12 — Changement de tenant actif

Quitter les anciennes rooms, vider les caches liés, réinitialiser les subscriptions, charger les nouvelles permissions, rejoindre uniquement les rooms du nouveau tenant.

## RT-13 — Multi-frontends

Un événement peut être commun, réservé à l'administration, au propriétaire d'une ressource, à une app donnée, ou à certains plans. La sélection repose sur des politiques serveur, jamais sur le nom déclaré du frontend (ARCH-13).

## RT-14 — Reconnexion

Le client supporte : perte de connexion, reconnexion, resubscription, session expirée, événements manqués, doublons, désordre. Après reconnexion : 1) réauthentifier ; 2) rejoindre les rooms autorisées ; 3) resynchroniser via l'API ; 4) reprendre depuis un curseur si disponible.

## RT-15 — Séquence et reprise

Flux ordonnés : inclure numéro de séquence, version de ressource, cursor, timestamp serveur. Le client détecte : manquant, ancien, doublon, ordre incohérent.

## RT-16 — Invalidation plutôt que duplication

```json
{ "type": "project.updated.v1", "projectId": "project_123", "version": 12 }
```

puis invalidation du cache (FRONT-09) est souvent plus fiable que transmettre l'objet complet.

## RT-17 — Rooms utilisateur et tenant

Room utilisateur (identité résolue serveur) : notifications personnelles, changement de permission, session révoquée, résultats de jobs personnels. Room tenant : uniquement les événements visibles par tous les membres autorisés — JAMAIS automatiquement : informations financières sensibles, événements d'administration, données personnelles, secrets.

## RT-18 — Volume et abus

Limites de connexions et de subscriptions, taille maximale des messages, rate limiting, backpressure, regroupement d'événements, métriques (OBS-03), déconnexion des clients abusifs.

## RT-19 — Commandes entrantes

Uniquement si avantage réel sur HTTP. Chaque commande : validée, authentifiée, autorisée, idempotente si nécessaire, accusée de réception, et utilise **les mêmes services métier que l'API** — jamais de logique dupliquée dans les handlers WebSocket.

## RT-20 — Erreurs temps réel

Contrat structuré, sans détails internes :

```json
{ "type": "subscription.rejected.v1", "code": "PROJECT_ACCESS_DENIED", "requestId": "req_123" }
```
