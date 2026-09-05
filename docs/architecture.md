# Architecture

> **Résumé** : Slices verticales et walking skeleton d'abord ; monolithe modulaire, frontières de modules imposées par l'outillage, arborescence de référence du monorepo, règles multi-frontends (backend seule autorité).

## ARCH-01 — Vertical slices

Chaque développement DOIT produire autant que possible une capacité utilisateur complète reliant : interface, authentification, permissions, API, logique métier, base de données, événements nécessaires, workers éventuels, retours temps réel, déploiement, observabilité minimale.

Une fonctionnalité n'est PAS terminée parce qu'un écran existe, qu'une route répond, qu'un composant fonctionne avec des données fictives, qu'un mock répond ou qu'un test passe. Elle est terminée lorsqu'un utilisateur autorisé effectue réellement le parcours avec des données persistantes.

## ARCH-02 — Walking skeleton

Construire d'abord un parcours minimal complet traversant tout le système : authentification réelle, une page fonctionnelle, une API réelle, une persistance réelle, un premier événement temps réel, un premier déploiement accessible. Cela prime sur l'accumulation de composants et d'écrans de démonstration.

## ARCH-03 — Monolithe modulaire par défaut

DOIT être privilégié avant les microservices. Chaque domaine métier a une frontière identifiable (`authentication`, `organizations`, `users`, `projects`, `deployments`, `billing`, `subscriptions`, `notifications`, `leads`, `files`, `audit`, `reports`…).

Un service séparé ne se justifie que par un besoin concret : déploiement indépendant, charge très différente, isolation forte, contrainte réglementaire, technologie spécifique, frontière métier stable, équipe autonome, criticité particulière.

## ARCH-04 — Commencer simple

Toujours choisir la solution la plus simple qui répond correctement au besoin actuel. Avant toute abstraction, répondre : 1) quel problème concret résout-elle ? 2) ce problème existe-t-il déjà ? 3) y a-t-il plusieurs usages réels ? 4) simplifie-t-elle immédiatement le système ? 5) réduit-elle réellement le risque ou la duplication ? 6) son coût de maintenance est-il raisonnable ? Ne pas construire pour des besoins hypothétiques.

## ARCH-05 — Sources de vérité

| Élément | Rôle |
|---|---|
| Base de données | Données persistantes |
| Backend | Règles métier et permissions |
| Queue persistante | Exécution asynchrone |
| Stockage objet | Fichiers et artefacts (voir `storage.md`) |
| Cache frontend | Représentation locale des données serveur |
| State local | Interactions temporaires |
| WebSocket | Notification de changement |
| Event bus | Transmission de faits entre composants backend |

NE DOIVENT JAMAIS devenir des bases de données alternatives : WebSockets, stores frontend, caches, rooms, événements, singletons, mémoire du processus Node.js.

## ARCH-06 — Arborescence de référence du monorepo

```
.
├── CLAUDE.md                  # racine du harness — AGENTS.md y renvoie, JAMAIS une copie (DOC-10)
├── PROJECT.md                 # identité produit — généré par /start-project (bootstrap.md)
├── ROADMAP.md                 # jalons — mémoire de planification (program.md)
├── MEMORY.md                  # mémoire projet (memory.md)
├── roadmap/
│   ├── backlog.yaml           # slices, statuts, dépendances
│   └── plans/                 # plans persistés (S-000.plan.md, …)
├── HARNESS_VERSION            # version du harness d'amorçage (BOOT-08)
├── templates/                 # PROJECT, ROADMAP, backlog, plan, ADR, MEMORY, README de module
│   └── scaffold/              # fichiers de config livrés, copiés à S-000a (BOOT-09)
├── docs/                      # ce référentiel (satellites routés)
├── adr/                       # décisions d'architecture
├── evals/                     # évals du référentiel + tests du hook (evals.md)
├── scripts/preview.mjs        # lanceur de preview détaché (ENV-08)
├── preview.config.mjs         # apps, ports, services, moyens de paiement de test
├── .claude/commands/          # /start-project, /plan, /ship, /preview, /harness-upgrade…
├── .claude/hooks/             # guard-bash.mjs — bras armé de G-05 (ENV-06)
├── apps/
│   ├── api/                   # backend Node.js
│   │   └── src/
│   │       ├── modules/       # un dossier par domaine (ARCH-07)
│   │       ├── platform/      # http, ws-gateway, queue, db, config, logger
│   │       └── main.ts
│   ├── client/                # application cliente (produit, authentifié)
│   │   └── src/features/      # un dossier par fonctionnalité (frontend.md)
│   ├── admin/                 # back-office administrateur
│   └── www/                   # site marketing + blog — SSG, indépendant de l'app (marketing-web.md)
├── packages/
│   ├── contracts/             # schémas runtime + types partagés (contracts.md)
│   ├── catalog/               # catalogue commercial : plans, entitlements, limites (catalog.md)
│   ├── api-client/            # client API partagé : appels typés au backend, dérivé de contracts (ARCH-13)
│   └── ui/                    # uniquement si réellement partagé (FRONT-05)
├── docker-compose.yml         # infra LOCALE : postgres, redis, minio, mail — à la racine,
│                              # pour que `docker compose up -d` (§0bis) fonctionne sans -f
├── infra/                     # artefacts de DÉPLOIEMENT uniquement
│   ├── Dockerfile.*           # images des apps
│   ├── docker-compose.prod.yml
│   ├── Caddyfile              # TLS, reverse proxy
│   └── …
└── .env.example
```

