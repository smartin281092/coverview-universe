# Production CoverView — runbook

Mise en ligne du comparateur : [deploy-comparator](../../roadmap/plans/deploy-comparator.plan.md). Mise en production complète du 16 octobre 2026 (commandes horizon3, comptes, emails, Wallet, Partner et Admin) : [deploy-full](../../roadmap/plans/deploy-full-2026-10-16.plan.md). Hébergement : [hosting.md](../../docs/hosting.md).

## Cible

- Serveur `cv-staging-01` (`179.237.74.21`), accès `ssh -i ~/.ssh/cv-workload-admin-2026-07.pem ubuntu@179.237.74.21`, commandes Docker en `sudo`.
- Pile Compose `coverview-astra` dans `/opt/coverview-astra`.
  - `compose.yml`, `www.Caddyfile` et `apps.Caddyfile` de ce dossier, copiés depuis la version déployée. Le Caddyfile du site est monté : retirer la redirection temporaire de `/` ne demande pas de nouvelle image.
  - `.env` (réglages, [.env.example](.env.example)) et `api.env` (secrets de l’API, [api.env.example](api.env.example)), mode 0600 tous deux.
- Routage par le Traefik de Coolify (`coolify-proxy`, réseau `coolify`, résolveur `letsencrypt`). Coolify ne gère pas cette pile.
- Images `ghcr.io/smartin281092/coverview-astra-api`, `-www` et `-apps`, étiquetées par le commit (`RELEASE`), construites sur le serveur depuis `git archive` du commit.

| Adresse | Service |
|---|---|
| `coverview.ch` | `www` : `/` → 302 vers `/comparateur-assurance-maladie-2027` (temporaire) |
| `api.coverview.ch` | `api` : routes publiques santé et commandes horizon3 ; comptes si `AUTH_ENABLED=true` ; emails dès que `RESEND_API_KEY` est dans `api.env` ; documents désactivés |
| `wallet.`, `partner.`, `admin.coverview.ch` | `apps` si `COMPOSE_PROFILES=apps`, sinon `www` → 302 vers `https://coverview.ch/` |
| anciens sous-domaines (`intelligence.`, préproduction) | `www` → 302 vers `https://coverview.ch/` |

## Construire une version

Depuis la racine du dépôt, `<sha>` = commit court :

```bash
git archive --format=tar.gz -o release.tar.gz <sha>
scp -i ~/.ssh/cv-workload-admin-2026-07.pem release.tar.gz ubuntu@179.237.74.21:/tmp/coverview-astra-<sha>.tar.gz
```

Sur le serveur, dans un répertoire temporaire où l’archive est décompressée :

```bash
sudo docker build -f deploy/docker/api.Dockerfile -t ghcr.io/smartin281092/coverview-astra-api:<sha> .
sudo docker build -f deploy/docker/apps.Dockerfile --build-arg VITE_API_URL=https://api.coverview.ch -t ghcr.io/smartin281092/coverview-astra-apps:<sha> .
sudo docker build -f deploy/docker/www.Dockerfile --build-arg PUBLIC_API_URL=https://api.coverview.ch -t ghcr.io/smartin281092/coverview-astra-www:<sha> .
```

Comptes ouverts, le site est construit avec les demandes et les liens de Wallet : ajouter `--build-arg PUBLIC_REQUESTS_ENABLED=true --build-arg PUBLIC_WALLET_URL=https://wallet.coverview.ch`.

## Secrets

Jamais affichés, jamais versionnés (G-04) ; `api.env` est lu par l’API seule.

- **Session** : générée sur le serveur.

```bash
echo "AUTH_SESSION_SECRET=$(openssl rand -base64 32)" | sudo tee -a /opt/coverview-astra/api.env >/dev/null
```

- **Clés de fournisseurs** (WorkOS production, Resend) : saisies par le titulaire du compte, à l’invite masquée, une clé par commande.

```bash
ssh -t -i ~/.ssh/cv-workload-admin-2026-07.pem ubuntu@179.237.74.21 'read -rsp "Nom de la clé : " k && echo && read -rsp "Valeur : " v && echo && echo "$k=$v" | sudo tee -a /opt/coverview-astra/api.env >/dev/null && sudo chmod 600 /opt/coverview-astra/api.env && echo "enregistrée"'
```

Clés attendues : `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `RESEND_API_KEY`. Une clé modifiée se remplace en éditant `api.env` ; `docker compose up -d` relance l’API avec les nouvelles valeurs.

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
- Pré-vol de `https://api.coverview.ch/api/public/h3/contact` depuis `https://horizon3.finance` : 204 avec cette origine.
- Un ancien sous-domaine répond 302 vers `https://coverview.ch/`.
- HSTS présent ; parcours du comparateur dans un navigateur : localité, comparaison, fiche d’un modèle.

## Ouvrir les comptes et les surfaces

Quand `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` et `AUTH_SESSION_SECRET` sont dans `api.env` :

1. WorkOS (environnement Production) : redirection `https://api.coverview.ch/auth/callback` ; Authenticator actif ; emails Magic Auth envoyés par WorkOS.
2. `.env` : `AUTH_ENABLED=true` et `COMPOSE_PROFILES=apps` ; site reconstruit avec les demandes ; `sudo docker compose up -d`.
3. Contrôles : connexion depuis Wallet, Partner et Admin ; retour sur chaque surface ; `https://api.coverview.ch/health` prêt.
4. Premier administrateur : après sa première connexion, attribution explicite et tracée de `administration.access` ([procédure](../../apps/api/src/modules/identity/README.md#procédure-opérateur-dhabilitation-administrative)), puis Authenticator inscrit par le titulaire depuis `/authenticator`.

## Retour arrière

1. Surfaces : retirer `COMPOSE_PROFILES=apps` de `.env`, puis `sudo docker compose up -d` et `sudo docker compose rm -sf apps` ; les routes fermées reprennent. Comptes : `AUTH_ENABLED=false`.
2. Version : `RELEASE=<version précédente>` dans `.env`, puis `sudo docker compose up -d`. Les migrations sont additives : la base reste lisible par la version précédente.
3. Ancien produit : `cd /opt/coverview-astra && sudo docker compose down` (volumes conservés, pas de `-v`), puis `sudo docker start` des anciens conteneurs listés au [journal de mise en ligne](../../roadmap/plans/deploy-comparator.plan.md#journal-de-vérification). Traefik reprend leurs routes dès leur démarrage.
4. Données : sauvegardes dans `/var/backups/coverview-astra` et chiffrées hors fournisseur ; celles de l’ancien produit dans `/var/backups/coverview-legacy`.
