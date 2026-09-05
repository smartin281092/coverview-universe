# Initialisation d'un projet — « Start project »

> **Résumé** : procédure unique d'amorçage. Interview bornée (5 blocs, ~16 décisions, **zéro réponse obligatoire** — tout a un défaut), production de PROJECT.md + ADR fondateurs + roadmap, puis plans S-000a/b/c (walking skeleton) soumis à validation avant la moindre ligne de code.

## BOOT-01 — Déclencheur et idempotence

`PROJECT.md` absent à la racine ⇒ projet non initialisé ⇒ dérouler cette procédure **intégralement** avant tout autre travail. Si `PROJECT.md` existe : NE PAS relancer l'interview — proposer une revue de roadmap (PROG-11) ou traiter la demande normalement.

Si l'utilisateur demande de préparer le harness et la bible avant de travailler la roadmap, appliquer le mode documentaire BOOT-10. Une réponse déjà donnée ou présente sans ambiguïté dans la référence désignée n'est pas redemandée.

## BOOT-02 — Interview bornée (la vitesse d'abord)

- **5 blocs, ~16 décisions, en 2 messages maximum.** Le chiffre qui compte n'est pas le nombre de questions mais le nombre de réponses **obligatoires** : zéro. Tout porte un défaut, « défauts » accepte un bloc entier, et un bootstrap intégralement par défaut est un chemin nominal — pas un raccourci.
- Chaque bloc affiche ses **défauts pré-remplis** ; l'utilisateur ne détaille que ce qui dévie.
- Ne PAS demander à l'amorçage ce qui n'est pas une décision de jour 1 : ce sont des slices, pas des questions. Sont explicitement hors interview — SSO d'entreprise (AUTH-09), cible de déploiement alternative, noms de domaine définitifs. Ils se décident quand la slice qui les porte arrive, avec les informations qui manquent aujourd'hui.
- La stack n'est PAS une question : elle est imposée (§0 de CLAUDE.md). Une dérogation n'arrive que sur demande explicite ⇒ ADR.
- Toute inconnue restante après l'interview devient une hypothèse **explicite** dans PROJECT.md — jamais un choix implicite (G-01).

**Blocs :**

