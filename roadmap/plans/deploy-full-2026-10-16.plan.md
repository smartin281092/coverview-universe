# Plan — Mise en production complète : commandes horizon3, comptes, emails, Partner, Admin et Wallet

> Statut : **approuvé** — réponse de l’utilisateur du 16 octobre 2026 : « prod H3 · 1c (TOUT déployer maintenant) 2a 3b ». Mandat PROG-23 : meilleurs défauts consignés, sans GO répété.
> **Session réelle** : Claude Code, Claude Opus 5.5, effort max.

## Décisions de l’utilisateur

| ref | réponse | effet |
|---|---|---|
| Q-1 c | Tout déployer maintenant | Endpoint horizon3, comptes (WorkOS production), emails, travaux de fond, Wallet, Partner et Admin en production |
| Q-2 a | Resend | Adaptateur Resend derrière l’interface `Mailer` unique (MAIL-02) |
| Q-3 b | Nom, email et téléphone du client dans l’avis | Choix explicite, écart à MAIL-06 consigné ; l’avis ne va qu’à l’adresse interne configurée |

## Défauts PROG-23

| ref | question | défaut | raison |
|---|---|---|---|
| D-1 | Domaine d’envoi ? | Sous-domaine dédié `mail.coverview.ch`, expéditeur `CoverView <notifications@mail.coverview.ch>` | MAIL-05 ; le MX Google, le SPF et le DMARC de `coverview.ch` restent intacts (HOST-03) |
| D-2 | Région Resend ? | UE (Irlande) | Données des clients dans l’avis (Q-3 b) |
| D-3 | Envoi répété ? | Clé d’idempotence Resend = référence du message et empreinte de son contenu | Une reprise du même message n’envoie rien deux fois ; un nouveau contenu (lien d’invitation renouvelé) reste envoyable |
| D-4 | Avis horizon3 avant WorkOS ? | La tâche d’avis tourne dès qu’un fournisseur d’email existe, comptes ouverts ou non | Les commandes sont avisées sans attendre la configuration WorkOS |
| D-5 | Surfaces avant WorkOS ? | Wallet, Partner et Admin restent redirigés vers l’accueil ; ils s’ouvrent ensemble quand les comptes fonctionnent (profil Compose `apps`) | Pas d’écran de connexion cassé en public |
| D-6 | Demandes depuis le comparateur ? | Ouvertes sur le site au même moment que les comptes | Elles exigent comptes et emails |
| D-7 | Documents ? | Non déployés dans cette version | Stockage objet, clé de chiffrement, antivirus et clé OpenAI de production à décider ; Wallet fonctionne sans dépôt |
| D-8 | Premier administrateur ? | `sebastien@coverview.ch`, après sa première connexion, par attribution explicite tracée (procédure du module identité), puis Authenticator inscrit par lui-même | `identity.admin.1` : aucune attribution implicite |

## Actions réservées à l’utilisateur

Les comptes, clés et DNS restent dans ses mécanismes sûrs : l’agent ne crée aucun compte et ne voit aucune clé (G-04).

1. **Resend** : compte, domaine `mail.coverview.ch` en région UE, enregistrements DNS demandés par Resend chez Infomaniak, clé « Sending access » saisie sur le serveur par la commande fournie.
2. **WorkOS, environnement Production** : redirection `https://api.coverview.ch/auth/callback`, Authenticator (MFA TOTP) actif, clé API et Client ID saisis sur le serveur de la même façon.
3. **Première connexion** à Partner avec `sebastien@coverview.ch`, puis inscription Authenticator après l’attribution administrative.

## Séquence

- **Phase A (agent, maintenant)** : code, tests, version ; sauvegarde chiffrée hors serveur ; migrations 0074 à 0083 ; API, site et image des apps. L’endpoint horizon3 est en ligne : commandes gardées et dédupliquées ; Wallet, Partner et Admin encore fermés.
- **Phase B (utilisateur)** : clés Resend et WorkOS sur le serveur.
- **Phase C (agent)** : secret de session généré sur le serveur, comptes activés, surfaces ouvertes, site reconstruit avec les demandes, vérifications publiques, attribution administrative, contrôle du lead horizon3 dans Partner.

## Risques

- **Pages légales et droits RGPD (LAUNCH-02)** absents du site : l’ouverture publique des comptes Wallet collecte des données sans politique de confidentialité publiée. Signalé à l’utilisateur ; décision lui appartenant.
- **Recette Partner avec WorkOS réel (phase B de partner-completion)** non faite : les parcours connectés sont vérifiés en local seulement.
- Version large : 65 commits depuis `dcee63d`, dont tout le site public ; répétition sur le serveur avant bascule.

