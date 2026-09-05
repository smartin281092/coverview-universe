# Git, livraison et rollback

> **Résumé** : Commits conventionnels, PR petites à sujet unique, blockers de merge stricts ; migrations compatibles N-1 ; tout déploiement annulable, backups testés, roll-forward pour les données.

## DEL-01 — Branches et commits

- Branches courtes issues du tronc ; pas de branches longues divergentes.
- Commits atomiques, au format Conventional Commits : `feat(deployments): allow cancelling queued deployments`. Un commit = un sujet ; le message dit le pourquoi.
- JAMAIS de `git push --force` sur une branche partagée (G-05) ; `--force-with-lease` uniquement sur sa propre branche.
- L'initialisation du dépôt (init `main`, `.gitignore`, commit du harness, remote) relève du bootstrap (BOOT-07) ; chaque fin de slice laisse un état committé.

## DEL-02 — Pull requests

- Petites (DEVRAIT < ~400 lignes de diff significatif), un seul sujet — ne pas mélanger fonctionnalité, refactoring et renommage (G-13).
- Description : quoi, pourquoi, comment tester, risques, migrations, captures pour l'UI. Le compte rendu factuel (CLAUDE.md §6.5) sert de base.

## DEL-03 — Conditions de merge

CI verte (lint, typecheck, tests, build, vérification des frontières ARCH-14) ; revue ; aucune donnée sensible ni secret dans le diff ; migrations relues ; tests non affaiblis (TEST-09).

## DEL-04 — Pipeline CI

Étapes minimales : install → lint + typecheck → tests → build → (migrations sur base jetable) → vérifications de frontières et audit de dépendances (DEP-04). La CI est reproductible en local via les commandes de CLAUDE.md §0bis.

## DEL-05 — Décorréler déploiement et activation

Déployer souvent ; activer via feature flags (EVO-04) quand la fonctionnalité n'est pas prête pour tous. Un déploiement ne doit pas être un événement risqué.

## DEL-06 — Migrations et déploiement

Une migration DOIT être compatible avec la version N-1 du code encore en production pendant le rollout (expand-contract — DATA-07). Ordre sûr : migration additive → déploiement du code → migration de nettoyage plus tard.

## DEL-07 — Rollback

- Tout déploiement DOIT être annulable : redéployer la version N-1 doit suffire dans le cas nominal (d'où DEL-06 : le schéma N supporte le code N-1).
- Migration inverse (down) : uniquement si elle est sûre et sans perte ; sinon, préférer le **roll-forward** (corriger en avant) pour les problèmes de données.
- Backup automatique avant toute migration sensible en production (DATA-08) ; restauration **testée régulièrement** — un backup non testé n'existe pas.
- Documenter la procédure de rollback dans le runbook du déploiement.

## DEL-08 — Releases

Versionner et tenir un changelog orienté utilisateur pour les contrats publics (API, événements). Tagger les releases.