1. **Produit** — nom, problème résolu, personas ; apps à activer (défaut : `api + client + admin + www` — `client` est l'application cliente authentifiée, `www` le site public) ; apps frontend additionnelles éventuelles (ex. portail tiers, app mobile), nommées ici — mêmes règles pour toutes (ARCH-13) ; langues (défaut : français, i18n prêt dès le jour 1).
2. **Données et tenancy** — suivre les espaces métier et les droits décrits dans la bible ; distinguer comptes personnels, foyers, conseillers et organisations professionnelles ; ne pas imposer des organisations B2B à un produit B2C. Résidence des données uniquement si une contrainte est connue (LLM-06).
3. **Authentification** — fournisseur CoverView défini dans AUTH-11 ; reprendre les parcours de connexion de la bible, vérifier leur configuration réelle à la slice d'intégration. MFA des comptes à privilèges : AUTH-08.
4. **Périmètre v1** — 3 à 5 parcours utilisateur ; paiements Stripe (oui/non — `billing.md`) et, si oui, les plans de départ avec leurs entitlements, sans les prix (`catalog.md`) ; fonctionnalités IA (oui/non — `llm.md`) ; hors-périmètre v1 explicite.
5. **Déploiement et dépôt** — cible et domaine déjà fixés pour CoverView : HOST-01 ; dépôt distant : PROJECT.md. Le fournisseur d'email sera choisi au plan concerné ; Mailpit en local. Ne pas redemander les informations déjà fournies.

## BOOT-03 — Sorties, dans l'ordre

0. **Git** (BOOT-07) : si `.git` est absent — `git init -b main`, `.gitignore` complet, commit initial du harness. Chaque sortie suivante est ensuite committée.
1. `PROJECT.md` depuis `templates/PROJECT.md` — identité produit, décisions, hypothèses.
2. ADR fondateurs : `ADR-0001` depuis **`templates/adr-0001.md`** — instanciation du harness, dérogations stack éventuelles, version du harness (BOOT-08) et forme dégradée retenue pour chaque invariant du profil minimal. Le gabarit porte déjà les huit lignes **pré-remplies** : l'ADR est une signature, pas une rédaction, et `harness-reference.md` n'a pas à être chargé pour l'écrire. Puis `ADR-0002` (tenancy) et `ADR-0003` (authentification) depuis `templates/adr.md`.
3. `ROADMAP.md` + `roadmap/backlog.yaml` : jalon M0 = `S-000a`, `S-000b`, `S-000c` (BOOT-04), puis `S-001…` dérivées des parcours v1 avec dépendances explicites (PROG-05).
4. `MEMORY.md` initialisé depuis `templates/MEMORY.md`.
5. `roadmap/plans/S-000a.plan.md` depuis `templates/slice.plan.md` ⇒ soumis ⇒ **GATE : attendre « GO S-000a »** (G-17). Aucun code, aucun scaffold avant. `S-000b` et `S-000c` sont planifiées à la fin de la précédente, contexte chaud (PROG-08).

## BOOT-04 — Walking skeleton : trois slices, pas une

Critère de fin du jalon (ARCH-02) : *un utilisateur crée un compte, se connecte, voit une page protégée, sur une URL déployée*. Il est atteint par `S-000a + b + c`.

**Pourquoi trois.** En une seule slice, l'amorçage produit plusieurs milliers de lignes derrière un seul « GO » — ce qui contredit DEL-02 (PR à sujet unique, ~400 lignes), rend le budget PROG-14 inapplicable dès la première slice, et place l'unique point de contrôle humain après tout le travail. Trois gates valent mieux qu'un gate illusoire.

### S-000a — Socle outillé (aucune fonctionnalité)

- Copie de `templates/scaffold/` (BOOT-09), puis ajustement : c'est du fichier, pas de la génération.
- Monorepo ARCH-06 : pnpm workspaces + Turborepo, TypeScript strict, ESLint + Prettier, dependency-cruiser + knip câblés (`pnpm boundaries`), CI GitHub Actions (DEL-04).
- `docker-compose.yml` **à la racine** : postgres, redis, minio, mailpit — pour que `docker compose up -d` (§0bis, ENV-01) fonctionne sans `-f`, et pour que le nom de projet Docker soit celui du dépôt et non `infra` (collision entre produits). `infra/` ne porte que le déploiement (ARCH-06).
- `.env.example` exhaustif + validation d'environnement au démarrage (BACK-07, ENV-02), **dont `APP_ENV=local`** — sans quoi `/preview` refuse de démarrer (ENV-08).
- Drizzle : migration 0 du modèle applicatif validé (identités externes, espaces et appartenances selon ADR-0002/0003 ; aucun schéma de mots de passe local) ; seeds par persona (ENV-03/09) exportant le module `personas` de la matrice ENV-07 ; `preview.config.mjs` complété (ports réels, chemin du module de personas) ; `.preview/` dans le `.gitignore`.
- **Oracle de fin** : `pnpm install && pnpm lint && pnpm typecheck && pnpm build` passe, `docker compose up -d` démarre les quatre services, `pnpm db:migrate && pnpm db:seed` est rejouable (V1/V2). Aucune UI à regarder : cette slice se clôt sans `/preview`.

### S-000b — Parcours d'authentification réel

- `apps/api` : Fastify + Zod, health checks (OBS-04), WorkOS intégré selon AUTH-11 et le bloc 3, première route protégée.
- `apps/client` : inscription, connexion, déconnexion, page protégée « dashboard » vide.
- `apps/admin` : connexion (MFA si défaut conservé), page protégée vide.
- UI : shadcn/ui initialisé via le preset imposé (DSN-01) dans `client` et `admin` ; primitives d'états partagées (chargement, vide, erreur — DSN-03).
- `apps/www` : Astro — page d'accueil minimale, `robots.txt`, `sitemap.xml`, `llms.txt` (GEO-03), 404 propre.
- **Oracle de fin** : `/preview`, puis parcours réel en local avec les personas — dont `outsider`, qui ne doit rien voir d'une autre organisation (V3/V5).

### S-000c — Mise en ligne

- Déploiement : Dockerfiles, compose de production, Caddy (TLS), pipeline vers la cible du bloc 5 ; compléter uniquement les détails encore ouverts selon HOST-01/03, le domaine principal étant déjà fixé.
- Dépôt : premier push vers le remote après confirmation (ENV-06) — la CI s'exécute dès ce push.
- **Oracle de fin** : le critère ARCH-02 complet, exécuté sur l'URL déployée (V3/V5).

### Ce que le walking skeleton NE contient PAS

Ni gateway temps réel, ni adapter de stockage objet. Les monter « sans événement métier encore » et « sans usage métier encore » est exactement ce qu'ARCH-04 interdit : construire pour un besoin hypothétique. Ils arrivent avec la **première slice qui en a besoin**, où leur configuration sera décidée par un usage réel plutôt que devinée. Socket.IO reste la brique imposée par §0 le jour où le besoin existe — et RT-01 rappelle qu'un flux unidirectionnel relève de SSE, pas d'une gateway.

Les apps activées non essentielles au parcours (`admin`, `www`) restent des **coquilles fonctionnelles** : l'infrastructure existe, la chair vient par slices.

## BOOT-05 — Versions

Installer les **dernières versions stables** au moment de l'initialisation. Ne jamais inscrire de numéros de version dans la documentation du harness. En cas de doute sur une API récente d'une dépendance : consulter sa documentation officielle, ne pas se fier à la mémoire du modèle.

## BOOT-06 — Après S-000

Tout travail suivant passe par `program.md` : slice `ready` → plan → GO → exécution → livraison avec ledger. À la fin de `S-000c`, proposer les 2-3 prochaines slices du backlog avec leur ordre recommandé.

## BOOT-07 — Git dès la première seconde

Le harness ne suppose jamais qu'un dépôt existe : il le crée.

- Si `.git` est absent : `git init -b main`. Jamais de travail hors versionnement.
- `.gitignore` DOIT être écrit **avant toute installation ou génération** — il est livré, ne pas le réécrire : `cp templates/scaffold/gitignore .gitignore` (BOOT-09). `node_modules` ou un `.env` committé est une non-conformité immédiate (G-04).
- Commit initial du harness (`chore: initialise le harness`), puis un commit par sortie du bootstrap (PROJECT.md, ADR, roadmap, plan S-000a) — l'historique raconte l'amorçage.
- Remote : si une URL a été fournie (bloc 5), la configurer ; le **premier push est soumis à confirmation** (ENV-06). Sans remote, le signaler : la CI GitHub Actions et le déploiement resteront inactifs jusqu'à sa création.
- Ensuite, la vie du dépôt suit `delivery.md` : commits conventionnels atomiques (DEL-01), état committé en fin de chaque slice, jamais de force push (G-05).

## BOOT-08 — Le harness a une version, et le projet s'en souvient

Le harness est **copié** dans chaque projet. Sans marqueur, chaque copie devient un fork silencieux : impossible de savoir avec quelle version un produit a été amorcé, ni où une correction a déjà été portée. Pour qui construit plusieurs produits sur le même socle, c'est le défaut qui coûte le plus cher à six mois — et il contredit le postulat du harness (le modèle se périme, le harness est l'actif durable).