## Retour arrière

- Code : `RELEASE=dcee63d` dans `.env`, `docker compose up -d`. Les migrations 0074 à 0083 sont additives : la base reste compatible avec l’ancienne version.
- Surfaces : retirer `COMPOSE_PROFILES=apps` et `docker compose up -d` : les routes fermées reprennent.
- Comptes : `AUTH_ENABLED=false`.
- Données : sauvegarde chiffrée prise avant migration.

## Hors périmètre

Documents en production (D-7) ; changements DNS par l’agent ; nouveau serveur (HOST-02) ; pages légales.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Code | `tsc` API, ESLint, tests touchés (adaptateur Resend contre un faux serveur, avis v2, configuration, invitations, serveur) | 47/47 ; clé d’idempotence stable pour un même message, nouvelle pour un contenu renouvelé ; refus rendu sans contenu | — |
| 2 | Configuration de production | analyse des environnements des phases A, A avec Resend et C (secrets fictifs) | acceptés tous trois ; origines horizon3 et compte désigné par défaut | — |
| 3 | Apps | builds Vite des trois apps avec les adresses de production | aucun renvoi vers une adresse locale ; `api.coverview.ch` intégré | — |
| 4 | Images | `docker build` sur le serveur depuis `git archive` (empreinte vérifiée) | API, apps et site construits en 4 min 30 | — |
| 5 | Sauvegarde | `pg_dump` sur le serveur (138 tables de données listées), copie chiffrée `age` sur `D:\CoverViewBackups\production` | 19,3 Mo | déchiffrement contrôlable par l’utilisateur seul |
| 6 | Répétition | copie de la base de production, pile sur ports locaux du serveur, tunnel SSH | garde de migration : 83 refusé, 84 appliquées (74 → 84) ; API prête ; comparateur dans le navigateur (Lausanne, primes, aucune erreur console) ; commande horizon3 : pré-vol 204, 200, reprise 200, 422 ; Partner servi (l’API de production lui refuse l’origine de répétition, attendu) | répétition démontée, volume jetable supprimé ; volumes de l’ancien produit intacts |
| 7 | Suite API complète | worktree figé, commit e259c17 | 83/83 fichiers, 797/797 tests | — |
| 8 | Bascule phase A | `compose.yml` et `apps.Caddyfile` de la version, `RELEASE=e259c17`, `AUTH_ENABLED=false` ; anciens `compose.yml` et `.env` gardés à côté | 84 migrations appliquées ; API et site sains | — |
| 9 | Contrôles publics | curl et navigateur sur la production | `/` → 302 → comparateur 200 ; API prête ; pré-vol horizon3 204 avec l’origine `https://horizon3.finance`, HSTS ; corps invalide 400 sans écriture ; Wallet, Partner, Admin et ancien sous-domaine → 302 vers l’accueil ; comparateur Neuchâtel avec le nouveau profil, aucune erreur console | phase B : clés Resend et WorkOS |
| 10 | Clés et domaine d’envoi | lecture des noms seuls dans `api.env` ; DNS publics | `RESEND_API_KEY`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` une fois chacune, préfixes attendus, sans retour chariot, mode 600 ; `mail.coverview.ch` publié (DKIM, SPF et MX de retour Resend) ; DMARC `p=reject` de `coverview.ch` conservé | — |
| 11 | Activation phase C | secret de session généré sur le serveur ; configuration avec comptes contrôlée par `migrate.js` (sans effet) ; site reconstruit avec demandes et liens Wallet, version fermée gardée sous `e259c17-closed` ; `AUTH_ENABLED=true`, `COMPOSE_PROFILES=apps` | API, apps et site sains | — |
| 12 | Contrôles publics | curl et navigateur | Wallet, Partner, Admin 200 (lien profond compris) ; `/identity/me` 401 avec CORS et credentials pour Partner ; « Se connecter » du site vers la connexion WorkOS, aucune erreur console ; continuité exécutée | **WorkOS refuse `https://api.coverview.ch/auth/callback` (redirection absente de l’environnement Production)** : action de l’utilisateur |
| 13 | Avis réel | commande de test fictive (« Test Mise en production ») sur l’endpoint public | gardée, avis envoyé par Resend au premier essai à 15:27:55 UTC | réception à confirmer par l’utilisateur ; son lead apparaîtra à la première connexion du compte désigné |
