# Stockage de fichiers

> **Résumé** : Disque local = éphémère uniquement ; S3-compatible par défaut (MinIO en local, même code) ; table files source de vérité ; clés construites côté serveur ; presigned URLs courtes ; cycle de vie aligné RGPD.

## STOR-01 — Local ou objet : la décision

- **Disque local du processus** : UNIQUEMENT pour l'éphémère — fichiers temporaires de traitement, cache reconstructible. NE DOIT JAMAIS stocker un fichier durable d'utilisateur : instances multiples = fichier introuvable ailleurs, conteneurs éphémères = perte au redéploiement, aucun backup.
- **Stockage objet S3-compatible** (S3, R2, GCS, MinIO) : DÉFAUT pour tout fichier durable — uploads utilisateurs, exports, artefacts, factures PDF, pièces jointes, backups.
- Critères qui imposent l'objet : durabilité, plusieurs instances, volume, presigned URLs, CDN, règles de cycle de vie.
- **Dev local** : MinIO (ou émulateur) via docker-compose (ENV-01), en passant par le **même code** (adapter PAT-12). JAMAIS de branche `if (dev) écrire sur disque` : les deux chemins divergeraient.

## STOR-02 — La base référence, le bucket stocke

- Une table `files` est la source de vérité : `id, tenant_id, owner_id, bucket, key, mime_type, size, checksum, status, created_at`. L'objet ne contient que les octets.
- Upload en deux temps : créer l'enregistrement `pending` → upload → confirmation (vérification taille/checksum) → `uploaded`. Un cron nettoie les `pending` orphelins et les objets sans enregistrement (JOB-06).

## STOR-03 — Clés d'objet

- Construites côté serveur : `tenants/{tenantId}/projects/{projectId}/files/{fileId}`.
- JAMAIS : de chemin fourni par le client, de nom de fichier utilisateur dans la clé (le nom d'origine est une métadonnée en base), de PII dans la clé (DATA-14).

## STOR-04 — Upload

- **Presigned PUT/POST direct depuis le client** DEVRAIT être le défaut (décharge le backend) : URL à expiration courte, contraintes de taille et de content-type imposées dans la signature, liée à l'enregistrement `pending`.
- Le passage par le backend PEUT se justifier : petits fichiers, transformation synchrone, scan obligatoire avant acceptation.
- Validation : type vérifié par **magic bytes**, pas seulement l'extension ; taille maximale par catégorie ; antivirus si des fichiers tiers sont redistribués ; images retraitées (strip EXIF si PII).

## STOR-05 — Lecture et diffusion

- Buckets **privés par défaut**. Aucun accès public direct aux données privées.
- Téléchargement : vérifier tenant + permission (PERM-04), puis émettre une presigned GET de courte durée. Journaliser les accès sensibles (SEC-07).
- Public réel (assets marketing) : bucket public dédié + CDN — jamais mélangé avec le privé.

## STOR-06 — Cycle de vie

- Rétention par catégorie de fichier, alignée sur DATA-14 ; lifecycle rules pour temporaires et exports.
- La suppression d'une entité (soft ou hard — DATA-13) définit explicitement le sort de ses fichiers ; l'effacement RGPD supprime réellement les objets.
- Chiffrement at rest activé ; versioning sur les buckets critiques ; réplication/backup selon criticité (DEL-07).

## STOR-07 — Traitements de fichiers

Génération de dérivés (miniatures, PDF, transcodage) : asynchrone via la queue (JOB-01), jamais dans le handler. Les dérivés sont des objets liés à l'enregistrement d'origine.

## STOR-08 — Adapter storage

Le domaine dépend d'un port (`FileStorage`), pas du SDK S3 (PAT-12). Une seule implémentation par environnement, configurée par variables d'environnement.
