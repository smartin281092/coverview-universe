# Backend Node.js

> **Résumé** : Handlers légers, couches proportionnées, event loop protégée, timeouts et annulation partout, arrêt propre, validation d'environnement ; taxonomie et hygiène des erreurs (jamais avalées, cause préservée).

## BACK-01 — Handlers légers

Une route DOIT se limiter à : 1) valider l'entrée ; 2) authentifier ; 3) autoriser ; 4) appeler un cas d'utilisation ; 5) formater la réponse. La logique métier ne vit pas dans les handlers (ni HTTP, ni WebSocket — RT-19).

## BACK-02 — Couches proportionnées

Selon la complexité : route (transport) → schema (validation) → application service (orchestration) → domain (règles) → repository (persistance) → adapter (externe) → worker (asynchrone). NE PAS imposer toutes ces couches à une opération triviale.

## BACK-03 — Ne pas bloquer l'event loop

Interdits en synchrone : gros fichiers, calculs lourds, compression, chiffrement intensif, transformations massives, longues boucles. Utiliser streams, workers, batches, pagination, traitement asynchrone.

## BACK-04 — Timeouts partout (G-14)

Toute opération externe DOIT avoir un timeout : HTTP, base, stockage, paiement, IA, webhook, WebSocket, worker.

## BACK-05 — Annulation

Propager un mécanisme d'annulation (`AbortSignal`) lorsqu'une opération peut devenir inutile : requête client interrompue, job annulé, timeout dépassé, arrêt de l'application.

## BACK-06 — Arrêt propre

À l'arrêt : cesser d'accepter des requêtes, fermer les connexions, arrêter les consumers, restituer les jobs, fermer la base, arrêter les timers, vider les logs nécessaires.

## BACK-07 — Valider l'environnement au démarrage

Échouer immédiatement si une configuration obligatoire est absente, invalide, incohérente ou dangereuse pour l'environnement. Le schéma de validation sert de documentation du `.env.example` (ENV-02).

---

# Gestion des erreurs

## BACK-08 — Taxonomie explicite

Distinguer : validation, authentification, autorisation, conflit, ressource absente, dépendance externe, erreur interne, état métier invalide. Chaque catégorie a un code stable (API-02) et un statut HTTP cohérent.

## BACK-09 — Ne pas avaler les erreurs

Toute erreur est traitée, transformée, relancée, enregistrée à la bonne frontière, envoyée en retry ou en dead-letter. Les `catch` retournant silencieusement `null` sont interdits.

## BACK-10 — Pas de double logging

Journaliser une erreur uniquement à la frontière où elle est finalement retournée, abandonnée, retryée, transformée ou envoyée en dead-letter.

## BACK-11 — Conserver la cause

Toute transformation d'erreur préserve l'erreur d'origine (`cause`).

## BACK-12 — Erreurs asynchrones

Rejets non gérés et exceptions non capturées DOIVENT être loggés puis conduire à un arrêt contrôlé du processus (l'état étant potentiellement corrompu), le superviseur redémarrant l'instance. Les erreurs WebSocket suivent RT-20 ; les erreurs de jobs suivent JOB-04.
