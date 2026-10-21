# Documents en production — 21 octobre 2026

Entrée : réponse de l’utilisateur du 21 octobre 2026 à la question bloquante de la livraison Wallet ([plan](wallet-requests-2026-10-20.plan.md)) : « a) ouvre les documents en production ». L’option a) disait : stockage chiffré et antivirus préparés sur le serveur, clé OpenAI saisie par le titulaire. Puis : « donne moi la procédure pour mettre la clé dans le .env du serveur si tu ne peux pas le faire toi-même étant donné qu’elle y est déjà ici en local ». Mandat PROG-23. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Question bloquante (PROG-15)

| ref | question | réponse |
|---|---|---|
| Q-1 | LLM-06 : le DPA (accord de traitement des données) d’OpenAI couvre-t-il l’organisation de la clé ? a) oui, la lecture automatique s’active avec les documents ; b) pas encore, documents ouverts sans lecture automatique : l’option de lecture doit alors disparaître de Wallet (G-06), changement à faire | en attente |

La clé peut être copiée sur le serveur avant la réponse : rien ne part chez OpenAI tant que les documents restent fermés.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| D-1 | Stockage ? | MinIO sur `cv-staging-01` (« sur le serveur »), réseau interne de la pile, ni console ni port publié. MinIO ne publie plus d’image (Docker Hub et quay.io refusés, journal 2) : build Chainguard depuis les sources, maintenu, épinglé par digest (MinIO AGPLv3, service séparé non modifié, signalé DEP-01). Bucket `coverview-documents` créé une fois ; utilisateur API dédié limité à ce bucket. Les originaux sont chiffrés AES-256-GCM par l’API avant stockage. | HOST-02 : aucune ressource cloud facturée sans décision |
| D-2 | Contrôle ACL ? | MinIO n’implémente pas les ACL : sa réponse est un stub privé. Il est accepté quand l’opérateur déclare `DOCUMENT_S3_MINIO=true`. La confidentialité repose sur l’absence de politique de bucket (contrôlée), sur des identifiants dédiés et sur le réseau privé. Un vrai fournisseur S3 reste soumis au contrôle strict, sa réponse n’ayant pas la forme du stub. | `file-storage.ts`, tests unitaires |
| D-3 | Antivirus ? | ClamAV, même digest qu’en local. Réseau interne, plus une sortie pour les signatures (freshclam). 2 Go de mémoire et 1 CPU au plus. | 7,8 Go de RAM, 6,3 Go disponibles |
| D-4 | Clé de chiffrement ? | Générée sur le serveur, jamais affichée. Copie de secours chiffrée age pour le titulaire, hors serveur : sans elle, les originaux sont illisibles. | README document-intelligence |
| D-5 | Activation ? | Profil compose `documents` et `DOCUMENTS_ENABLED` dans `.env`. Retour arrière : remettre `false`, les originaux restent dans leur volume. | — |
| D-6 | Sauvegarde des originaux ? | Archive du volume MinIO avec la sauvegarde de la base avant chaque migration, copie chiffrée age hors serveur. | runbook |
| D-7 | Partner ? | Le même circuit ouvre aussi les justificatifs et sources d’offres Partner, conçus pour lui. | `registerPartnerWorkspace` |
| D-8 | Coût des lectures ? | Défaut de production : 3 lectures par compte sur 24 h glissantes, modèle par défaut. | `document.config.ts` |

## Definition of Done — oracles

- [x] Décision ACL testée — V2 (journal 1).
- [x] Pile valide (`docker compose config`), services sains, bucket privé sans versioning, utilisateur API limité — V3 serveur (journal 4–7).
- [ ] API démarrée avec les documents ; routes documentaires présentes (401 sans session) — V3.
- [ ] Dépôt d’une pièce et d’un contrat depuis Wallet — V5 du titulaire.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Décision ACL | `file-storage.test.ts`, `tsc`, ESLint, knip | 3 nouveaux tests verts (28 avec la configuration) ; knip inchangé (7 fichiers et un doublon préexistants) | — |
| 2 | Serveur, premier essai (a9a2436) | `docker compose up -d` | sauvegarde faite (19 355 218 octets), secrets générés sans affichage ; `minio/minio` refusé au téléchargement, aucun conteneur modifié ; `.env` et `compose.yml` restaurés, production saine | image Chainguard |
| 3 | MinIO Chainguard | conteneur local jetable, `mc` de l’image, adaptateur réel de l’API | volume neuf accepté en non-root ; bucket privé non versionné, utilisateur limité ; mode strict refusé, MinIO déclaré accepté ; relecture chiffrée exacte ; écrasement refusé ; suppression effective ; `mc ready local` vert | serveur |
| 4 | Serveur (edd24c8) | sauvegarde de la base, secrets existants conservés, `docker compose up -d` | 7 services sains ; API, apps et site sur `edd24c8` ; documents toujours fermés | — |
| 5 | Bucket et droits | `mc` de l’image MinIO, puis S3 avec les identifiants de l’API depuis un conteneur API jetable | bucket privé, sans politique, non versionné ; ACL = stub MinIO ; écriture, relecture et suppression permises ; écrasement refusé (`PreconditionFailed`) ; création de bucket refusée ; liste réduite au seul bucket autorisé | — |
| 6 | Clé de chiffrement | copie `age` hors serveur, empreintes comparées | `document-storage-key-20261021.age` (245 octets), empreinte identique à celle du serveur | — |
| 7 | ClamAV et production | journaux, `/health`, Wallet, site | clamd démarré, signatures du jour (daily 28160) ; API sans erreur ; 200 partout | activation après Q-1 |
| 8 | Compose local, même image | conteneur jetable, volume anonyme | console servie sur `:9001` (page « MinIO Console », connexion racine acceptée) ; `mc ready local` vert ; utilisateur 65532 ; `/data` de l’image en 0777, donc volume neuf inscriptible | console et ports conservés |
| 9 | Volume local existant | copie de `coverview-s000b_miniodata` (root, 0755) | sans reprise : `FATAL Unable to write to the backend` ; après `chown -R 65532:65532` : démarrage sain, 16 objets (10 416 393 octets) relus avec des SHA-256 identiques à ceux de l’ancien serveur | reprise unique, README |
| 10 | Bascule locale | archive du volume arrêté (123 entrées), commande `chown` du README, `docker compose up -d --wait minio` | conteneur sain sur l’image Chainguard, même volume, mêmes ports (surcharge locale 19000/19001) ; 16 objets identiques avant et après ; bucket privé non versionné ; console 200 ; API `ready`, aucun avertissement | — |
| 11 | Bucket sur volume neuf | adaptateur réel de l’API contre un MinIO Chainguard vierge | `coverview-documents` créé au premier dépôt, privé, non versionné ; relecture chiffrée exacte ; écrasement refusé ; suppression effective | — |
| 12 | Wallet après bascule | dépôt d’un PDF de test (648 octets) sans lecture IA, profil « Mon profil », navigateur intégré | création et envoi 200 ; document `ready`, aucune analyse ; original relu par l’API (téléchargement 200) avec un SHA-256 identique au fichier ; objet chiffré de 680 octets écrit par MinIO en 65532 ; aucune erreur de stockage dans le journal de l’API | — |
