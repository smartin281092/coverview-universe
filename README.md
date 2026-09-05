# CoverView

Harness Claude Code / Codex initialisé pour préparer la v1 complète décrite dans la bible. **Aucune application n'est encore implémentée.** La prochaine étape est l'écriture de la roadmap détaillée et des prompts de slices Astra Ultra.

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
| Résultat et vérifications | [Journal d'initialisation](roadmap/initialisation.md) |
| Prochaine session | [Checkpoint](roadmap/handoffs/initialisation.md) |

## Vérifier le cadrage

```powershell
node evals/lint-referentiel.mjs
node --test evals/run.test.mjs scripts/context-handoff.test.mjs
node evals/guard-bash.test.mjs
node scripts/verify-brand.mjs
node scripts/verify-planning.mjs
python scripts/extract-bible.py --check
node scripts/context-handoff.mjs check roadmap/handoffs/initialisation.md
```

Le runtime Python embarqué et les limites de l'extraction sont documentés dans l'index produit. `node evals/run.mjs --dry` vérifie aussi la génération du prompt d'évaluation ; une campagne modèle réelle est distincte et reste à exécuter sur une surface compatible.

Les commandes applicatives `pnpm dev`, `pnpm build` et `pnpm test` ne seront disponibles qu'après le scaffold planifié. Le thème préparé n'est pas encore appliqué à une interface. Aucun compte, déploiement ou DNS n'est déclaré opérationnel par ces fichiers.

Dépôt distant : [smartin281092/coverview-universe](https://github.com/smartin281092/coverview-universe), configuré comme `origin`. État de synchronisation dans PROJECT et le journal. Version reçue du harness : 2.1.0 ; adaptation locale documentée dans [CHANGELOG](CHANGELOG.md).
