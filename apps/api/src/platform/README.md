# Platform

## Résumé

Socle technique de CoverView Core : configuration, processus HTTP, sondes de santé et données techniques de preview. Le module [identity](../modules/identity/README.md) est propriétaire de l’authentification, des identités personnelles et des permissions associées.

## Périmètre

Fastify utilise les contrats partagés, PostgreSQL via Drizzle et le client Redis officiel. MinIO et Mailpit sont sondés uniquement en mode adaptateur local. Platform enregistre le module identity ; lorsque `AUTH_ENABLED=true`, celui-ci utilise WorkOS. Les sondes et les fixtures platform n’émettent aucun email, fichier ou paiement métier.

**Emails (`mailer.ts`).** Interface `Mailer` unique (MAIL-02). Le seul adaptateur actuel est l’API HTTP de Mailpit, actif avec `EXTERNAL_ADAPTER_MODE=local` ; sinon `createMailer` ne renvoie aucun adaptateur et aucun envoi n’a lieu. Les erreurs ne portent que le statut HTTP, jamais le destinataire ni le contenu. Premier usage : [invitations Wallet](../modules/partner-workspace/docs/client-invitations.md). Dérogation signalée à MAIL-02 (Mailpit via SMTP) : la convention locale `MAILPIT_URL` HTTP est suivie ; un fournisseur de production s’ajoutera derrière la même interface.

## Règles métier et invariants

Les gardes exécutables de `config.ts` appliquent ENV-08/09 et BACK-07. Les rôles de preview ne définissent ni tenancy ni permissions produit. Les migrations identity ajoutent des tables distinctes sans convertir les personas en utilisateurs. Liveness et readiness sont distincts (OBS-04).

## Permissions

