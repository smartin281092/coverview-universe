# Tests

> **Résumé** : Tests dimensionnés par le risque (authz, tenancy, argent, concurrence) ; même moteur SQL qu'en prod ; fixtures minimales ; comportement observable, pas les détails ; intégrité de la CI non négociable.

## TEST-01 — Basés sur le risque

Prioriser : authentification, permissions, **isolation multi-tenant**, paiements, intégrité des données, calculs financiers, concurrence, transitions métier, intégrations critiques, exposition d'événements sensibles, régressions importantes.

## TEST-02 — Répartition

Tests unitaires pour fonctions métier pures ; tests de policies pour permissions ; tests d'intégration pour base, API, workers, événements ; quelques end-to-end pour les parcours majeurs ; tests utilisateurs pour les interfaces émergentes.

## TEST-03 — Temps réel

Tester : connexion authentifiée, refus d'une connexion invalide, abonnement autorisé et refusé, isolation entre tenants, diffusion selon permission, retrait d'accès après changement de rôle, reconnexion, événement dupliqué, resynchronisation via l'API.

## TEST-04 — Éviter les tests fragiles

Ne pas vérifier : détails d'implémentation, ordre exact des appels internes, structure privée, texte statique sans valeur, snapshots volumineux, mocks imbriqués complexes. Tester le comportement observable.

## TEST-05 — Fixtures minimales

Petites, explicites, ciblées, proches du test. Pas d'énormes jeux de données globaux.

## TEST-06 — Base réaliste

Tester les comportements SQL importants avec le **même moteur** que la production (via docker — ENV-01), pas SQLite en substitut.

## TEST-07 — Régression

Pour tout bug important : reproduire → test échouant → corriger → test au vert. Le test reste.

## TEST-08 — Budget de tests

Signaler quand tests, mocks et fixtures deviennent disproportionnés. Par défaut : un parcours fonctionnel, un end-to-end principal, quelques tests métier et sécurité ciblés, une vérification manuelle documentée — plutôt qu'une matrice exhaustive sur une fonctionnalité non validée par les utilisateurs.

## TEST-09 — Intégrité de la CI (G-08)

NE JAMAIS : désactiver, skipper ou affaiblir un test pour faire passer la CI sans le signaler explicitement ; modifier une assertion pour qu'elle colle au bug ; réduire la couverture d'un test de sécurité ou d'isolation. Un test flaky se répare ou se quarantaine visiblement, jamais silencieusement.

## TEST-10 — Tests générés par l'agent (origine HRN-VER-002)

Un test écrit par le même passage que l'implémentation n'est pas un oracle indépendant : le signaler dans le compte rendu et le relire comme du code. Les oracles des invariants critiques (sécurité, isolation, paiements) DEVRAIENT reposer sur des tests préexistants ou relus par l'humain avant qu'un élément soit classé « vérifié » (G-18).
