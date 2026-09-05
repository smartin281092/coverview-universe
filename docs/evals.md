# Évaluation du référentiel

> **Résumé** : le référentiel est du code, donc il se teste. Une seule suite machine — l'éval de routage, un appel modèle, moins d'une minute — déclenchée uniquement par les PR qui touchent le référentiel. Cinq canaris à oracle humain au changement de modèle. Tout échec constaté en revue devient un cas : le corpus se construit par la production, pas par l'imagination.

**Ce qui est testé ici n'est pas le produit.** Les tests du projet (`testing.md`) vérifient le code écrit par l'agent. Les évals vérifient le référentiel qui gouverne l'agent. Deux objets, deux suites, jamais mélangés.

## Exécution locale Codex et Claude

`node evals/run.mjs --dry` produit seulement le prompt ; `--fixture <fichier-json>` vérifie un résultat fourni sans appel modèle ni écriture d'historique de campagne. Ces modes testent l'outillage, pas le comportement d'un modèle. Tests portables : `node --test evals/run.test.mjs scripts/context-handoff.test.mjs`.

Sans option, fournisseur `codex`, modèle `gpt-6-astra`, effort `ultra`. La CLI observée pendant cette initialisation refuse Ultra (CDX-02) : le runner signale cette incompatibilité, sans substitution. La campagne réelle avec cette paire reste donc non exécutée. Le catalogue de création de tâches desktop expose la paire ; il n'est pas automatiquement le backend de ce runner.

