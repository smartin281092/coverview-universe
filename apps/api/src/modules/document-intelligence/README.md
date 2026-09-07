# Documents privés et extraction

S-042a ajoute le dépôt, la conservation et la revue des documents dans Wallet. La décision de fournisseur et les preuves effectives restent dans [le plan](../../../../../roadmap/plans/S-042a.plan.md) et [le ledger](../../../../../roadmap/evidence/S-042a.md). Une compilation réussie ne prouve pas une extraction OpenAI.

## Parcours et frontières

Le propriétaire WorkOS crée un dépôt, transmet les octets puis retrouve l’original dans `/documents`. Le serveur vérifie taille, SHA256 et signature sur un préfixe borné ; les autres formats restent inconnus et conservés. Aucun parsing documentaire ni transfert OpenAI avant ClamAV. PDF, PNG, JPEG et WebP sont les formats de lecture proposés. La limite d’upload est 20 Mio ; une sortie dépassement/incomplète reste en échec, sans extraction partielle présentée comme fiable.

Chaque lecture, téléchargement, mutation et job est borné au propriétaire. Aucun droit Admin, foyer ou persona implicite. Les routes reprennent les contrôles Host, origine, CSRF, rate limiting et session d’identity. Les commandes verrouillent propriétaire/session/profil puis document, vérifient révision et idempotence ; aucun accès direct S3 ou lien public n’est donné au navigateur. Le téléchargement exige un contrôle antivirus réussi et une vérification SHA256, puis retourne une pièce jointe avec `nosniff`.

Les originaux sont immuables, chiffrés AES256-GCM avant MinIO/S3, sous une clé objet opaque. La bucket policy, l’ACL et l’absence de versioning sont contrôlées avant utilisation. La réponse ACL privée particulière de MinIO est acceptée seulement sur une origine locale. Une perte de connexion pendant PUT se résout par relecture et comparaison ; aucun écrasement d’un original différent. Les connexions S3 ne sont pas réutilisées : la recette MinIO a montré une fermeture de socket après un PUT conditionnel refusé.

## Asynchrone et IA

La confirmation d’upload et son outbox PostgreSQL sont atomiques. BullMQ `coverview-documents-v1` transporte des identifiants, jamais les textes ou valeurs. Événements : `document.uploaded.v1`, `document.retry_requested.v1`, `document.deletion_requested.v1`. Un worker, quatre tentatives bornées, backoff exponentiel ; aucune room ni notification métier externe. Wallet relit les traitements en cours toutes les cinq secondes.

Le relais publie les événements toutes les trois secondes. Chaque minute, une maintenance bornée reprend les documents actifs inertes depuis dix minutes et expire les seuls dépôts non confirmés depuis 24 heures. PostgreSQL permet ainsi de reconstruire le travail après perte de Redis. La reprise automatique garde la génération logique ; une nouvelle commande propriétaire la change. Les anciens jobs ne peuvent publier après suppression ou nouvelle demande.

BullMQ utilise explicitement l’adapter du client `redis` déjà installé ; des options de connexion seules tenteraient de charger son peer optionnel ioredis absent. Le worker démarre après initialisation et le relais garde les événements en PostgreSQL tant que Redis n’est pas prêt. Délais de connexion/socket, file de commandes bornée et fermeture explicite des connexions partagées empêchent une panne initiale de bloquer l’API.

Un PING toutes les cinq secondes distingue une connexion saine au repos d’une connexion bloquée : le délai socket mesure l’inactivité et ne doit pas couper une queue vide. Les avertissements de dépendance sont limités à un par minute et par dépendance, avec code technique autorisé et durée de panne ; le rétablissement est signalé une fois. Le relais espace ses échecs de six secondes jusqu’à une minute, puis reprend sa cadence normale après réussite. Si Docker Desktop est arrêté, Redis et PostgreSQL locaux sont indisponibles : rétablir Docker et ses conteneurs existants, sans recréer leurs volumes ou le superviseur WorkOS.

L’adapter commun [LlmProvider](../../platform/llm-provider.ts) utilise Responses, `store:false`, aucun outil, schéma JSON strict, délai de 90 secondes et sortie bornée. Le prompt/version est dans `document.extraction.ts`. Les pages et citations sont proposées par le modèle : leur cohérence est contrôlée, leur exactitude nécessite la confrontation à l’original. La confiance et la zone restent nulles quand non mesurées. Les documents sont des données non fiables, jamais des instructions d’action.

Les refus 429 de facturation (`insufficient_quota`, dont `credit_balance_exhausted`) deviennent `ai_quota_exhausted`, sans retry automatique. Seuls les codes/type d’un corps borné à 16 Ko servent à la classification ; aucun message fournisseur brut n’est exposé. Les anciens `ai_rate_limited` pouvant couvrir les deux causes conservent un message prudent. [Diagnostic réel et vérifications](../../../../../roadmap/evidence/document-quota-animation.md).

Le choix `analysisRequested` est enregistré au dépôt. Reprendre un contrôle respecte ce choix ; une lecture ou relecture OpenAI volontaire ouvre son explication avant l’envoi. Un appel est réservé atomiquement par propriétaire et génération avant envoi. Un résultat et son usage sont enregistrés ensemble ; un appel à issue inconnue ne se répète pas automatiquement. Une nouvelle lecture explicite consomme une nouvelle réservation. Le budget initial est trois appels sur 24 heures glissantes, incluant les issues incertaines ; tokens et estimation en micro-USD sont loggés avec identifiants techniques, sans PII. Les tarifs configurés sont des estimations à réviser avec le modèle, pas une facture fournisseur.

