# `templates/scaffold/` — la partie déterministe du bootstrap (BOOT-09)

Le harness **impose** une CI, des frontières de modules vérifiées, TypeScript strict, une infra locale et un `.gitignore` écrit avant toute installation. Il ne les livrait pas : le modèle les régénérait à chaque projet. Trois conséquences, toutes mauvaises — deux bootstraps produisent deux CI différentes ; S-000 paie le coût le plus élevé pour le contenu le plus identique d'un projet à l'autre ; et `pnpm boundaries`, documenté en `CLAUDE.md` §0bis, n'existe que si le modèle a pensé à câbler dependency-cruiser *et* knip *et* le script.

HRN-P-001 : *tout ce qui peut être déterministe sort du prompt et entre dans le code.* Ces fichiers sont du code.

## Copie (S-000a)

Les noms sont volontairement **sans point** : un `.gitignore` réel dans ce dossier s'appliquerait au harness lui-même, et les fichiers masqués se perdent aux copies.

| Source | Destination |
|---|---|
| `gitignore` | `.gitignore` |
| `env.example` | `.env.example` |
| `prettierrc.json` | `.prettierrc.json` |
| `dependency-cruiser.cjs` | `.dependency-cruiser.cjs` |
| `ci.yml` | `.github/workflows/ci.yml` |
| `package.json` · `pnpm-workspace.yaml` · `turbo.json` · `tsconfig.base.json` · `eslint.config.mjs` · `knip.json` · `docker-compose.yml` | racine, même nom |

```bash
cp templates/scaffold/gitignore .gitignore          # AVANT tout pnpm install (BOOT-07)
cp templates/scaffold/env.example .env.example
cp templates/scaffold/prettierrc.json .prettierrc.json
cp templates/scaffold/dependency-cruiser.cjs .dependency-cruiser.cjs
mkdir -p .github/workflows && cp templates/scaffold/ci.yml .github/workflows/ci.yml
cp templates/scaffold/{package.json,pnpm-workspace.yaml,turbo.json,tsconfig.base.json,eslint.config.mjs,knip.json,docker-compose.yml} .
```

## Ce qui reste à faire après la copie

Ces fichiers sont un **socle**, pas un livrable fini. À ajuster à S-000a :

- `package.json` : `name`, et **installer les dépendances** — aucune n'est déclarée ici, pas plus que `packageManager` ni `engines`. C'est délibéré : BOOT-05 impose les dernières versions stables au moment de l'amorçage, donc aucun numéro de version ne doit dormir dans le harness. `corepack use pnpm@latest` écrit `packageManager` à la bonne valeur ; `pnpm add -w -D typescript turbo eslint prettier dependency-cruiser knip vitest …` pose le reste, puis les dépendances applicatives dans leurs apps.
- `db:seed` et `db:reset` délèguent à `apps/api`, qui les implémente. `db:reset` **DOIT refuser de s'exécuter hors local** (ENV-05, G-05) : c'est un effacement, pas une commande de confort — le garde vit dans le script, pas dans la prose.
- `docker-compose.yml` : mots de passe locaux, ports si conflit, version majeure de PostgreSQL **identique à la production** (TEST-06).
- `env.example` : compléter au fil des slices. Le schéma de validation au démarrage (BACK-07) reste la référence, `.env.example` le suit (ENV-02).
- `ci.yml` : le job de dérive catalogue ↔ Stripe (CAT-08) n'est activé que si le projet a du billing.
- `eslint.config.mjs` : la règle anti-chaînes littérales dans le JSX (INTL-08) est présente mais **désactivée** — l'activer quand l'i18n est câblée, pas avant, sinon elle crie sur un projet vide.

## Ce que ces fichiers ne sont pas

**Non vérifiés à l'exécution.** Ils sont syntaxiquement valides et cohérents avec les règles qu'ils appliquent, mais aucun `pnpm install` n'a été lancé dessus dans le harness — il n'y a pas de dépendances à installer avant qu'un projet existe. Le premier `pnpm install && pnpm lint` de S-000a est leur premier oracle réel (V1), et c'est précisément le critère de fin de cette slice.
