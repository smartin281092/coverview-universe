# Production CoverView — runbook

Comparateur public sur `coverview.ch`, plan et décisions : [deploy-comparator](../../roadmap/plans/deploy-comparator.plan.md). Hébergement : [hosting.md](../../docs/hosting.md).

## Cible

- Serveur `cv-staging-01` (`179.237.74.21`), accès `ssh -i ~/.ssh/cv-workload-admin-2026-07.pem ubuntu@179.237.74.21`, commandes Docker en `sudo`.
- Pile Compose `coverview-astra` dans `/opt/coverview-astra` : `compose.yml` de ce dossier, plus `.env` (mode 0600, clés de [.env.example](.env.example)).
- Routage par le Traefik de Coolify (`coolify-proxy`, réseau `coolify`, résolveur `letsencrypt`). Coolify ne gère pas cette pile.
- Images `ghcr.io/smartin281092/coverview-astra-api` et `-www`, étiquetées par le commit (`RELEASE`), construites sur le serveur depuis `git archive` du commit.

| Adresse | Service |
|---|---|
| `coverview.ch` | `www` : `/` → 302 vers `/comparateur-assurance-maladie-2027` (temporaire) |
| `api.coverview.ch` | `api` : routes publiques santé ; comptes, documents, travaux de fond et emails désactivés |
| anciens sous-domaines (production et préproduction) | `www` → 302 vers `https://coverview.ch/` |

## Construire une version

Depuis la racine du dépôt, `<sha>` = commit court :

```bash
git archive --format=tar.gz -o release.tar.gz <sha>
scp -i ~/.ssh/cv-workload-admin-2026-07.pem release.tar.gz ubuntu@179.237.74.21:/tmp/coverview-astra-<sha>.tar.gz
```

Sur le serveur, dans un répertoire temporaire où l'archive est décompressée :

```bash
sudo docker build -f deploy/docker/api.Dockerfile -t ghcr.io/smartin281092/coverview-astra-api:<sha> .
sudo docker build -f deploy/docker/www.Dockerfile --build-arg PUBLIC_API_URL=https://api.coverview.ch -t ghcr.io/smartin281092/coverview-astra-www:<sha> .
```

## Base de données

- **Migrations** : `sudo docker compose run --rm -e MIGRATIONS_APPROVED=<nombre> api node dist/migrate.js`.
  - `<nombre>` est le nombre exact de fichiers `apps/api/drizzle/*.sql` de la version ; toute autre valeur est refusée.
  - Commande réservée aux runtimes déployés ; la maintenance locale garde sa garde de boucle locale.
- **Données santé (publiques)** : tables `health_*`, importées et vérifiées par la voie officielle sur une base locale, transférées en données seules :

```bash
pg_dump --data-only -Fc -t 'health_*' -T health_recommendation_commands -T health_recommendation_reviews -T health_recommendation_versions
sudo docker compose exec -T postgres pg_restore -U coverview -d coverview --data-only --disable-triggers --single-transaction < health.dump
```

- **Sauvegarde** avant toute migration : `sudo docker compose exec -T postgres pg_dump -U coverview -d coverview -Fc > /var/backups/coverview-astra/<horodatage>.dump` (mode 0600), copie chiffrée `age` hors fournisseur.

## Mettre en ligne et vérifier

```bash
cd /opt/coverview-astra && sudo docker compose up -d
```

- `https://coverview.ch/` répond 302 vers le comparateur, qui répond 200.
- `https://api.coverview.ch/health` répond `{"status":"ready"}`.
- Un ancien sous-domaine répond 302 vers `https://coverview.ch/`.
- HSTS présent ; parcours du comparateur dans un navigateur : localité, comparaison, fiche d'un modèle.

## Retour arrière

1. `cd /opt/coverview-astra && sudo docker compose down`. Les volumes sont conservés : pas de `-v`.
2. `sudo docker start` des anciens conteneurs listés au [journal de mise en ligne](../../roadmap/plans/deploy-comparator.plan.md#journal-de-vérification). Traefik reprend leurs routes dès leur démarrage.
3. Données : les anciennes bases n'ont pas été modifiées ; leurs sauvegardes sont dans `/var/backups/coverview-legacy` et chiffrées hors fournisseur.
