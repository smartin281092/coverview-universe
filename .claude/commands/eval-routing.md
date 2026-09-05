---
description: Exécute l'éval de routage du référentiel (EVAL-01) — après toute modification de CLAUDE.md §5 ou d'un satellite
---
Lis docs/evals.md. Exécute `node evals/run.mjs` et présente le résultat.

En cas d'échec, ne corrige rien tout de suite : pour chaque cas rouge, diagnostique d'abord la cause dans la **table de routage §5 ou l'entrée du satellite concerné** — libellé trop vague, exclusion manquante, chevauchement entre deux entrées. Propose la correction du référentiel, pas celle du cas de test : ajuster l'attente pour faire passer l'éval est l'équivalent de désactiver un test (G-08, TEST-09).

Si le cas de test est réellement faux (attente irréaliste, satellite légitimement neutre), dis-le explicitement et justifie — c'est un motif valable, mais il doit être nommé.

Termine par : nombre de cas passés, corrections proposées, et s'il y a lieu, les canaris de evals/canaries.md à repasser (EVAL-04) — sans les exécuter toi-même, ils sont à oracle humain.
