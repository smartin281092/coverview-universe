# Fonctionnalités IA (LLM)

> **Résumé** : tout appel modèle passe par un adapter avec timeout, coûts bornés et comportement dégradé défini ; les sorties sont des données non fiables à valider avant tout effet ; l'injection se contient par les capacités, pas par des consignes ; pas de PII vers un fournisseur sans base légale.

## LLM-01 — Adapter unique (PAT-12)

Interface `LlmProvider` ; modèle, clé et paramètres via l'environnement (BACK-07). Aucun appel SDK dispersé dans les modules métier.

## LLM-02 — Robustesse

Timeout par appel (G-14), retries uniquement sur erreurs transitoires (JOB-04), et un **comportement dégradé défini par fonctionnalité** (message d'indisponibilité, valeur par défaut) — l'app ne casse jamais parce que le fournisseur est down.

## LLM-03 — Coûts bornés

`max_tokens` par appel ; budget par tenant et par période vérifié **avant** l'appel ; rate limiting par utilisateur ; tokens et coût loggés par appel avec correlation ID (OBS-02, OBS-03). Dépassement ⇒ refus propre et explicite, jamais silencieux.

## LLM-04 — Sorties = données non fiables

Parsées et validées (Zod — CTR-02) avant tout effet ; jamais exécutées ni interprétées. Sortie invalide après N tentatives bornées ⇒ échec propre — pas de « best effort » silencieux.

## LLM-05 — Injection : confinement, pas consignes

Tout contenu utilisateur ou externe inséré dans un prompt est une **donnée**, délimitée comme telle — jamais une instruction. La défense est le confinement de capacités : ce que la fonctionnalité *peut* faire (outils, portée, tenant), pas une consigne « ignore les instructions malveillantes ».

## LLM-06 — Données personnelles

Minimisation ; pas de PII vers un fournisseur tiers sans base légale et DPA (DATA-14) ; le choix du fournisseur respecte l'exigence de résidence exprimée au bootstrap (bloc 2) ; jamais de secret dans un prompt (G-04).

## LLM-07 — UX

Réponses longues en streaming via SSE (RT-01) ; traitements dépassant quelques secondes en job (JOB-01) avec progression. Le contenu généré est identifiable comme tel ; toute action conséquente (envoi, suppression, paiement) exige une validation humaine.

## LLM-08 — Prompts versionnés

Dans le repo, revus comme du code. Les fonctionnalités critiques ont quelques cas d'or rejoués (tests) quand le prompt ou le modèle change.

## LLM-09 — Cache

Réponses coûteuses et reproductibles mises en cache selon PERF-03 — clé = entrée normalisée + version du prompt + modèle.

## LLM-10 — Tenancy et rétention

Chaque appel porte le tenant ; historiques et conversations stockés avec `tenant_id` (DATA-09) et purgés selon la rétention définie (DATA-14).
