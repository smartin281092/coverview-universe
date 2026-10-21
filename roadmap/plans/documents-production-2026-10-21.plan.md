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
| D-1 | Stockage ? | MinIO sur `cv-staging-01` (« sur le serveur »), réseau interne de la pile, ni console ni port publié, image et digest du compose local. Bucket `coverview-documents` créé une fois ; utilisateur API dédié limité à ce bucket. Les originaux sont chiffrés AES-256-GCM par l’API avant stockage. | HOST-02 : aucune ressource cloud facturée sans décision |
| D-2 | Contrôle ACL ? | MinIO n’implémente pas les ACL : sa réponse est un stub privé. Il est accepté quand l’opérateur déclare `DOCUMENT_S3_MINIO=true`. La confidentialité repose sur l’absence de politique de bucket (contrôlée), sur des identifiants dédiés et sur le réseau privé. Un vrai fournisseur S3 reste soumis au contrôle strict, sa réponse n’ayant pas la forme du stub. | `file-storage.ts`, tests unitaires |
| D-3 | Antivirus ? | ClamAV, même digest qu’en local. Réseau interne, plus une sortie pour les signatures (freshclam). 2 Go de mémoire et 1 CPU au plus. | 7,8 Go de RAM, 6,3 Go disponibles |
| D-4 | Clé de chiffrement ? | Générée sur le serveur, jamais affichée. Copie de secours chiffrée age pour le titulaire, hors serveur : sans elle, les originaux sont illisibles. | README document-intelligence |
| D-5 | Activation ? | Profil compose `documents` et `DOCUMENTS_ENABLED` dans `.env`. Retour arrière : remettre `false`, les originaux restent dans leur volume. | — |
| D-6 | Sauvegarde des originaux ? | Archive du volume MinIO avec la sauvegarde de la base avant chaque migration, copie chiffrée age hors serveur. | runbook |
| D-7 | Partner ? | Le même circuit ouvre aussi les justificatifs et sources d’offres Partner, conçus pour lui. | `registerPartnerWorkspace` |
| D-8 | Coût des lectures ? | Défaut de production : 3 lectures par compte sur 24 h glissantes, modèle par défaut. | `document.config.ts` |

## Definition of Done — oracles

- [ ] Décision ACL testée — V2.
- [ ] Pile valide (`docker compose config`), services sains, bucket privé sans versioning, utilisateur API limité — V3 serveur.
- [ ] API démarrée avec les documents ; routes documentaires présentes (401 sans session) — V3.
- [ ] Dépôt d’une pièce et d’un contrat depuis Wallet — V5 du titulaire.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
