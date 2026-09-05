# Roadmap CoverView — bible complète vers slices Astra Ultra

> Vue générée depuis les spécifications et `roadmap/state.json`. Modifier les sources canoniques puis régénérer. La planification ne prouve aucune implémentation.

Le programme contient **120 slices** et **682 critères d’acceptation**. Traçabilité : **2115/2115 unités source** affectées, dont 1742 liées aux critères et 373 qualifiées comme contexte ; **0 non affectées**. Ce sont des preuves de planification, aucune fonctionnalité n’est déclarée implémentée par ce décompte.

État enregistré : 2 done, 1 ready, 1 review, 116 specified. Les intégrations réelles et décisions métier ont des slices explicites ; aucun mock critique ne satisfait l’acceptation complète.

- [Index topologique et jalons](roadmap/index.md)
- [Prompts détaillés](roadmap/prompts/README.md)
- [Parcours A–M et étapes tracées](roadmap/workflows.md)
- [Décisions avec options et périmètre](roadmap/decisions.md)
- [Backlog](roadmap/backlog.yaml) · [Couverture](roadmap/coverage.json) · [État canonique](roadmap/state.json)

Départ prévu : [S-000a](roadmap/plans/S-000a.plan.md). L’ordre suit les dépendances, pas les seuls numéros. Exécution séquentielle et choix des meilleurs défauts autorisés : [mandat et relais entre tâches](roadmap/execution-policy.md). Les décisions sont consignées à l’entrée de chaque slice ; aucun GO répété.

La recherche LPP apparaît tôt : [S-021 demande/signature](roadmap/plans/S-021.plan.md), [S-022 suivi/résultats](roadmap/plans/S-022.plan.md), puis [S-036 transmission réelle](roadmap/plans/S-036.plan.md) et [S-041 réponses réelles](roadmap/plans/S-041.plan.md). Pièces, institutions, avoirs et prochaines démarches font partie du parcours ; un formulaire seul ne suffit pas.

Chaque slice vise GPT-6 Astra (`gpt-6-astra`) effort `ultra`, une session principale et un point de redécoupage. Ce budget ne promet ni coût ni calendrier. Le contexte propre suit [CDX-03](docs/codex.md), sans inventer de mesure exacte de 70 %.

La v1 n’est complète qu’après la recette [S-139](roadmap/plans/S-139.plan.md), les intégrations réelles, les décisions et clôtures requises, puis l’ouverture [S-140](roadmap/plans/S-140.plan.md) sur de nouvelles ressources dédiées. Une couverture documentaire complète ne remplace aucune de ces preuves.

## Jalons

- **M0 — Socle** : 3 slices ; dépendances et livrables dans l’index.
- **M1 — Acquisition** : 4 slices ; dépendances et livrables dans l’index.
- **M2 — Documents et LPP** : 10 slices ; dépendances et livrables dans l’index.
- **M3 — Analyse** : 11 slices ; dépendances et livrables dans l’index.
- **M4 — Retire** : 19 slices ; dépendances et livrables dans l’index.
- **M5 — Opérations** : 13 slices ; dépendances et livrables dans l’index.
- **M6 — Assistance et fidélité** : 10 slices ; dépendances et livrables dans l’index.
- **M7 — Professionnels et Exchange** : 7 slices ; dépendances et livrables dans l’index.
- **M8 — Intégrations réelles** : 32 slices ; dépendances et livrables dans l’index.
- **M9 — Préparation au lancement** : 11 slices ; dépendances et livrables dans l’index.

## Maintenance

Modifier `roadmap/specs/*.json`, les liens/qualifications source et `roadmap/state.json`, puis exécuter `node scripts/build-roadmap.mjs`. Ne pas éditer les vues générées. `node scripts/verify-planning.mjs --require-complete` contrôle cohérence, fraîcheur et couverture documentaire ; aucune application ou intégration n’est lancée.

Les choix de [PROJECT](PROJECT.md) restent canoniques : WorkOS coverview, preset/charte, contenus bornés, fixtures et Infomaniak protégé. Le générateur de documents ne réalise aucune action applicative ou externe.

Après clôture réellement prouvée, appliquer PROG-23 et roadmap/execution-policy.md : commiter, préparer le checkpoint, transmettre le SHA testé et créer immédiatement la tâche suivante gpt-6-astra / ultra avec contexte propre. Attendre son premier état puis cesser les écritures ; aucune simple promesse de relais ne remplace la création effective.
