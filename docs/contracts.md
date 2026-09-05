# Typage, validation et contrats

> **Résumé** : TypeScript strict + validation runtime à toutes les frontières ; DTO explicites (jamais l'ORM exposé) ; package contracts partagé borné ; clients générés depuis les schémas.

## CTR-01 — TypeScript strict

Pour une application complexe, TypeScript en mode strict DOIT être utilisé. Si JavaScript est conservé : JSDoc, validation runtime, lint strict, analyse statique.

## CTR-02 — Valider toutes les frontières

Requêtes API, paramètres, messages WebSocket, webhooks, événements, jobs, variables d'environnement, fichiers, réponses externes critiques. Les types statiques ne remplacent JAMAIS la validation runtime : un schéma exécutable (ex. Zod) à chaque frontière, les types en dérivent.

## CTR-03 — DTO explicites

NE JAMAIS exposer directement les modèles ORM. Créer des DTO et contrats explicites. NE JAMAIS exposer accidentellement : secrets, champs internes, permissions techniques, métadonnées sensibles, colonnes d'administration.

## CTR-04 — Package de contrats partagé

`packages/contracts` PEUT contenir : schémas runtime, types dérivés, codes d'erreur, contrats WebSocket publics, clés de permissions, pagination. Il NE DOIT PAS contenir : logique métier backend, accès base, secrets, dépendances UI, modèles ORM.

## CTR-05 — Génération de clients

Générer ou dériver les clients depuis des contrats exécutables (schémas, OpenAPI dérivé). NE PAS maintenir manuellement plusieurs définitions divergentes de la même API.
