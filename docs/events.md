# Event bus et événements métier

> **Résumé** : Événements = faits versionnés ; appel direct avant event bus ; quatre types d'événements distincts ; enveloppe standard, at-least-once + consumers idempotents, outbox, DLQ, cascades documentées.

## EVT-01 — Des faits, pas des signaux vagues

Un événement représente un fait passé : `deployment.completed.v1`, `subscription.cancelled.v1` (CONV-04). Interdits : `data.updated`, `item.changed`.

## EVT-02 — Appel direct avant event bus

Appel direct lorsque l'action est obligatoire, le résultat attendu immédiatement, la dépendance synchrone, ou l'erreur doit revenir à l'utilisateur. Événement pour : effets secondaires, notifications, synchronisations, traitements asynchrones, intégrations découplées.

## EVT-03 — Quatre types d'événements

- **Domain event** : fait interne au domaine.
- **Integration event** : destiné à d'autres modules ou services.
- **WebSocket event** : contrat public envoyé à un frontend (RT-13).
- **Audit event** : trace d'une action sensible (SEC-07).

Ces contrats ne sont PAS automatiquement identiques.

## EVT-04 — Ne jamais exposer les domain events tels quels

Un domain event peut contenir détails internes, identifiants sensibles, structure instable. Le gateway temps réel le transforme en événement public adapté et autorisé (RT-10).

## EVT-05 — Enveloppe versionnée

Chaque événement important comporte : `id`, `type`, `version`, `timestamp`, `payload` validé (CTR-02), `correlationId`, `causationId` si utile, `tenantId`.

## EVT-06 — Au moins une fois

Tous les consumers DOIVENT être idempotents (G-10) : table des événements traités (`event_id` unique) ou opérations naturellement idempotentes. NE JAMAIS supposer « exactement une fois ».

## EVT-07 — Outbox pattern

Quand un changement de base doit impérativement produire un événement : 1) écrire le changement métier ; 2) écrire l'événement dans une table outbox ; 3) les deux dans la même transaction ; 4) publier ensuite (relayeur) ; 5) marquer publié.

## EVT-08 — Échecs de consommation

Retries limités avec backoff, compteur de tentatives, dead-letter queue, dernière erreur enregistrée, mécanisme de relance, observabilité (OBS-03).

## EVT-09 — Documenter les cascades

Pas de chaînes invisibles d'événements. Documenter les flux importants (README du module — DOC-02) et prévenir boucles, cascades, dépendances cachées, effets secondaires incontrôlés.
