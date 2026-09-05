# CoverView

Harness Claude Code / Codex et roadmap complète préparés pour la v1 décrite dans la bible. **Lancement et enchaînement des slices autorisés**, avec les meilleurs défauts et une nouvelle tâche Astra Ultra par slice selon [le mandat](roadmap/execution-policy.md). [L'index des slices](roadmap/index.md) donne les plans, prompts et états réels.

## Commencer

Installer la LTS de Node indiquée dans `.node-version`, pnpm indiqué dans `package.json`, et Docker avec Compose. Depuis un checkout propre :

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env # seulement si .env n'existe pas
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
node scripts/preview.mjs start
```

Le panneau affiche les trois interfaces et les personas provenant des seeds. `pnpm dev` lance aussi les quatre applications au premier plan. Le [README platform](apps/api/src/platform/README.md) décrit les gardes et la persistance technique. Le module [identity](apps/api/src/modules/identity/README.md) porte la connexion WorkOS et les espaces protégés : son [activation locale](apps/api/src/modules/identity/README.md#activer-et-vérifier-localement) requiert `AUTH_ENABLED=true` et des secrets injectés uniquement dans le processus API, jamais dans `.env` ou les builds frontend. L’exemple conserve l’authentification désactivée ; les personas ne sont pas des comptes de connexion.

Les services Docker sont liés à `127.0.0.1`, avec des ports dédiés dans le compose. Pour un autre checkout concurrent, choisir un `COMPOSE_PROJECT_NAME` et des ports distincts avant démarrage. Ne pas reprendre les volumes d'un autre projet.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:tooling
pnpm build
pnpm boundaries
pnpm check:env
pnpm check:bundles
pnpm exec playwright install chromium
pnpm check:www # build du site, SEO et budgets synthétiques locaux
pnpm test:e2e # preview démarrée
node scripts/preview.mjs stop
```

`stop --all` arrête aussi les services Docker du compose courant, en conservant leurs volumes. La preview ne migre ni n'efface la base. `pnpm db:generate` génère le SQL depuis Drizzle ; `db:migrate` applique les migrations locales. Le reset exige désormais `--confirm-local-reset` et `--confirm-identity-reset` : il détruit aussi les identités et leur audit. Lire la [procédure platform](apps/api/src/platform/README.md#données-et-exploitation) avant tout emploi. Le rollback applicatif conserve les tables additives et l’audit. Les tâches de la CI sont les mêmes commandes dans un job isolé ; son exécution distante n'est pas déduite des contrôles locaux.

Sous Windows, un ancien shim pnpm peut échouer à lancer la version native épinglée. Installer la version de `packageManager` et utiliser son exécutable `pnpm.exe` directement ; la preview utilise les binaires Node locaux des apps. En cas de refus de port par Windows, vérifier `netsh interface ipv4 show excludedportrange protocol=tcp` sans modifier les réservations système.

Lire [AGENTS.md](AGENTS.md), son référentiel [CLAUDE.md](CLAUDE.md), puis [PROJECT.md](PROJECT.md). Pour Codex : [procédures, session et reprise](docs/codex.md). Les fichiers `.claude/commands/` sont des procédures canoniques lisibles directement, pas des commandes slash natives Codex.

## Références utiles

| Besoin                                | Point d'entrée                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Bible maître, couverture et questions | [Index produit](docs/product/README.md)                                                              |
| Capacités et parcours analysés        | [Carte fonctionnelle](docs/product/capabilities.md)                                                  |
| État de la planification              | [ROADMAP](ROADMAP.md), [méthode et traçabilité](roadmap/README.md)                                   |
| Identité visuelle et assets           | [Charte](docs/brand.md)                                                                              |
| WorkOS et cible cloud protégée        | [Authentification](docs/auth.md), [hébergement](docs/hosting.md)                                     |
| Décisions d'initialisation            | [ADR-0001](adr/0001-harness.md) puis ADR liés depuis PROJECT                                         |
| Résultat et vérifications             | [Livraison de la roadmap](roadmap/review.md), [initialisation historique](roadmap/initialisation.md) |
| Reprise après preuves manquantes       | [Checkpoint S-011 review](roadmap/handoffs/S-011-review.md)                                         |

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

Le site public ouvre les trois parcours S-010, une démonstration fictive et la navigation vers des destinations dont la disponibilité est explicite : [preuves S-010](roadmap/evidence/S-010.md). Les pages de méthode, comparaison et exemples de [S-011](roadmap/evidence/S-011.md) sont lisibles localement ; la slice reste review faute de références éditoriales/Instagram et collecte CRM complètes. Les apps conservent le socle technique et le parcours compte de S-000b. L’implémentation WorkOS est présente ; son activation, les parcours réellement exécutés et les obstacles externes sont consignés dans [le ledger S-000b](roadmap/evidence/S-000b.md). Aucun compte autorisé, droit administratif, déploiement ou DNS n’est prouvé par ces fichiers. Aucune nouvelle slice n’a actuellement toutes ses dépendances done ; reprendre selon le checkpoint lorsque les préconditions réelles sont disponibles.

Dépôt distant : [smartin281092/coverview-universe](https://github.com/smartin281092/coverview-universe), configuré comme `origin`. État de synchronisation dans PROJECT et le journal. Version reçue du harness : 2.1.0 ; adaptation locale documentée dans [CHANGELOG](CHANGELOG.md).