Les sondes sont publiques et ne retournent que l'état global. `/local/personas` existe seulement si le mode local validé est actif ; le socket et l'hôte HTTP doivent être loopback. Les personas ne sont pas des comptes de connexion et ne donnent accès à aucune opération métier. Les règles de propriété, d’habilitation et de MFA vivent dans [identity](../modules/identity/README.md#permissions).

## État réel

API et connexions techniques implémentées ; preuves du socle dans [S-000a](../../../../roadmap/evidence/S-000a.md), intégration de l’identité et limites externes dans [S-000b](../../../../roadmap/evidence/S-000b.md). Les personas restent fictives. Le succès des sondes de santé n’est pas une preuve de connexion WorkOS.

## Données et exploitation

`local_preview_personas` conserve uniquement des identifiants techniques et des libellés/adresses fictifs. Propriétaire : platform. Catégorie : fixture locale, sans PII réelle ni donnée privée utilisateur. Export/rétention produit non applicables ; suppression physique lors du reset local explicite, jamais de durée légale inventée. Les identifiants sont déclarés une seule fois dans `db/seed/personas.mjs` (ENV-03).

Readiness interroge PostgreSQL (et le schéma en mode fixture), Redis, puis les sondes MinIO/Mailpit locales. Les appels externes sont bornés ; les logs de dépendances indiquent leur nom, sans URL ni credential. L'arrêt ferme la base et borne le délai de terminaison.

`loadEnvironment` charge la configuration locale `.env`, puis valide l’environnement du processus. Le fichier d’exemple laisse `AUTH_ENABLED=false`. Pour l’activer, l’opérateur injecte les credentials WorkOS et la clé de session uniquement dans le processus API ; la [procédure identity](../modules/identity/README.md#activer-et-vérifier-localement) précise les origines, l’émetteur et les vérifications. Aucune variable secrète ne doit être placée dans `.env` ni transmise au build des frontends.

`pnpm db:migrate` et `pnpm db:seed` sont gardés sur une base CoverView locale/test en loopback. Le reset exige en plus la base exacte `coverview_local`, `--confirm-local-reset` **et** `--confirm-identity-reset`. La commande opérateur `pnpm db:reset -- --confirm-local-reset --confirm-identity-reset` supprime les sept tables identity, leur audit, la table des personas et le journal Drizzle, puis rejoue migrations et seeds. Elle ne révoque pas les sessions distantes WorkOS. Ne l’utiliser qu’après autorisation explicite de perdre ces données et contrôle de la base cible ; elle ne fait partie ni du démarrage normal ni du rollback applicatif. Cette documentation n’exécute pas de reset.

Les migrations identity sont additives : revenir à l’application N-1 conserve les tables et l’audit. Leur suppression serait une opération distincte nécessitant une stratégie d’export/restauration et une autorisation explicite.

## Vérification

`pnpm --filter api check:env`, `typecheck`, `test` et `build` vérifient le socle. La suite `database.test.ts` démarre un vrai PostgreSQL jetable via Testcontainers, rejoue migration/seeds et vérifie les contraintes SQL. Les tests écrits dans cette slice ne constituent pas une revue humaine indépendante (TEST-10).

## Annuaire des profils et transfert administratif

Demande utilisateur du 11 septembre 2026 : l’Admin présente chaque profil du compte, y compris le titulaire, dans `GET /admin/profiles`. Recherche littérale par nom du profil ou du compte et email, pagination stable bornée à 50, curseur lié à la recherche. Les comptes sont les identités CoverView existantes ; ce parcours ne crée ni identité ni compte WorkOS. L’orchestration `admin-profile-transfer.*` est placée dans platform car elle coordonne une transaction entre les modules sans créer de cycle entre leurs points d’entrée.

`POST /admin/users/:userId/profiles/:profileId/transfer` déplace un profil supplémentaire vers un compte existant explicitement choisi. Son identifiant reste stable ; aucune fusion avec le profil principal de destination n’est effectuée. Le titulaire `self` reste lié à son identité de connexion et n’est pas transférable. Le dialogue explique ce cas. Les limites existantes de 49 profils supplémentaires et 200 documents vivants par compte s’appliquent aussi à la destination.

L’opération vérifie Host, CSRF, idempotence et `administration.access` avec la MFA fraîche de l’administrateur. La transaction verrouille les comptes source, destinataire et administrateur dans le même ordre que les autres commandes, puis relit session réelle, révocation, permission et MFA via `lockProfileActor`. La destination doit exister et ne pas être en révocation globale ; elle n’a pas besoin d’une session ouverte pour recevoir le dossier. Les sessions déjà ouvertes du destinataire accèdent ensuite au profil par les contrôles habituels de propriété. Les sessions source restent valables pour leurs autres profils, mais perdent l’accès au dossier transféré.

Le transfert est atomique pour les sections générales/finances/santé et leurs sources, documents/analyses/corrections/décisions, pièces associées, demandes compagnies et preuves, historique du centre d’actions, suivis manuels, tâches/notes/événements/rendez-vous et reçus de signatures. Les contrats sont des projections des originaux transférés. Les identifiants du centre d’actions sont recalculés pour le compte destinataire, sans modifier le contenu historique ni l’acteur ou sa session. Les signatures conservent leur reçu et leur signataire d’origine ; les autorisations existantes sont révoquées et nécessitent une nouvelle signature. L’audit de transfert conserve explicitement cette politique.

Les réponses mises en cache dans `document_commands`, `managed_profile_commands`, `company_action_commands`, `action_center_commands` et `client_activity_commands` sont invalidées pour la source et le dossier concerné, afin qu’un ancien rejeu ne restitue aucune donnée déplacée. Les anciennes clés `document_identity_attachment_commands`, qui ne portent aucun profil explicite ni données personnelles, sont invalidées pour le compte source. Les audits techniques documentaires/profils/activités et les réservations IA restent des traces historiques du compte et de l’acteur d’origine ; ils ne constituent aucune voie de lecture de l’ancien dossier. Les reçus de signature et l’historique utilisateur suivent le dossier et deviennent inaccessibles à la source. `admin_profile_transfers` est à la fois audit durable et reçu d’idempotence permanent, composé uniquement d’identifiants, révision, empreinte et date : le maintien du reçu au-delà des 24 heures par défaut empêche de réexécuter cette opération critique avec une ancienne clé. Sa rétention finale relève de S-130/S-131.

Les octets et `object_key` restent inchangés : cette clé sert d’AAD au chiffrement AES-GCM, et chaque téléchargement réévalue l’accès SQL avant et après le chargement. Aucun objet n’est copié ni rechiffré. Les documents vivants sont verrouillés avant d’inspecter leur état, y compris face aux workers qui verrouillent directement le document. Un dépôt, scan, lecture, suppression ou événement documentaire non publié bloque le transfert avec une erreur permettant de réessayer une fois le traitement terminé. Les jobs publiés pour l’ancien propriétaire sont ensuite sans effet puisque la lecture du job exige encore ce propriétaire. Les identifiants de réservation IA incluent le propriétaire ; une relecture explicite dans le compte destinataire reste possible sans collision et sans appel automatique lors du transfert.

La migration additive `0018` rend les seules FK composites du dossier différables mais immédiatement vérifiées par défaut. Seule la transaction de transfert les diffère jusqu’au commit ; une erreur tardive annule également les changements de propriétaire et d’invalidation des caches. Retour applicatif N-1 : conserver la migration, ses tables et ses contraintes ; aucun reset n’est requis. Un retour métier utilise un nouveau transfert autorisé vers le compte précédent, avec la révision actuelle. Les signatures révoquées ne sont jamais réactivées par ce retour. En production, sauvegarder avant migration selon DEL-07 ; la conservation des tables est la stratégie de rollback, aucune suppression destructive n’est fournie.

Vérification ciblée : `admin-profile-transfer.test.ts` exécute six tests sur PostgreSQL jetable (annuaire, isolation et MFA, original avec service d’upload/téléchargement, sections/sources et dossier complet, signatures, reprise de lecture, concurrence/rejeu et destinations concurrentes, échec après les mutations et rollback intégral, refus des anciens reçus du centre d’actions). Stockage objet et verdict antivirus sont des doubles explicites ; aucun fichier réel, transfert client, fournisseur IA ou compte WorkOS n’est muté pour cette preuve. Les tests ont été écrits avec l’implémentation et ne remplacent pas une revue indépendante (TEST-10). Aucune dépendance, variable d’environnement, migration destructive, room ou nouveau job n’est ajouté par ce parcours.

Maintenance des migrations : la commande locale gardée `db:migrate` utilise un délai DDL borné de 60 secondes, nécessaire à la construction des index sur les catalogues importés. Les délais API, les gardes de base locale et les commandes de reset restent inchangés. Preuve : [recommandation maladie](../modules/health-insurance/recommendation.md).
