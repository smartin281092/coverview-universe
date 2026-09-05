# Spécifications canoniques des slices

Les JSON de ce dossier contiennent le contenu rédigé des slices. Plans, prompts, backlog, couverture et index sont des vues générées pour éviter des versions divergentes. Le texte de la bible n'est pas recopié ; les critères indiquent les paragraphes sources dont les IDs d'inventaire sont résolus lors de la génération. Source métier : DOC-16.

Schéma de rédaction (tableau de slices par fichier JSON) :

```json
{
  "id": "S-010",
  "title": "Titre concret",
  "milestone": "M1",
  "objective": "Persona peut accomplir un parcours et obtenir un résultat observable.",
  "depends_on": ["S-000a"],
  "apps": ["api", "client"],
  "modules": ["nom-du-domaine"],
  "mode": "local-fixtures",
  "priority": 100,
  "session_budget": 1,
  "journey": ["étape précise", "résultat ou retour"],
  "data": ["objets persistés et contraintes utiles"],
  "permissions": ["règle connue et refus à vérifier, pas de permission inventée"],
  "events_jobs": ["événements/jobs nécessaires ou aucun justifié"],
  "fixtures": ["personas et cas précis"],
  "integrations": {"simulated": ["tiers simulé"], "real": ["brique réellement connectée"], "activation_slices": ["S-xxx"]},
  "criteria": [{"criterion": "Critère vérifiable spécifique", "source_ranges": [[794,811]], "oracle": "V2", "test": "Scénario ou assertion précise, sans commande inexistante prétendue"}],
  "questions": [{"ref": "bible.question.008", "question": "Question fermée à résoudre avant le périmètre concerné ?", "options": ["choix proposé", "alternative"], "recommended": 0, "blocks": "partie exacte bloquée"}],
  "satellites": ["data.md", "api.md"],
  "exclusions": ["billing.md"],
  "risks": ["risque concret et mitigation"],
  "out_of_scope": ["limite avec slice propriétaire lorsqu'elle est connue"],
  "split_trigger": "Frontière utilisateur où redécouper si la session ne suffit pas"
}
```

Les plages sont inclusives, correspondent aux ancrages `pNNNN` de la source épinglée et peuvent se répéter entre critères qui consomment réellement le même comportement. Elles sont ciblées, pas une plage de plusieurs chapitres servant de couverture artificielle. Les critères couvrent tout le comportement de leur source ; les titres/glossaire/métadonnées sont qualifiés séparément comme contexte, avec justification. Les variantes encore indécises deviennent des questions ; un défaut proposé n'est jamais une décision déjà approuvée.

Valeurs de mode : `local-fixtures` (code métier et persistance réels, tiers ou données de référence fictifs), `integration` (connexion tierce testable), `release` (activation et preuves de production), `foundation` (exception de socle). Tous les plans produits restent soumis et les slices `specified` jusqu'à leur autorisation et la clôture des décisions concernées.
