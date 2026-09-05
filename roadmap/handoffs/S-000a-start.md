# Reprise de travail — lancement S-000a

Créé : 2026-09-05. Contexte observé : non disponible ; nouvelle tâche propre demandée par slice, sans attendre une mesure de 70 %.

## Mission et autorisation

Implémenter S-000a puis enchaîner la roadmap dans une nouvelle tâche Astra Ultra par slice. Le message utilisateur du 2026-09-05 autorise expressément le premier lancement, les suivants et les meilleurs défauts ; texte et protocole dans roadmap/execution-policy.md, PROG-23. Pas de nouveau GO à demander. Une seule slice active. Après la clôture prouvée, créer réellement la suivante et attendre son premier état avant de finir.

## État du dépôt

Checkout enregistré D:/Projects/coverview-astra, main ; les tâches de slice utilisent un worktree. Roadmap initiale au commit 4c49598, mandat et relais dans le commit de lancement transmis avec le prompt de création. Vérifier que ce SHA est ancêtre de HEAD avant mutation. Repo origin smartin281092/coverview-universe, pas de push réalisé par la préparation. Aucun code applicatif créé ; état S-000a ready, autres specified. Vérifier les états réels à l'entrée.

## Sources à lire

AGENTS.md → CLAUDE.md, PROJECT.md, entrées actives MEMORY.md, docs/codex.md et roadmap/execution-policy.md. Puis roadmap/plans/S-000a.plan.md et roadmap/prompts/S-000a.prompt.md ; charger les satellites du plan et uniquement les fichiers/templates de scaffold utiles. state.json est la source durable des décisions, statuts, tentatives et preuves. Ne pas charger toute la bible ni les 120 prompts.

## Décisions acquises

Stack imposée, quatre surfaces minimales api/client/admin/www ; données fictives et persona bypass strictement local/development ; aucune authentification de démonstration déployée. WorkOS coverview arrive en S-000b. Preset shadcn, charte, UX de détails et protection Infomaniak selon PROJECT. Pas de question bloquante dans S-000a. Pour les prochaines slices, consigner les meilleurs défauts en décisions déléguées, sans fausse validation externe.

## Livraison et preuves

Roadmap complète : 120 slices, 682 critères, 2 115 unités affectées. Le mandat d'enchaînement et le rendu des futurs prompts ont été adaptés ; tests de génération/guards, fraîcheur et linter vérifiés avant création. Aucune preuve d'implémentation de S-000a, aucun package applicatif installé par cette préparation. Revoir le journal de la slice pour les essais ultérieurs, pas ce checkpoint historique.

## Prochaine action bornée

Vérifier SHA, checkout, ports/processus locaux et outils disponibles ; mettre S-000a running sous la propriété de cette tâche. Réaliser le scaffold, infrastructure locale, migrations/seeds minimaux, health API, coquilles/preview et CI selon les six critères du plan. Installer les versions stables constatées, avec documentation officielle ciblée au besoin. Vérifier réellement les parcours et le redémarrage de preview. Puis livrer, commiter, intégrer localement sans perte et créer la tâche de la prochaine slice éligible selon execution-policy.md ; S-000b est normalement la suivante.

## Obstacles et tentatives

Aucun essai d'implémentation précédent à rejouer. Disponibilité Docker, pnpm, services et outils de preview à constater dans cette tâche ; ne pas déclarer une dépendance fonctionnelle sans l'avoir exécutée. CLI Codex inspectée auparavant incompatible Ultra ; la création de tâche impose les paramètres réels Astra/ultra. Les permissions/adresses/providers non observés ne sont pas des faits acquis.

## Coordination

La tâche de préparation cesse ses écritures après la création. La tâche S-000a possède le code et state.json. Éviter collisions de ports/volumes avec le checkout et les autres projets ; ne pas arrêter des services étrangers. Les .env et dépendances non suivies ne sont pas transportés par Git. Transmettre le SHA testé et le checkpoint à la tâche suivante, sans copier l'historique conversationnel.
