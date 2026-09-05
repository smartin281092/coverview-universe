# CoverView

Harness Claude Code / Codex et roadmap complète préparés pour la v1 décrite dans la bible. **Lancement et enchaînement des slices autorisés**, avec les meilleurs défauts et une nouvelle tâche Astra Ultra par slice selon [le mandat](roadmap/execution-policy.md). [L'index des slices](roadmap/index.md) donne les plans, prompts et états réels.

## Commencer

Lire [AGENTS.md](AGENTS.md), son référentiel [CLAUDE.md](CLAUDE.md), puis [PROJECT.md](PROJECT.md). Pour Codex : [procédures, session et reprise](docs/codex.md). Les fichiers `.claude/commands/` sont des procédures canoniques lisibles directement, pas des commandes slash natives Codex.

## Références utiles

| Besoin | Point d'entrée |
|---|---|
| Bible maître, couverture et questions | [Index produit](docs/product/README.md) |
| Capacités et parcours analysés | [Carte fonctionnelle](docs/product/capabilities.md) |
| État de la planification | [ROADMAP](ROADMAP.md), [méthode et traçabilité](roadmap/README.md) |
| Identité visuelle et assets | [Charte](docs/brand.md) |
| WorkOS et cible cloud protégée | [Authentification](docs/auth.md), [hébergement](docs/hosting.md) |
| Décisions d'initialisation | [ADR-0001](adr/0001-harness.md) puis ADR liés depuis PROJECT |
| Résultat et vérifications | [Livraison de la roadmap](roadmap/review.md), [initialisation historique](roadmap/initialisation.md) |
| Prochaine session | [Checkpoint roadmap](roadmap/handoffs/roadmap.md) |

## Vérifier le cadrage

```powershell
node evals/lint-referentiel.mjs
node --test evals/run.test.mjs scripts/context-handoff.test.mjs
node evals/guard-bash.test.mjs
node scripts/verify-brand.mjs
node --test scripts/roadmap.test.mjs scripts/build-roadmap.test.mjs
node scripts/build-roadmap.mjs --check --require-complete
node scripts/verify-planning.mjs --require-complete
python scripts/extract-bible.py --check
node scripts/context-handoff.mjs check roadmap/handoffs/roadmap.md
```

Le runtime Python embarqué et les limites de l'extraction sont documentés dans l'index produit. `node evals/run.mjs --dry` vérifie aussi la génération du prompt d'évaluation ; une campagne modèle réelle est distincte et reste à exécuter sur une surface compatible.

Les commandes applicatives `pnpm dev`, `pnpm build` et `pnpm test` ne seront disponibles qu'après le scaffold planifié. Le thème préparé n'est pas encore appliqué à une interface. Aucun compte, déploiement ou DNS n'est déclaré opérationnel par ces fichiers.

Dépôt distant : [smartin281092/coverview-universe](https://github.com/smartin281092/coverview-universe), configuré comme `origin`. État de synchronisation dans PROJECT et le journal. Version reçue du harness : 2.1.0 ; adaptation locale documentée dans [CHANGELOG](CHANGELOG.md).