## Revue et profil compatible

La classification, les informations extraites, l’original et les décisions sont séparés. La correction de catégorie survit à une nouvelle analyse. Chaque champ est accepté, corrigé ou laissé tel quel ; accepter/corriger exige l’attestation qu’il concerne le propriétaire. Les huit champs existants passent par la fonction publique d’identity dans la même transaction que la décision/audit. Les autres métadonnées restent documentaires. Aucun enrichissement automatique ni KYC.

Le contrat profil N-1 garde ses champs, sources et valeurs de confiance existants. La provenance documentaire est portée par le DTO dédié et les décisions. Une proposition anonyme encore à arbitrer n’est pas écrasée. Les dernières valeurs documentaires acceptées restent disponibles au-delà des vingt décisions affichées.

## Données et manifeste S-130 / S-131

| Donnée | Propriétaire et export | Conservation / suppression |
|---|---|---|
| `files`, objet S3 original | Propriétaire individuel ; original et métadonnées | Jusqu’à suppression volontaire ; un dépôt non confirmé expire techniquement après 24 h |
| Analyse, transcription, preuves | Même propriétaire ; dérivés distincts | Effacés à la demande de suppression |
| `document_decisions` | Décisions/provenance du propriétaire | Valeurs et citations effacées à la suppression ; noms des champs, choix et dates conservés pour la provenance du profil survivant |
| `document_commands` | Rejeu privé des commandes | 24 h ; snapshots immédiatement vidés à la suppression |
| `document_outbox`, `document_audit_events` | Identifiants techniques du propriétaire, sans valeurs extraites | Rétention finale à définir dans S-130/S-131 ; aucune durée légale inventée |
| `document_ai_calls` | Réservations, modèle, tokens du propriétaire | Rétention finale à définir dans S-130/S-131 ; aucune transcription |
| Champs confirmés du profil | Profil canonique existant | Survivent à la suppression de l’original, conformément au choix annoncé |

La suppression rend les lectures immédiatement impossibles, invalide les jobs, vide dérivés/snapshots et programme la suppression physique. Un second effacement après une fenêtre de deux minutes couvre un PUT commencé avant suppression, même après crash API ; les métadonnées restantes sont alors neutralisées. Le bucket doit rester sans versioning : ce module ne prétend pas purger les versions ou sauvegardes externes. L’export/effacement de compte global n’est pas encore livré.

Migration additive `0006` générée par Drizzle ; rollback applicatif N-1 en gardant les tables, aucun reset/down destructif. Le chiffrement exige de conserver la clé indépendamment de la session WorkOS.

## Exploitation

Variables et valeurs locales dans [`.env.example`](../../../../../.env.example). `DOCUMENTS_ENABLED` suit l’activation WorkOS. Hors développement local, identifiants S3 dédiés et `DOCUMENT_STORAGE_KEY` de 32 octets sont obligatoires. Le compose local ajoute seulement ClamAV, volume de signatures persistant et port loopback ; les services existants ne doivent pas être remplacés pour activer Documents.

Sous Windows local, une clé indépendante est créée atomiquement et chiffrée avec DPAPI CurrentUser dans `%LOCALAPPDATA%/CoverView/secrets/storage-v1.dpapi`. Préserver ce magasin **et** le compte Windows pour retrouver les originaux. Aucun secret de session ne sert de clé de stockage. Le script produit reste dans le dépôt, sans dépendance au runtime de l’agent.

La clé OpenAI peut être injectée comme `OPENAI_API_KEY` côté API ou configurée, en local, par `powershell -NoProfile -File scripts/local-document-secrets.ps1 -Operation set-openai`. La saisie est masquée, le fichier chiffré est publié atomiquement ; aucun secret en argument, `.env`, navigateur ou log. La prochaine lecture utilise la clé sans redémarrer le superviseur WorkOS. Les opérations internes `read-openai` et `ensure-storage` sont réservées au pipe privé de l’API : ne pas les lancer dans un terminal opérateur.

Choisir OpenAI ne prouve pas une clé disponible, un DPA, une résidence ou une conformité de production. `store:false` n’est pas une garantie d’absence de conservation fournisseur. La mise en production des données sensibles reste soumise à LLM-06 et aux slices de conformité.

## Dépendances et sources

`@aws-sdk/client-s3` (Apache-2.0) fournit le protocole S3 ; `bullmq` (MIT), la queue imposée ; `file-type` (MIT), la détection bornée de signature. Versions résolues et intégrité dans le lockfile. `msgpackr-extract` optionnel n’exécute pas de build natif ; repli JavaScript. ClamAV (GPLv2) reste un service séparé, image fixée par digest ; aucun moteur installé dans le runtime agent n’est requis.

Sources officielles consultées : [Responses et fichiers](https://developers.openai.com/api/docs/guides/file-inputs), [sorties structurées](https://developers.openai.com/api/docs/guides/structured-outputs), [données fournisseur](https://developers.openai.com/api/docs/guides/your-data), [modèle et tarifs](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [ClamAV Docker](https://docs.clamav.net/manual/Installing/Docker.html), [compatibilité ACL MinIO](https://github.com/minio/minio/blob/master/cmd/acl-handlers.go).
