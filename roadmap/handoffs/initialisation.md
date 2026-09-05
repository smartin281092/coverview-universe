# Reprise de travail — initialisation

État historique, remplacé pour la reprise courante par [le checkpoint roadmap](roadmap.md). Les faits ci-dessous décrivent la fin de l'initialisation.

Créé : 2026-09-05
Contexte observé : non disponible ; checkpoint préventif, aucun seuil de 70 % mesuré.

## Mission et autorisation

L'utilisateur demande d'adapter le harness Claude à Codex, d'intégrer ses choix, de décortiquer la bible v1 et d'initialiser la structure avant de travailler ensuite la roadmap et les prompts détaillés. Cette préparation est réalisée ; aucune slice applicative n'est autorisée. Il a fourni le dépôt GitHub indiqué dans PROJECT. Il autorise à l'avance une nouvelle session propre à 70 % pour continuer la même mission selon CDX-03.

## État du dépôt

Dépôt D:/Projects/coverview-astra, branche main, remote origin configuré. Commit initial c0915f4 conserve le harness et les sources reçues. Les commits d'initialisation suivants sont à lire avec git log ; vérifier git status avant toute écriture. Aucun push effectué, aucune référence distante observée au raccordement. Aucun scaffold applicatif.

## Sources à lire

AGENTS puis CLAUDE, PROJECT et entrées actives de MEMORY. Pour la suite : ROADMAP, roadmap/README.md, docs/program.md, docs/codex.md et docs/product/README.md ; puis capabilities.md/open-questions.md et les seuls domaines de requirements.json nécessaires. Bible maître conservée, extraction avec ancrages et SHA. Templates slice.plan.md et slice.prompt.md prêts.

## Décisions acquises

Choix utilisateur et ADR liés dans PROJECT : WorkOS/coverview, shadcn/palette/assets, comportement UI compact et FAQ, données fictives au départ, Infomaniak existant protégé, coverview.ch. Paire requise PROG-12. Ne pas réinventer les droits du foyer ni les paramètres financiers ouverts. Bible entière conservée, y compris capacités désignées futures.

## Livraison et preuves

Extraction contrôlée : 2945 paragraphes non vides, 108 tableaux, 2115 unités sources ; 33 capacités et 13 workflows analysés. Charte : 46 tokens, 18 contrastes, sources intactes. Scripts de checkpoint et runner testés. Résultats consolidés et limitations dans roadmap/initialisation.md ; relire ce ledger pour les commandes exactes. Aucune intégration ni fonctionnalité produit prouvée. Campagne modèle réelle non exécutée : CLI locale incompatible Ultra.

## Prochaine action bornée

Quand l'utilisateur demande la roadmap : transformer la carte des capacités en exigences atomiques et en slices verticales ordonnées, puis écrire les objectifs et prompts détaillés Astra Ultra avec paquet de lecture ciblé, dépendances, oracles, fixtures et intégrations restantes. Compléter coverage.json sans qualifier toutes les unités de fonctionnalités. Le cadrage actuel ne vaut pas accord d'implémenter S-000a.

## Obstacles et tentatives

Aucun blocage à l'initialisation. Les questions métier de docs/product/open-questions.md bloquent seulement les slices concernées. Les outils n'exposent pas de pourcentage de contexte actif ; ne pas prétendre une bascule exacte. Ne pas essayer de forcer ultra dans la CLI locale ni de copier ses hooks Claude en les prétendant actifs. Le PDF RET-1 cité par la bible n'a pas été fourni séparément.

## Coordination

Lectures et modifications des sous-agents intégrées ; aucune slice running, aucun service applicatif lancé. Avant un relais, vérifier qu'aucun autre agent ne possède encore de fichiers et que les commits sont présents dans le nouveau checkout. Ne pas créer une nouvelle tâche uniquement pour annoncer que le cadrage est terminé.
