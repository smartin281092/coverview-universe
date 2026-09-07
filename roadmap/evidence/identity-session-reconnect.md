# Reconnexion Wallet après expiration locale — 2026-09-07

Mandat : corriger l’échec `account?authError=callback` signalé sur Wallet4101. Aucun reset de compte, MFA, habilitation, volume ou secret WorkOS. Cette réparation d’identity ne clôt pas S-042a.

## Diagnostic

**Vérifié** : API et dépendances prêtes200. Lecture SQL agrégée : neuf sessions historiques et aucune session localement active. Lecture filtrée des journaux PostgreSQL : trois violations de `identity_sessions_workos_session_id_unique`, sans afficher les détails de lignes, cookies ou données personnelles. Le callback validait le fournisseur puis tentait un nouvel INSERT pour un identifiant de session WorkOS déjà connu. La réponse401 sur `/identity/me` fournie par l’utilisateur est la conséquence de ce callback non abouti.

## Correctif

**Fait, vérifié localement** : sous verrou de l’utilisateur canonique puis de la session, une session WorkOS existante du même propriétaire peut recevoir un nouveau cookie opaque et une nouvelle expiration bornée par le fournisseur, après le callback réellement validé. ID et historique locaux conservés, audit distinct à chaque connexion. Ancien cookie invalidé ; aucune restauration automatique de la preuve ou du challenge MFA administratif. Une validation MFA en vol doit encore correspondre au hash du cookie authentifié lorsqu’elle publie sa preuve.

Les sessions révoquées ou en attente de révocation restent refusées. La coupure de déconnexion globale, l’identité propriétaire, PKCE/state, signature/émetteur et activité distante restent vérifiés. Un même identifiant fournisseur présenté pour une autre identité provoque le rollback complet. Aucune migration, suppression d’historique, dépendance ou changement de contrat HTTP.

## Vérification

- **Vérifié V0/V1** : typage/lint API et build passent.
- **Vérifié V2** : 29 cas existants repository/routes sur PostgreSQL Testcontainers isolé. Cas de régression intégrés aux scénarios existants : expiration locale puis trois reconnexions concurrentes sur le même ID fournisseur, unicité canonique, un seul cookie actif, audit, refus après révocation, suppression du challenge et refus d’une preuve MFA avec ancien cookie. Aucun nouveau fichier de fixtures ni persona de recette.
- Première exécution : 27/29, deux attentes anciennes oubliaient la colonne nullable `continuation` introduite auparavant. Attentes précisées avec `continuation:null`, aucune assertion retirée ou affaiblie ; 29/29 ensuite, puis suite rejouée après ajout du verrou sur le cookie MFA.
- **À vérifier V3** : retour WorkOS réel dans le navigateur après intégration. CUA échoue encore avant inventaire avec une erreur de chemin du noyau ; aucune session navigateur ou MFA contournée. Les tests ne prouvent pas une connexion fournisseur.

Références techniques consultées : [sessions AuthKit](https://workos.com/docs/authkit/sessions), [réauthentification](https://workos.com/docs/authkit/reauthentication). La réutilisation du SID dans cet incident est établie par la contrainte PostgreSQL réelle, pas déduite d’une promesse du fournisseur.
