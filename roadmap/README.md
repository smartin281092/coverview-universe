# Préparer la roadmap et les prompts

Le cadrage est initialisé. La prochaine séance doit produire le découpage détaillé demandé, à partir de docs/product/README.md et de PROG-21. Les dossiers `plans/`, `prompts/` et `handoffs/` séparent plan autorisé, instruction exécutable et état de reprise ; ils ne constituent pas trois sources métier.

## Travail de planification à réaliser

1. Lire la carte des capacités et les questions ouvertes, puis filtrer l'inventaire par domaine. Chaque unité garde son ID lié au hash de la bible.
2. Transformer les unités applicables en critères atomiques. Classer les titres, glossaire et exemples comme contexte avec justification ; ne pas les transformer artificiellement en fonctionnalités.
3. Grouper par parcours utilisateur complet : une entrée, un résultat, des droits/refus, des données et un oracle. Garder les frontières techniques utiles à l'intérieur du parcours ; le socle est l'exception BOOT-04.
4. Fixer l'ordre des dépendances, les fixtures/personas et les moments d'intégration réelle. Conserver toutes les capacités demandées, y compris celles qualifiées de futures dans la source ; expliciter leurs arbitrages.
5. Remplir ROADMAP/backlog et les affectations de coverage.json. Écrire un plan et un prompt autonome par slice depuis les templates, avec PROG-12 et un paquet de lecture ciblé.
6. Valider les liens et l'absence d'unités oubliées, puis soumettre les plans pour le travail d'implémentation. Rien dans le cadre actuel n'autorise la première slice.

## Registre de couverture

`coverage.json` pointe vers l'inventaire, sans recopier le texte de la bible. Chaque affectation possède `source_ids` (unités), `criterion` (critère atomique), `slices` (IDs) et `disposition` (`implementation` ou `context`). Une entrée de contexte précise sa justification dans `criterion` et ne sert pas à exclure une capacité ; elle n'a pas de slice. Une exigence peut contribuer à plusieurs parcours et plusieurs critères peuvent citer la même unité.

Vérification : `node scripts/verify-planning.mjs`. Pendant la préparation, les unités non affectées sont annoncées comme reste à planifier. Après écriture de la roadmap : `node scripts/verify-planning.mjs --require-complete` doit passer. Cette couverture syntaxique ne remplace pas la revue métier des critères.

## Reprise

État courant et prochaine action dans `handoffs/initialisation.md`, validés selon CDX-03. Ne pas rouvrir tout le DOCX à chaque slice ; revenir aux ancrages requis et aux décisions enregistrées.
