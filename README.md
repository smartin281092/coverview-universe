# CoverView

Harness Claude Code / Codex et roadmap complète préparés pour la v1 décrite dans la bible. **Lancement et enchaînement des slices autorisés**, avec les meilleurs défauts et une nouvelle tâche Astra Ultra par slice selon [le mandat](roadmap/execution-policy.md). [L'index des slices](roadmap/index.md) donne les plans, prompts et états réels.

## Commencer

Partner est disponible en développement sur `http://127.0.0.1:4104` : [parcours et lancement](apps/partners/README.md), [état vérifié et limites](roadmap/evidence/partner-core.md). Les candidatures requièrent une validation explicite avant accès opérationnel.

Installer la LTS de Node indiquée dans `.node-version`, pnpm indiqué dans `package.json`, et Docker avec Compose. Depuis un checkout propre :

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env # seulement si .env n'existe pas
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
node scripts/preview.mjs start
```

Le panneau affiche les trois interfaces et les personas provenant des seeds. `pnpm dev` lance aussi les quatre applications au premier plan. Le [README platform](apps/api/src/platform/README.md) décrit les gardes et la persistance technique. Le module [identity](apps/api/src/modules/identity/README.md) porte la connexion WorkOS et les espaces protégés : son [activation locale](apps/api/src/modules/identity/README.md#activer-et-vérifier-localement) requiert `AUTH_ENABLED=true` et des credentials réservés à l’API. La preview accepte aussi leur lecture depuis un `.env` local existant, conformément à la demande utilisateur du 11 septembre 2026 ; voir la procédure du module identity. Ils restent exclus des serveurs et builds frontend. L’exemple conserve l’authentification désactivée ; les personas ne sont pas des comptes de connexion.

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

## Commandes personnalisées du harness

Les 10 commandes de [`.claude/commands/`](.claude/commands/) sont listées ci-dessous. Chaque lien ouvre la procédure de référence ; les arguments entre chevrons sont à remplacer par la valeur voulue.

| Commande                                                                      | Ce qu'elle fait / quand l'utiliser                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [/harness](.claude/commands/harness.md)                                       | Affiche l'aide des commandes, leurs moments d'usage, la boucle de travail et l'état du projet. À utiliser pour se repérer ; ne modifie rien.                                                              |
| [/start-project](.claude/commands/start-project.md)                           | Initialise un nouveau projet : interview, identité du projet, ADR, roadmap, mémoire et plan du socle technique. Si le projet est déjà initialisé, oriente vers une revue de roadmap.                      |
| [/plan &lt;S-xxx&gt;](.claude/commands/plan.md)                               | Prépare le plan persistant d'une slice : dépendances, objectif, inconnues, critères de réussite et session recommandée. À utiliser avant son implémentation.                                              |
| [/new-module &lt;nom&gt;](.claude/commands/new-module.md)                     | Crée le squelette minimal d'un module backend, son API publique et son README, puis l'ajoute à la carte des modules du projet.                                                                            |
| [/preview](.claude/commands/preview.md)                                       | Lance la preview locale et présente les URLs, l'accès aux comptes, les points observables à tester pour la slice en cours et la suite à donner.                                                           |
| [/ship &lt;S-xxx&gt;](.claude/commands/ship.md)                               | Prépare la livraison de la slice : bilan avec preuves et limites, mise à jour du suivi, mémoire et documentation, commit et préparation de la suite selon le mandat courant.                              |
| [/review-roadmap](.claude/commands/review-roadmap.md)                         | Réexamine les priorités du backlog, les idées devenues sans objet et les entrées mémoire expirées. À utiliser pour adapter la roadmap aux résultats réels.                                                |
| [/memory-review](.claude/commands/memory-review.md)                           | Révise les candidats de `MEMORY.md`, propose leur destination durable et traite les entrées actives expirées par revalidation, promotion ou dépréciation.                                                 |
| [/eval-routing](.claude/commands/eval-routing.md)                             | Exécute l'évaluation du routage documentaire, présente les résultats et diagnostique les échecs. À utiliser après une modification de la table de routage ou d'un satellite ; consomme des appels modèle. |
| [/harness-upgrade &lt;chemin-source&gt;](.claude/commands/harness-upgrade.md) | Compare le harness local à une version source plus récente, classe les changements et conflits, puis applique les évolutions retenues en conservant les adaptations locales.                              |

Dans Codex, demander par exemple : `Applique .claude/commands/plan.md pour S-042a` ou `Applique .claude/commands/preview.md`. Le mode d'invocation et la distinction avec les commandes natives, notamment `/plan`, sont décrits dans [CDX-01](docs/codex.md#cdx-01--chargement-et-procédures).

Parcours habituel : planifier → implémenter → ouvrir la preview si la slice a une surface visible → livrer. Les modalités d'autonomie et d'enchaînement propres à CoverView restent définies dans [le mandat courant](roadmap/execution-policy.md).

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
| Reprise après preuves manquantes      | [Checkpoint S-011 review](roadmap/handoffs/S-011-review.md)                                          |

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