La stack est imposée par §0 de CLAUDE.md ; les apps réellement activées viennent de `PROJECT.md` (bootstrap). Toute app frontend additionnelle décidée à l'interview (ex. portail tiers, app mobile) suit le même modèle et les règles ARCH-13. Conserver la logique : apps consommatrices séparées, backend modulaire, partage minimal et explicite.

## ARCH-07 — Un dossier par module fonctionnel

```
modules/deployments/
  README.md                 # racine locale : 5 sections + table de routage (DOC-02, DOC-14)
  docs/                     # sous-documents par capacité — seulement après scission (DOC-13)
    scheduling.md
    rollback.md
  deployment.routes.ts
  deployment.schemas.ts
  deployment.service.ts
  deployment.domain.ts
  deployment.repository.ts
  deployment.events.ts
  deployment.jobs.ts
  deployment.permissions.ts
  deployment.errors.ts
  index.ts
```

Ne créer que les fichiers réellement utiles : un module simple commence petit et évolue. `docs/` n'existe qu'après scission du README (DOC-13) — jamais à la création.

## ARCH-08 — Une responsabilité principale par fichier

Compréhensible depuis son nom. Éviter les fichiers mélangeant transport HTTP, règles métier, accès base, appels externes, publication d'événements, WebSockets, rendu.

## ARCH-09 — Pas de fichiers dépotoirs

`utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `manager.ts`, `shared.ts` sont interdits par défaut. Préférer des noms précis : `proration-calculation.ts`, `deployment-transitions.ts`, `subscription-dates.ts`.

## ARCH-10 — Pas de fragmentation excessive

Ne pas créer automatiquement : un fichier pour une constante utilisée une fois, un fichier de types pour un type trivial, une classe pour une fonction simple, un dossier d'un seul fichier, un `index.ts` masquant inutilement les imports. L'objectif est la lisibilité, pas le nombre de fichiers.

## ARCH-11 — API publique par module

Un module expose ses fonctions publiques via son fichier d'entrée. Les autres modules NE DOIVENT PAS importer ses détails internes.

```ts
// Interdit
import { updateDeploymentRow } from "../deployments/internal/sql";
// Correct
import { deploymentService } from "../deployments";
```

## ARCH-12 — Dépendances circulaires

Interdites entre modules. En cas de cycle : vérifier la répartition des responsabilités, extraire un contrat commun, utiliser un événement si le découplage est justifié, ou remonter l'orchestration dans un service applicatif. NE PAS utiliser l'event bus pour masquer un cycle.

## ARCH-13 — Plusieurs frontends, un backend

- Le backend reste l'autorité pour règles métier, permissions, isolation, transitions, calculs, persistance. Les frontends adaptent présentation, navigation, libellés, ordre des étapes — jamais les règles (G-11). Un frontend PEUT anticiper une règle pour l'UX ; le backend la revérifie toujours.
- NE JAMAIS coupler le backend à une interface : pas de `if (frontend === "admin")` dans la logique métier. Une différence de droit = une permission ; une différence de contrat nécessaire = endpoint, projection ou use case spécifique, voire BFF justifié.
- L'identité de l'application consommatrice PEUT servir à la télémétrie, aux limites d'utilisation, aux feature flags, aux politiques OAuth. Elle ne remplace JAMAIS l'identité de l'utilisateur ni ses permissions, et NE DOIT PAS être déduite d'un header libre, de l'origine ou du User-Agent pour décider un droit.
- Partager uniquement les contrats réellement communs et stables (identifiants, erreurs, pagination, permissions, événements WS publics, DTO, value objects simples). NE PAS créer un package partagé géant contenant pages, stores et logique de chaque app.
- Client API : chaque frontend parle au backend via un **client API** — un package du monorepo, pas une app : des fonctions typées (`api.projects.list()`) encapsulant appels HTTP, authentification, sérialisation, erreurs, timeouts, renouvellement de session et correlation IDs (FRONT-08), dérivées des schémas de `contracts` (CTR-05). Défaut : un seul client partagé (`packages/api-client`). Ne scinder en clients par app, autour d'un noyau commun, que si les surfaces API divergent réellement.
- BFF : uniquement si orchestration très spécifique, agrégations nombreuses, contraintes de performance ou de versionnement réellement différentes. Un BFF ne duplique JAMAIS les règles métier.
- Compatibilité : ne jamais supposer que backend et tous les frontends (y compris mobiles anciens) se déploient au même instant. Voir `evolution.md`.

## ARCH-14 — Frontières imposées par l'outillage (G-15)

- Les frontières de modules (ARCH-11) et l'absence de cycles (ARCH-12) DOIVENT être vérifiées par `dependency-cruiser` ou `eslint-plugin-boundaries`, en CI bloquante.
- Le code mort DEVRAIT être détecté par `knip` (ou équivalent).
- Les conventions de nommage de fichiers DEVRAIENT être vérifiées par lint (ex. `eslint-plugin-unicorn/filename-case`).
- Une règle en prose se viole silencieusement ; une erreur de lint, non. Toute nouvelle convention vérifiable DOIT être ajoutée à l'outillage en même temps qu'au référentiel.
