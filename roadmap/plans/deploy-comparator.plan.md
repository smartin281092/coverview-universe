# Plan — Mise en ligne du comparateur maladie sur coverview.ch

> Statut : **approuvé** — réponses de l'utilisateur du 6 octobre 2026 : publier le projet sur le serveur qui héberge coverview.ch ; en attendant, `https://coverview.ch/` donne sur le comparateur maladie. Réponses aux questions bloquantes ci-dessous.
> **Session requise et réelle** : Claude Code, Claude Opus 5.5, effort max.

## Décisions (questions bloquantes)

1. **Ancien CoverView** : le remplacer. Les conteneurs de production et de préproduction de l'ancien produit sont arrêtés. Leurs bases et volumes sont sauvegardés et conservés ; rien n'est supprimé. Aucun changement DNS.
2. **Périmètre public** : comparateur seul. Wallet, Partner et Admin restent fermés jusqu'à la recette (phase B). La connexion et la demande d'offre par email sont masquées tant que WorkOS production et un fournisseur d'email ne sont pas branchés.
3. **Méthode** : images publiées sur GHCR, pile Docker décrite dans le dépôt et lancée par SSH, routée par le Traefik existant de Coolify. Coolify ne gère pas ces conteneurs.

Ces décisions lèvent, pour ce serveur seulement, la protection HOST-01 de l'ancien CoverView. Elles sont consignées dans [hosting.md](../../docs/hosting.md).

## Inventaire en lecture seule (6 octobre 2026)

- **DNS**
  - `coverview.ch` et 11 sous-domaines (production et préproduction de l'ancien produit) pointent vers `179.237.74.21`.
  - Les DNS sont chez Infomaniak ; le MX va chez Google (à préserver).
  - `www.coverview.ch` n'existe pas.
- **Serveur `cv-staging-01`** : x86_64, 4 vCPU, 8 Go de RAM (≈ 6,8 Go disponibles), 40 Go libres, Docker 29, Compose v5.
  - Proxy `coolify-proxy` (Traefik 3.6) : entrées `http` et `https`, résolveur `letsencrypt`, fournisseur Docker avec `exposedbydefault=false`, réseau `coolify`.
  - Ancien CoverView : 7 conteneurs en production (`*-p125448v56ieyt400tfkk70p`) et 7 en préproduction (`*-nvp5fuo6dnfni2c027ww9hcj`), dont une base PostgreSQL chacun ; politique `unless-stopped`.
- **Surveillance de l'ancien produit** sur `cv-control-01` : elle sonde `admin.coverview.ch` et alertera après la bascule. Hors de ce plan, à décider avec l'utilisateur.

## Cible

| Adresse | Service | Comportement |
|---|---|---|
| `https://coverview.ch/` | `www` (Caddy, build statique Astro) | `/` → 302 vers `/comparateur-assurance-maladie-2027` ; reste du site public servi |
| `https://api.coverview.ch` | `api` (Fastify) | routes publiques santé ; authentification, documents, travaux de fond et email désactivés |
| anciens `admin.`, `wallet.`, `partner.`, `intelligence.` et toute la préproduction `staging.*` | Traefik | 302 vers `https://coverview.ch/` |

- Pile `coverview-astra` dans `/opt/coverview-astra` : `postgres` (18), `redis` (8, sans persistance), `api`, `www`. Réseau interne privé ; seuls `api` et `www` rejoignent `coolify`.
- **Secrets** : générés sur le serveur dans `/opt/coverview-astra/.env` (mode 0600), jamais affichés ni versionnés (G-04).
- **Migrations** : nouvelle commande de production `node dist/migrate.js`. Elle refuse de s'exécuter sans `MIGRATIONS_APPROVED` égal au nombre exact de migrations attendues. La garde locale `assertLocalDatabase` reste intacte.
- **Données santé** : tables `health_*` publiques, importées et vérifiées par la voie officielle dans la base locale, transférées en données seules. Les tables de recommandation liées à des utilisateurs sont vides et exclues.

## Séquence

1. Code : drapeau `PUBLIC_REQUESTS_ENABLED`, commande de migration de production, images API et www, pile Compose, Caddyfile, runbook. Typecheck, tests ciblés, builds.
2. Répétition locale de la pile complète, avec contrôle du comparateur dans un vrai navigateur.
3. Images poussées sur GHCR (tag = commit).
4. Serveur :
   - sauvegardes `pg_dump` des deux anciennes bases, copie chiffrée `age` hors fournisseur ;
   - préparation de la pile (base, Redis, migrations, données santé) sans routage ;
   - arrêt des 14 anciens conteneurs ;
   - démarrage de `api` et `www` avec leurs routes.
5. Contrôles publics : TLS et HSTS, redirections, `/health`, parcours du comparateur dans un navigateur.

**Retour arrière** : `docker compose down` (volumes conservés), puis `docker start` des 14 anciens conteneurs ; Traefik reprend leurs routes. Procédure exacte dans [le runbook](../../deploy/production/README.md).

## Hors périmètre

- Wallet, Partner et Admin en production ; fournisseur d'email ; WorkOS production.
- Stockage objet, ClamAV, LLM et travaux de fond.
- Suppression des anciens volumes ; changement DNS ; nouveau serveur.

## Journal de vérification

| # | Cible | Oracle | Observé | Décision |
|---|---|---|---|---|
