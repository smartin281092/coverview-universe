# Queues, workers et cron jobs

> **Résumé** : Queue persistante pour tout traitement important ; jobs idempotents à identité déterministe ; retry sélectif avec backoff ; workers soumis aux règles métier (identité système auditée) ; cron sûrs en multi-instance.

## JOB-01 — Queue persistante

Obligatoire pour : emails, rapports, déploiements, synchronisations, imports, traitements longs, appels externes avec retry. JAMAIS de promesse abandonnée ni de `setTimeout` pour une opération importante.

## JOB-02 — Idempotence (G-10)

Un job relancé ne doit JAMAIS : créer un paiement en double, envoyer plusieurs notifications critiques, dupliquer une ressource, appliquer deux fois un calcul, corrompre un statut.

## JOB-03 — Identité de job

Identifiants déterministes pour l'unicité : `generate-report:{reportId}`, `sync-provider:{providerId}:{date}`, `send-invoice:{invoiceId}`.

## JOB-04 — Erreurs retryables ou non

Pas de retry : validation invalide, permission refusée, configuration manquante, état métier invalide. Retry avec backoff : timeout, erreur réseau, indisponibilité temporaire, rate limit, concurrence transitoire. Échec final → dead-letter avec dernière erreur (EVT-08).

## JOB-05 — Workers et permissions

Un worker ne contourne JAMAIS les règles métier parce qu'il s'exécute en interne. Il connaît : le tenant, l'identité ou l'acteur d'origine si nécessaire, l'autorisation déjà validée, la ressource, le contexte d'audit. Action système = identité système explicite et auditée.

## JOB-06 — Cron robustes

Chaque cron : idempotent, protégé des exécutions concurrentes, timeout, traitement par lots, journalise début/fin/durée, compte les éléments traités, peut reprendre, expose sa dernière réussite.

## JOB-07 — Multi-instance

NE JAMAIS supposer qu'un cron local ne tourne que sur une instance. Utiliser : scheduler centralisé, queue, verrou distribué, élection de leader, unicité de job (JOB-03).

## JOB-08 — Événements issus des jobs

Quand un job change un état : 1) persister ; 2) produire l'événement métier (via outbox si critique — EVT-07) ; 3) laisser le gateway temps réel construire l'événement public ; 4) diffuser aux seuls autorisés (RT-10).
