# Observabilité

> **Résumé** : Logs structurés sans PII ni secrets, corrélation de bout en bout, métriques utiles (API, jobs, temps réel), health checks distincts, alertes uniquement actionnables.

## OBS-01 — Logs structurés

Selon le contexte : request ID, correlation ID, user ID, tenant ID, application consommatrice, job ID, event ID, socket ID, room logique, opération, durée, résultat.

NE JAMAIS logger : secrets, tokens, mots de passe, documents complets, PII sensible (DATA-14).

## OBS-02 — Corrélation

Propager un correlation ID entre API, services, événements, workers, intégrations, WebSockets (présent dans l'enveloppe d'événement — EVT-05).

## OBS-03 — Métriques

Mesurer notamment : latence API, taux d'erreur, requêtes lentes, jobs en attente/échoués et leur durée, connexions et reconnexions WebSocket, abonnements rejetés, nombre de rooms, événements diffusés et filtrés par autorisation, erreurs de consumers, profondeur des DLQ.

## OBS-04 — Health checks

Distinguer : liveness (processus vivant), readiness (prêt à servir — dépendances OK), diagnostics (état détaillé, protégé).

## OBS-05 — Alertes actionnables

Une alerte n'existe que si une action est possible. Pas de bruit d'alertes ignorées.