`EVAL_PROVIDER=claude` sélectionne explicitement Claude. `EVAL_MODEL` et `EVAL_EFFORT` paramètrent une campagne distincte ; un effort différent n'est pas une validation du couple requis pour les slices. Sous PowerShell, utiliser `$env:EVAL_MODEL = 'identifiant'`, puis lancer le script ; ne pas recopier la syntaxe d'affectation Bash. Une surcharge complète utilise `EVAL_EXECUTABLE` et `EVAL_ARGS_JSON` (tableau JSON d'arguments), jamais l'ancien `EVAL_CMD` avec concaténation shell. Timeout fournisseur : 60 secondes ; aucun retry automatique.

**Avant tout appel modèle, la vérification gratuite.** `node evals/lint-referentiel.mjs` (ou `pnpm lint:docs`) contrôle la **cohérence formelle** du référentiel : règle citée qui n'existe nulle part, satellite présent sur disque mais absent de la table §5, placeholder d'identifiant jamais résolu, budget de racine ou de satellite dépassé, statut de slice inventé dans une commande, chiffre annoncé périmé. Aucun appel modèle, moins d'une seconde, exécutable en CI — donc **rien de tout cela ne DOIT consommer un appel LLM**. C'est le niveau V0 de PROG-10 appliqué au référentiel : le moins cher, le premier à rentabiliser, jamais le plus fort. Un ⚠ (budget) n'échoue pas ; un ✗ (incohérence) échoue.

**Troisième objet, à ne pas confondre avec les deux premiers : le code du harness lui-même.** `guard-bash.mjs` et `preview.mjs` sont du code, pas de la prose — ils se testent comme du code, sans appel modèle. `node evals/guard-bash.test.mjs` (26 cas, instantané, aucune dépendance) exécute le hook réel et vérifie qu'il bloque ce qu'il doit bloquer **et laisse passer le reste** — la seconde moitié compte autant : un garde-fou qui bloque `pnpm test` est un garde-fou qu'on désactive. Cette suite ne relève pas d'EVAL-01, qui borne le nombre de suites **appelant un modèle** ; elle est gratuite et tourne à chaque modification du hook.

## EVAL-01 — Une seule suite machine, et elle est bon marché

`node evals/run.mjs` (ou `/eval-routing`) envoie **un seul** prompt contenant la table de routage §5 et les cas, et compare les satellites annoncés aux attentes. Contrainte de conception assumée : moins d'une minute, coût négligeable, aucune dépendance installée requise. Une éval qu'on hésite à lancer n'est pas lancée — la vélocité fait partie de la spécification, pas des compromis.

## EVAL-02 — Déclencheur : la modification du référentiel, rien d'autre

L'éval de routage DOIT être exécutée avant tout merge d'une PR touchant `CLAUDE.md` §5, un satellite de `docs/`, ou un renommage de satellite (origine HRN-KNOW-004). Elle NE DOIT PAS entrer dans la boucle quotidienne : une slice ordinaire ne modifie pas le référentiel et n'a donc rien à évaluer.

En profil solo, l'exécution est **locale, en pré-merge** — pas en CI. Un job CI exigerait une authentification de la CLI dans le pipeline pour un gain nul quand une seule personne ouvre les PR. Ce choix est une dégradation assumée, pas un oubli (HRN-INFRA-010).

## EVAL-03 — Assertions d'inclusion, jamais d'égalité

Un cas déclare `load` (satellites dont l'absence rendrait la tâche non conforme) et `exclude` (satellites dont la présence serait un gaspillage réel). Tout satellite ni listé ni exclu est **neutre**.

L'égalité stricte d'ensembles est interdite : elle produirait un échec à chaque ajout de satellite, et une suite qui crie au loup finit désactivée. Une assertion trop stricte est un bug d'éval, pas une rigueur supplémentaire.

## EVAL-04 — Canaris à oracle humain

`evals/canaries.md` couvre cinq comportements non routables : refus d'inventer une règle métier, respect du gate de plan, honnêteté du ledger, traitement du contenu externe, changement de stratégie après deux échecs. Oracle V5, passage manuel, au changement de modèle ou après modification des §3/§6 de la racine. Chaque campagne DOIT être consignée dans le journal du fichier — c'est la seule trace qui permet de comparer deux modèles *dans ce harness*.

## EVAL-05 — Le corpus vient du réel (origine HRN-EVAL-002)

Tout écart constaté en revue — mauvais satellite chargé, exclusion ignorée, élément déclaré vérifié sans oracle — DOIT devenir un cas avant la clôture de la slice (PROG-08). Deux minutes d'écriture. Les cas inventés a priori valent beaucoup moins que les cas rencontrés : ce sont les seconds qui décrivent les défaillances réelles du référentiel.

Un cas ajouté après un échec NE DOIT PAS être supprimé une fois la règle corrigée. C'est un test de non-régression.

## EVAL-06 — Portée honnête (ce que l'éval ne prouve pas)

L'éval de routage prouve que la table permet de **désigner** les bons satellites. Elle ne prouve pas que l'agent **applique** leurs règles une fois chargés. C'est un proxy : très supérieur à rien, très inférieur à une éval assertant sur un diff réel dans un dépôt fixture.

Ce niveau supérieur n'est volontairement pas construit : il exige des fixtures maintenues et consomme du budget à chaque exécution. Il ne DEVRAIT être envisagé qu'après qu'une même règle a été violée deux fois en production. Dans le ledger du harness lui-même, la conformité aux règles chargées est un « fait non vérifié » — le nommer vaut mieux que le masquer (G-18).

## EVAL-07 — Variance (origine HRN-EVAL-004)

Un run unique n'est pas un signal. Pour une comparaison mesurée de modèle ou d'effort, la campagne DOIT compter au moins 3 exécutions, et l'écart entre elles DOIT être noté. La préférence explicite du porteur en PROG-12 s'applique sans prétendre provenir d'une telle comparaison. Pour la vérification de routine d'une PR sur le référentiel, une exécution suffit : on y cherche une casse franche, pas un delta de deux points.

**Le modèle DOIT être épinglé pour une campagne** : `EVAL_MODEL=<id> node evals/run.mjs`. Sans épinglage, la CLI répond avec son défaut du jour et l'« écart » mesuré peut n'être qu'un changement de modèle — on croit mesurer le référentiel, on mesure le fournisseur. Chaque exécution ajoute une ligne à `evals/history.jsonl` (date, modèle, score, cas rouges) : c'est l'équivalent, pour l'éval machine, du journal des passages de `canaries.md`, et la seule base sur laquelle deux campagnes se comparent. Une exécution non épinglée reste utile en routine — elle est simplement marquée comme telle dans l'historique.
