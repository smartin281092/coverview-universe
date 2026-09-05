# Livraison de la roadmap complète

Compte rendu historique de rédaction. L'autorisation ultérieure de lancement et d'enchaînement est dans [le mandat d'exécution](execution-policy.md).

Date : 2026-09-05. Périmètre autorisé : rédaction de la roadmap et des objectifs/prompts Astra Ultra selon [le plan de travail](plans/ROADMAP-authoring.plan.md). Application, intégrations et infrastructure restent à réaliser.

## Résultat

L'[index](index.md) donne 120 slices et 120 paires plan/prompt, avec 682 critères d'acceptation. Les dix jalons couvrent socle, acquisition, catalogue/documents/LPP, analyse, Retire, opérations, assistance/fidélité, portails professionnels/Exchange, intégrations et lancement. Leur ordre respecte le graphe ; les 120 slices contribuent toutes au chemin de complétude vers S-140. Aucune slice n'est ready, running ou done.

La recherche d'avoirs LPP comprend demande/signature S-021, suivi/résultats S-022, transmission réelle S-036 et réponses d'organismes S-041. LPP utilise les dossiers et activités communs ; aucun faux formulaire « envoyé » ne remplace le workflow.

La revue a ajouté les assistants Partners/Intelligence et tâches d'analyse S-122, puis séparé les calibrations multi-familles en S-043/S-044/S-045 et S-074/S-075/S-076. S-038 et S-068 composent leurs preuves et versions. Les parcours de données privées rejoignent le manifeste export/rétention, vérifié à la recette complète.

## Preuves et portée

| Objet vérifié | Preuve |
|---|---|
| Source intacte | `scripts/extract-bible.py --check` : hash DOCX et structure complète conformes |
| Traçabilité documentaire | `scripts/verify-planning.mjs --require-complete` : 2 115/2 115 unités affectées ; 1 742 aux critères, 373 au contexte explicite |
| Graphe et état | IDs, références, activations et dépendances valides, aucun cycle ; 120 specified ; aucune tranche hors du chemin final S-140 |
| Vues cohérentes | Génération déterministe puis `scripts/build-roadmap.mjs --check --require-complete` ; 247 vues générées |
| Guards de planification | 21 tests de `scripts/roadmap.test.mjs` : cycles, références, plages, questions exactes, réponses/preuves, WIP et couverture |
| Génération et reprise | 4 tests de `scripts/build-roadmap.test.mjs` : CLI, fraîcheur, source altérée, orphelin, état/journal préservé et CRLF |
| Runner et checkpoint existants | 10 tests Node passent ; aucune campagne fournisseur exécutée |
| Charte conservée | 46 tokens, 18 contrastes et 6 sources vérifiés ; aucun asset modifié |
| Référentiel et liens | Linter : 0 erreur, 0 avertissement ; 257 documents et 13 202 liens locaux/ancrages contrôlés sans erreur |
| Reprise et diff | Checkpoint roadmap valide ; `git diff --check` sans erreur de contenu |

Les chiffres concernent la **planification**, pas des fonctionnalités réalisées. Une unité de source peut contenir plusieurs exigences ; titres, glossaire et métadonnées ne sont pas des features. La revue sémantique a rapproché les résumés, matrices d'accès, services, événements et workflows des critères propriétaires, sans mettre les restes dans une catégorie fonctionnelle « autres ».

Dernière campagne combinée : `node --test scripts/roadmap.test.mjs scripts/build-roadmap.test.mjs evals/run.test.mjs scripts/context-handoff.test.mjs` — **35 tests passent**. Aucun test produit ne peut encore être exécuté sans application.

## Décisions, budget et limites

Les [décisions](decisions.md) regroupent les questions des plans par référence ; beaucoup réutilisent une même décision de méthode ou de droits. Elles sont à résoudre avant le comportement concerné, pas toutes avant le socle. Les choix utilisateur acquis restent dans PROJECT. Les réponses proposées ne sont pas approuvées ; aucune méthode financière, durée légale, permission ou condition commerciale inconnue n'a reçu une validation fictive.

Chaque slice cible une session Astra Ultra avec un résultat, un oracle et une frontière de redécoupage. Ce n'est ni une estimation contractuelle du nombre final de sessions, ni un quota appliqué par machine. Les prompts référencent les critères et sources du plan pour limiter les relectures. La mesure automatique de 70 % demeure indisponible selon CDX-03 ; le checkpoint assure une reprise ciblée sans annoncer une bascule mesurée.

Session réelle de rédaction : Codex, modèle communiqué par l'environnement « GPT-6 » ; effort effectif et coût non observables. La paire requise pour les slices est consignée, pas présentée comme une télémétrie de cette rédaction.

Fait non vérifié : validité indépendante contre le PDF RET-1 absent, exactitude des futurs modèles/calibrations et des décisions encore ouvertes. Ces limites ont leurs questions/campagnes. Aucun scaffold applicatif, accès tiers, paiement, envoi, push, déploiement, modification d'instance ou DNS n'a été réalisé pendant la rédaction.

## Suite

Le prochain résultat est [S-000a](plans/S-000a.plan.md), avec son [prompt](prompts/S-000a.prompt.md). Le [checkpoint](handoffs/roadmap.md) conserve les autorisations et la prochaine action sans exécuter cette slice. Source de rédaction et journal persistants : [mode d'emploi](README.md).
