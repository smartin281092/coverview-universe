# Authentification

> **Résumé** : Sessions cookie par défaut (web), tokens pour mobile/tiers ; rotation des refresh avec détection de réutilisation, révocation serveur, hashage argon2id, anti-énumération, reset sûr, MFA, OAuth/PKCE.

L'authentification (qui es-tu) est distincte de l'autorisation (que peux-tu faire — `permissions.md`).

## AUTH-01 — Choix du mécanisme par type de client

- **Web même domaine (client, admin et toute app additionnelle)** : sessions serveur via cookie `httpOnly` + `Secure` + `SameSite=Lax|Strict` — DEVRAIT être le défaut. Simple à révoquer, pas de token en JavaScript.
- **Mobile, clients tiers, API publique** : access token courte durée (≤ 15 min) + refresh token, ou clés API dédiées.
- Le choix réel est consigné dans §0 de CLAUDE.md et un ADR. NE PAS mélanger les mécanismes sans raison.

## AUTH-02 — Stockage côté client

JAMAIS de token durable dans `localStorage` pour une app web (XSS). Cookies `httpOnly` pour les sessions ; pour les tokens, refresh en cookie `httpOnly` et access token en mémoire uniquement.

## AUTH-03 — Refresh tokens

Rotation à chaque usage ; détection de réutilisation (un refresh déjà consommé ⇒ révoquer toute la famille de tokens) ; expiration absolue ; liaison au client émetteur.

## AUTH-04 — Sessions révocables côté serveur

Les sessions (ou familles de tokens) DOIVENT être révocables individuellement et en masse : stockage serveur (table/Redis) avec identifiant, utilisateur, device, dates. Révocation obligatoire lors de : changement de mot de passe, déconnexion « partout », désactivation du compte, changement de rôle sensible (PERM-05). Une révocation se propage au temps réel (RT-11).

## AUTH-05 — Mots de passe

Hash `argon2id` (ou `bcrypt` avec coût adapté) — JAMAIS de crypto maison, jamais de hash rapide (MD5/SHA-x seul). Politique : longueur minimale raisonnable, pas de règles de composition absurdes, vérification contre les mots de passe compromis si possible.

## AUTH-06 — Flux de connexion

Rate limiting par compte et par IP ; messages d'erreur génériques (« identifiants invalides ») ; pas d'énumération d'utilisateurs (mêmes réponses et délais que l'email existe ou non) ; journalisation des échecs (SEC-07).

## AUTH-07 — Réinitialisation et vérification email

Tokens à usage unique, expiration courte, invalidés après usage et après changement de mot de passe ; toujours répondre « si le compte existe, un email a été envoyé ». Vérification d'email requise avant les actions sensibles.

## AUTH-08 — MFA

TOTP au minimum pour les comptes à privilèges (admin) — DEVRAIT être disponible pour tous. Codes de récupération à usage unique, hashés. Re-authentification exigée avant les opérations très sensibles (changement d'email, suppression d'organisation).

## AUTH-09 — OAuth / SSO

Authorization Code + PKCE pour tout client public. `state` et `nonce` vérifiés. Les redirect URIs sont en liste blanche exacte. L'application consommatrice (ARCH-13) peut sélectionner un flux, jamais un droit.

## AUTH-10 — WebSocket et jobs

La connexion temps réel s'authentifie avec la même session/token que l'API (RT-05). Un worker agissant pour un utilisateur transporte l'identité d'origine, jamais un contournement (JOB-05).

## AUTH-11 — Fournisseur CoverView : WorkOS

WorkOS AuthKit, projet nommé `coverview`, remplace le fournisseur d'authentification du harness générique à la demande de l'utilisateur (ADR-0003). L'identifiant WorkOS, l'environnement test/production, les URI de retour et les méthodes déjà activées restent à vérifier lors de la slice d'intégration. Un nom de projet n'est ni un client ID ni une organisation métier.

WorkOS détient les identités, les moyens d'authentification et leur cycle de sécurité. L'application ne crée pas sa propre base de mots de passe, reset ou MFA : AUTH-03, AUTH-05, AUTH-07 et AUTH-08 sont des exigences à vérifier dans le flux du fournisseur, pas une invitation à dupliquer son stockage. L'API garde la session web sensible hors JavaScript (AUTH-01/02), vérifie les callbacks et applique les permissions métier à chaque accès (PERM-02). La stratégie concrète de révocation et de synchronisation sera testée dans la slice d'intégration.

Les organisations WorkOS peuvent référencer les espaces métier, mais ne donnent jamais automatiquement accès à toutes leurs données. La frontière de tenancy et les appartenances autorisées sont définies dans ADR-0002 puis dans les policies applicatives. Ne pas fabriquer des organisations, comptes ni credentials distants pour amorcer des fixtures ; voir ENV-09.

Source technique : [WorkOS Users and Organizations](https://workos.com/docs/authkit/users-organizations), consultée le 2026-09-05. Connexion au compte `coverview` non vérifiée pendant cette préparation.