- Le fichier `HARNESS_VERSION` à la racine porte la version (semver) et **est copié tel quel** dans le projet.
- `ADR-0001` enregistre cette version à l'amorçage. C'est la seule trace horodatée du point de départ.
- Une évolution du référentiel incrémente `HARNESS_VERSION` et ajoute son entrée à `CHANGELOG.md`, avec les **identifiants de règles** touchés — c'est ce qui rend la mise à jour d'un projet lisible.
- La mise à niveau d'un projet existant se fait par `/harness-upgrade` : comparaison de version, lecture du changelog, application règle par règle. JAMAIS une copie en masse par-dessus le référentiel local, qui écraserait les dérogations décidées en ADR.

## BOOT-09 — Ce qui est livré ne se régénère pas

`templates/scaffold/` contient les fichiers de configuration que le harness **impose** par ailleurs (CI, frontières, compose, tsconfig, lint, workspace). Ils sont copiés, puis ajustés — jamais réécrits de mémoire.

C'est HRN-P-001 appliqué au bootstrap : *tout ce qui peut être déterministe sort du prompt et entre dans le code*. Régénérer une CI à chaque projet produit une CI différente à chaque projet, et fait de `pnpm boundaries` une commande documentée qui n'existe que si le modèle a pensé à la câbler.

Ce qui reste au modèle : le contenu propre au produit (noms, ports, variables réelles, services du compose) et l'installation des dépendances aux **dernières versions stables** (BOOT-05) — c'est pourquoi aucun fichier livré ne porte de numéro de version.

## BOOT-10 — Préparation documentaire avant roadmap

Pour CoverView, demande explicite du 2026-09-05 : initialiser le harness et analyser la bible, puis annoncer être prêt à travailler la roadmap et les prompts. Ce mode produit Git, PROJECT, ADR, MEMORY, index/extraction/inventaire de référence, cadre ROADMAP/backlog et gabarit de prompt. Il ne copie pas le scaffold, n'installe pas l'application et ne lance pas S-000a.

Les jalons et futurs IDs de slices sont des propositions à préciser à l'étape de planification ; aucun plan d'exécution n'est réputé approuvé par la préparation. La présence de PROJECT signifie ici « cadrage initialisé », avec état applicatif explicitement **non implémenté**. Les inconnues métier sont inventoriées et réservées aux slices qu'elles bloquent ; elles ne bloquent pas la lecture des références ni l'adaptation autorisée du harness.

La bible est la référence métier maître selon DOC-16. La préparation complète est tracée dans `roadmap/plans/INIT-harness.plan.md` et `roadmap/initialisation.md`.
