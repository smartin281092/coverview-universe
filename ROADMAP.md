# CoverView — cadre de roadmap

État : **préparation terminée, découpage détaillé à écrire ensuite** selon la demande utilisateur (BOOT-10). Aucun développement n'est lancé. Le périmètre demandé est la bible complète ; l'ordre indicatif de sa §91 est une entrée de planification, pas une autorisation d'exécuter.

## Entrées de planification

- [Index maître et extraction](docs/product/README.md), [carte fonctionnelle](docs/product/capabilities.md) et [questions ouvertes](docs/product/open-questions.md).
- [Backlog](roadmap/backlog.yaml) : trois réservations de socle en `idea`, aucune slice `ready` ou `running`.
- [Registre de couverture](roadmap/coverage.json) : liens entre unités source, exigences atomiques et futures slices ; affectations volontairement non faites à ce stade.
- [Méthode de préparation](roadmap/README.md), [plan de slice](templates/slice.plan.md), [prompt de slice](templates/slice.prompt.md), [reprise de session](docs/codex.md).

## M0 — Socle et premier parcours vérifiable

Réservations du harness : S-000a socle local outillé avec fixtures ; S-000b compte et parcours protégé WorkOS ; S-000c déploiement dédié Infomaniak. Plans, critères et séquencement des intégrations à définir lors de la roadmap, en commençant avec les données fictives demandées. La préparation de l'environnement distant ne touche pas l'existant (HOST-01).

Critère final du socle complet : un utilisateur se connecte et accède à son espace protégé sur une URL déployée, sans données ni identité de démonstration présentées comme réelles.

## Axes à transformer en slices verticales

Cette liste sert de contrôle de couverture, sans ordre de lancement imposé :

| Axe | Résultats à découper depuis les sources |
|---|---|
| Acquisition et 3P | Valeur anonyme, analyse, reveal, sauvegarde Wallet, comparaison et conversion |
| Catalogue et moteurs communs | Publication gouvernée, règles et données sourcées, versions, snapshots et benchmarks |
| Documents et démarches | Upload, extraction, validation, mandat/signature, récupération de contrats et LPP |
| Wallet et Retire | Contrats, couverture, simulations, plan du foyer, rente/capital, décaissement, stress et suivi |
| Opérations et copilotes | CRM, client 360, dossiers/tâches, emails/calendrier, actions IA contrôlées et audit |
| Fidélité et relation | Carte digitale, Miles, récompenses, partage, gamification et revues annuelles |
| Professionnels et partenaires | Apporteurs, suivi/commissions, avantages, Intelligence et accès limités |
| Exchange | Domaine distinct conservé dans la cible demandée ; spécification et activation conditionnées aux décisions ouvertes |
| Acceptation v1 | Intégrations réelles, droits/refus, conformité, accessibilité, exploitation et mesures de la bible |

## Prochaine étape

Transformer chaque capacité et workflow en exigences atomiques puis en parcours livrables ; préciser dépendances et questions au moment utile, affecter toute la source, et écrire les objectifs et prompts de chaque slice avec PROG-12 / PROG-21. Une réalisation sur fixtures a une preuve de démonstration ; l'intégration réelle reste explicitement planifiée avant de déclarer la v1 terminée.

Revue initiale : 2026-09-05. Aucun élément de la bible écarté ni développement autorisé par ce fichier seul.
