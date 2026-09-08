# Utiliser la roadmap CoverView

La roadmap complète est rédigée depuis la bible épinglée dans [l'inventaire produit](../docs/product/README.md). [L'index ordonné](index.md) donne un plan et un prompt Astra Ultra pour chaque slice. L'utilisateur a ensuite autorisé l'exécution séquentielle et le choix des meilleurs défauts : [mandat courant](execution-policy.md), PROG-23. Consigner les décisions au début de chaque slice et créer la suivante dans une nouvelle tâche après la clôture vérifiée.

## Sources et vues

| Artefact canonique | Responsabilité |
|---|---|
| `specs/*.json` | Objectif, parcours, critères/oracles, données, droits, fixtures, dépendances, décisions à prendre et budget de chaque slice |
| `source-links.json` | Liens sémantiques complémentaires des résumés, matrices et workflows vers les critères précis ; justification obligatoire |
| `context.json` | Titres, glossaire, en-têtes et provenance qualifiés explicitement ; aucun domaine fonctionnel exclu |
| `state.json` | Statut, approbation, réponses, essais, preuves, ledger, session réellement observée et coût |

`ROADMAP.md`, `index.md`, `workflows.md`, `decisions.md`, `backlog.yaml`, `coverage.json`, les plans et les prompts sont des **vues générées**. Modifier leur source canonique puis lancer `node scripts/build-roadmap.mjs`. Le générateur ne réécrit jamais state.json. L'historique Git reste le journal immuable de ces changements (PROG-13).

Les IDs sont stables ; ne pas renuméroter pour modifier l'ordre. Le tri respecte les dépendances, puis la priorité de rédaction. Les jalons regroupent les résultats mais ne forcent pas des barrières artificielles entre domaines. Revoir l'ordre selon PROG-11, sans supprimer une capacité de la bible au motif qu'elle était dite future. Un redécoupage conserve le parent et ses preuves, ajoute des IDs et revoit les dépendances.

## Du plan à l'exécution

1. Choisir le prochain résultat dont les dépendances sont terminées. Lire son plan, ses critères et ses questions avant de lancer le prompt.
2. Réutiliser les décisions et autorisations existantes. Résoudre uniquement les questions encore ouvertes au périmètre concerné ; les options recommandées ne sont pas des réponses déjà approuvées.
3. Régler réellement la tâche sur `gpt-6-astra` / `ultra` selon [Codex](../docs/codex.md). Le prompt ne modifie pas le sélecteur ; WIP=1 et une session principale cible avec frontière de redécoupage.
4. Réaliser le parcours avec le paquet source ciblé, les guards dès la première écriture et les oracles propres au plan. Un tiers simulé garde sa slice d'intégration réelle. Tout nouvel objet privé persistant rejoint le manifeste export/rétention des services S-130/S-131, ou son contrat si ces services ne sont pas encore livrés ; aucune durée juridique n'est inventée.
5. Mettre à jour l'entrée de state.json, les documents propriétaires et le journal Git, puis régénérer les vues. Consigner les preuves, passer en review et appliquer PROG-08/PROG-23 avant done. Lorsque le mandat est actif, créer la tâche de la slice suivante selon execution-policy.md ; aucune nouvelle demande de GO pour le périmètre déjà autorisé.

Format d'une entrée d'état, à renseigner avec des faits réels (les clés absentes gardent leurs valeurs vides, le statut absent reste specified) :

```text
slices[ID]
  status: specified | ready | running | review | done
  approval: texte et référence de l'autorisation effective du périmètre
  decisions: [{ref, question, answer, evidence}]
  verification_attempts: [{target, oracle, observed, decision}]
  session: modèle/effort réellement observés, ou non observable
  cost: coût constaté, ou non disponible
  notes: références vers preuves, commits et comptes rendus
  ledger: {verified: [], unverified: [], assumptions: []}
```

Pour chaque question bloquante, conserver son `ref`, le texte exact `question`, la réponse explicite `answer` et sa preuve `evidence` (message/date ou document de décision). Une même décision acquise peut être référencée depuis plusieurs plans. Une réponse devient une règle métier dans son propriétaire selon DOC-11, pas seulement une ligne enfouie dans ce registre. Si le texte ou la portée change, vérifier à nouveau l'applicabilité de la réponse.

## Vérifications documentaires

```powershell
node scripts/build-roadmap.mjs
node scripts/build-roadmap.mjs --check --require-complete
node scripts/verify-planning.mjs --require-complete
node --test scripts/roadmap.test.mjs scripts/build-roadmap.test.mjs
node evals/lint-referentiel.mjs
```

Ces contrôles valident hash source, IDs, plages, graphe acyclique, liens de critères/activations, état, réponses requises et fraîcheur des vues. La couverture rattache les unités source aux critères ou justifie leur nature documentaire. Une unité, notamment une ligne de tableau, peut contenir plusieurs exigences : le nombre d'unités n'est pas le nombre de fonctionnalités. Les liens exacts et critères restent consultables dans coverage.json.

La revue sémantique recherche les omissions, faux liens de couverture et dépendances métier manquantes. Les contrôles structurels ne prouvent ni l'exactitude des règles financières, ni l'accord humain, ni une fonctionnalité ou intégration déjà réalisée. S-139 consolide ces preuves lors de la recette ; une démo seule ne termine pas la v1.

## Reprise

[La revue du 8 septembre 2026](evidence/roadmap-review-2026-09-08.md) explique l’ordre et les preuves restant à consolider ; `state.json` et l’index généré portent l’état courant. [Le checkpoint de rédaction](handoffs/roadmap.md) est historique. CDX-03 gouverne les reprises futures : nouvelle tâche propre au seuil de 70 % si une mesure fiable existe, sinon checkpoint préventif sans annoncer de seuil mesuré.
