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
| 1 | Code de mise en ligne | typecheck, tests ciblés (config, serveur, site), astro check, lint | 0 erreur ; 33/33 et 7/7 ; garde de migration refusant hors runtime déployé et sans compte approuvé | Version `695aacd` |
| 2 | Images locales | build Docker sur ce poste | Échec : disque C: plein, le disque virtuel de Docker Desktop ne peut plus grandir et le moteur ne répond plus | Images construites sur le serveur depuis `git archive` (empreinte vérifiée) ; aucun fichier de l'utilisateur supprimé |
| 3 | Anciennes bases | `pg_dump` des deux bases, 100 tables chacune | Production 548 Ko, préproduction 546 Ko, mode 0600 dans `/var/backups/coverview-legacy` ; copies chiffrées `age` sur `D:\CoverViewBackups\legacy` | Déchiffrement non contrôlable sans la clé de l'utilisateur |
| 4 | Données santé | imports officiels dans une base jetable sans réseau, sur le serveur | Identifiants de jeu identiques à la base locale vérifiée (`hi_70e5…` 2026, `hi_eb1e…` 2027, `catalog_fe98…`) ; 437 388 primes | Tables santé seules extraites (18,7 Mo) ; base jetable détruite |
| 5 | Base de production | `migrate.js` sans puis avec approbation ; restauration | Refus sans approbation (code 1) ; 74 migrations ; comptes identiques à l'import | — |
| 6 | Répétition sur le serveur | pile liée à 127.0.0.1, tunnel SSH, navigateur | Tout l'accueil redirigé : le filtre `host` de Caddy compare sans port | `SITE_HOST` et `SITE_ORIGIN` séparés, Caddyfile monté (`875015b`) |
| 7 | Répétition, navigateur | parcours du comparateur, console | Erreur React 418 : `1'000` au build (Node 24.21, ICU 78.3) contre `1 000` dans les navigateurs | Formatage déterministe des franchises (`dcee63d`) ; console vide ensuite |
| 8 | Bascule | arrêt des 14 anciens conteneurs, `compose up` | Site déclaré malade (sonde sans en-tête `Host`, redirigée par Caddy) ; middlewares HTTPS et HSTS portés par lui seul ; **503 public de 10 h 09 à environ 10 h 16** | Sonde avec `Host`, middlewares définis aussi sur l'API ; services sains |
| 9 | Vérification publique | curl et navigateur sur `https://coverview.ch` | `/` → 302 → comparateur 200 ; TLS valide (certificat existant, échéance 14 décembre) ; HSTS et en-têtes ; HTTP → HTTPS 301 ; 10 anciennes adresses → 302 ; CORS limité ; 219 916 primes 2027 ; parcours Neuchâtel, console vide | **En ligne**. Sauvegarde post-lancement 19 Mo |

## État en service

- Images `dcee63d` (API et site). Configuration `compose.yml` du commit de correction de la sonde, copiée dans `/opt/coverview-astra`.
- Anciens conteneurs arrêtés, listés dans `/opt/coverview-astra/legacy-containers.txt` pour le retour arrière.
- Laissés en place, à décider avec l'utilisateur : les dossiers de version `695aacd` et `875015b` dans `/opt/coverview-astra/releases`. Leur suppression récursive exige une confirmation (G-05).
