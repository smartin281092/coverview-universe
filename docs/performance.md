# Performance

> **Résumé** : Mesurer avant d'optimiser ; borner toutes les opérations ; cache uniquement avec clé/durée/invalidation définies ; temps réel multi-instance via adapter.

## PERF-01 — Mesurer avant d'optimiser

Ne pas introduire cache distribué, dénormalisation, workers supplémentaires, Redis, batching complexe ou architecture distribuée sans problème observé ou exigence démontrable (métriques — OBS-03).

## PERF-02 — Borner toutes les opérations (G-14)

Listes, requêtes, uploads, payloads, retries, jobs, historique, connexions, subscriptions WebSocket, temps d'exécution.

## PERF-03 — Cache explicite

Avant tout cache, définir : clé, durée, invalidation, cohérence, comportement en cas de panne, données autorisées (jamais de décision de permission mise en cache sans stratégie d'invalidation — PERM-05), métriques.

## PERF-04 — Temps réel à l'échelle

Plusieurs instances : adapter/broker adapté, jamais de dépendance à la mémoire d'une seule instance, distribution des rooms, gestion des reconnexions, surveillance du volume, pas de broadcasts globaux inutiles (RT-18).
