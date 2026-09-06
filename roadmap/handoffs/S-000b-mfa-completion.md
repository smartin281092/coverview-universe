# Reprise de travail — S-000b, confirmation personnelle Authenticator et preuve MFA

## État courant après implémentation — 2026-09-06

**Actualisation personnelle** : Authenticator BMP confirmé par le titulaire le 2026-09-06 à 18:15:09.313 UTC ; état SQL confirmed sans incertitude, écran de succès relu dans le navigateur intégré. L’état zéro inscription ci-dessous décrit la préparation antérieure. Deux sessions actives, zéro grant admin. Une question de désignation BMP/Hook est en attente dans la tâche courante. Restent uniquement désignation, grant tracé et preuve MFA administrative distincte. Le mandat utilisateur ajoute désormais la double revue produit de chaque slice dans execution-policy.md ; le suivre aussi dans chaque nouvelle tâche Astra Ultra.

Cette section actualise le checkpoint historique conservé ci-dessous. Le parcours d’inscription manquant est maintenant implémenté, revu, migré et intégré. La page réelle est prête pour le titulaire. S-000b demeure **running** : aucune preuve C05 complète ni nouvelle tâche S-013 avant confirmation personnelle, désignation admin et MFA administrative réelle. Le mandat d’enchaînement et l’absence de nouveau GO restent acquis.

### Dépôt et services vivants

Propriétaire courant : `C:/Users/sebm1/.codex/worktrees/ffdf/coverview-astra`, branche `codex/s-000b-authenticator`. Commit applicatif vérifié : `da362e04efd89698fd19724c55b0fbb85d2e6df8`, descendant de c57f145 ; réparation du callback et UI Geist/Montech conservées. Le commit documentaire peut être postérieur : vérifier HEAD, branche, ascendance et propreté avant écriture.

Le commit applicatif a été intégré par fast-forward dans main enregistré (`D:/Projects/coverview-astra`), API 9b02 (`codex/s-011-editorial`) et UI 4133 (`codex/s-000b-workos`) après contrôle de propreté. HEAD et contenu comparés identiques ; aucun push. Le superviseur API secret et les frontends sont préservés. Les migrations additives 0002/0003 ont été appliquées puis rejouées sans suppression ; aucun reset ni autre compose lancé. Dernière lecture : API ready, identité enabled:true.

### Page personnelle prête

Chrome a été reconnecté au compte `sebastien@bmpartners.ch` par WorkOS avec `maxAge:0` et OTP email autorisé. Retour compte équipe refusé sans habilitation, puis lien « Configurer Authenticator » suivi jusqu’à `http://127.0.0.1:4102/authenticator`. Identité, instructions et bouton « Générer mon QR code » relus et inspectés visuellement avant création. Onglet laissé au titulaire ; les identifiants CUA ne sont pas portables entre tâches. Ouvrir le même lien dans le navigateur intégré ne transfère pas la session Chrome.

Dernier SQL : deux utilisateurs, une session active avec `authenticated_at` récent, zéro inscription et zéro habilitation. Cet état remplace l’ancien zéro session active. La fraîcheur requise expire après dix minutes ; le parcours propose alors une reconnexion explicite. Aucune date de fraîcheur ne doit être fabriquée.

La politique de l’outil navigateur réserve la création et la confirmation d’un nouveau credential à l’utilisateur : il doit lancer le QR, le scanner et confirmer son code dans la page. Aucun bouton de création actionné par l’agent, aucun seed/QR/URI collecté, aucune capture après QR. Ne pas demander le secret ou le code dans la conversation. Après confirmation personnelle, relire uniquement le résultat non sensible.

La désignation du bénéficiaire admin reste sans réponse. Ne pas déduire une permission du compte BMP préparé. Les deux emails autorisés et les identités canoniques sont au ledger ; le grant local et la preuve MFA liée à la session sont deux préconditions séparées.

### Livraison et limites

Parcours propriétaire `/authenticator` et `/authenticator/cancel` : état, lancement explicite, reprise du challenge, confirmation et annulation bornée au facteur de l’inscription. SDK WorkOS 10.13.0 existant, réservation durable unique, claims, audit et traitement fermé des résultats distants ambigus. QR rendu une seule fois en état React, jamais stocké serveur/cache/fichier. Confirmation avec rotation de handle, sans grant ni preuve administrative. Le step-up exclut le facteur pending. Fraîcheur fondée sur `auth_time` signé, session nullable et reconnexion explicite `maxAge:0`.

Types/lint/build API, admin, Wallet et contrats passent ; frontières/knip passent. Trois cas SDK existants et un cas HTTP/PostgreSQL MFA existant sélectionnés passent ; aucun nouveau test ni batterie de fixtures. Les 29 cas historiques non exécutés ne sont pas revendiqués. Revue indépendante close après corrections de séparation enrollment/step-up, fraîcheur et verrous SQL. Avertissement bundle admin 535,55 kB > 500 kB maintenu. Aucune dépendance ajoutée. Détails dans le ledger actuel.

### Prochaine action bornée

1. Attendre le résultat de l’inscription personnelle et la désignation admin. Le code et la page nécessaires sont prêts ; leur implémentation n’est plus un obstacle.
2. Après désignation, relire la paire canonique/WorkOS et préparer la transaction SQL paramétrée d’attribution `administration.access` conformément au README identity. Consigner opérateur, environnement, bénéficiaire, motif et référence d’autorisation ; vérifier unicité et résultat. Aucune route de grant applicative n’existe volontairement.
3. Relire l’inscription confirmée sans secret ; recharger compte équipe et constater MFA requise. Faire terminer le challenge distinct via `/mfa`, puis constater accès administratif réel, preuve liée à la session et audit. Depuis l’autre identité sans permission, constater refus de `/identity/admin` et de la variante falsifiée `?role=admin&app=admin`. Ne pas rejouer les parcours personnels/révocations déjà acquis sans nouveau doute.
4. Seulement après C05 complet : S-000b done, intégration locale conservatrice, nouvelle tâche Astra Ultra S-013, puis ordre de programme acquis. Ne pas modifier les dépendances pour contourner cette preuve.

## Checkpoint historique antérieur à l’implémentation

Les sections ci-dessous décrivent le point de départ et ses contraintes acquises ; leurs étapes d’implémentation et états Git sont remplacés par l’état courant ci-dessus.

Créé : 2026-09-06
Contexte observé : non disponible ; relais préventif autorisé, aucune mesure de seuil inventée.

## Mission et autorisation

Terminer S-000b, puis enchaîner tout le programme selon [execution-policy](../execution-policy.md), une nouvelle tâche **gpt-6-astra / ultra** par slice. Demande réaffirmée : « Ne me demande pas d’autorisation, continue jusqu’à ce que les tâches soient terminées ». Le callback et les parcours personnels sont désormais corrigés et prouvés. Cette reprise a pour périmètre borné le dernier parcours manquant : inscription Authenticator utilisable puis accès administratif avec MFA réelle (C05). Mettre à jour le plan canonique avec les choix d’implémentation avant ce nouveau parcours ; le mandat couvre cette préparation. Aucun GO supplémentaire requis.

## État du dépôt

Source : `C:/Users/sebm1/.codex/worktrees/6e7a/coverview-astra`, branche `codex/s-000b-callback-repair`. Le SHA final requis est transmis par le prompt de création. Vérifier son ascendance avant toute écriture. La fusion 4c06875 réconcilie main d6461fb (UI Geist/Montech) et les anciennes preuves 7a73605. Les corrections suivantes n’ont changé aucune UI ni dépendance. Le checkout enregistré `D:/Projects/coverview-astra` doit avoir reçu le SHA testé par fast-forward avant ce relais ; vérifier branche et propreté. Aucun push requis.

Le checkout API vivant est `C:/Users/sebm1/.codex/worktrees/9b02/coverview-astra`. Il contient les cinq sources corrigées, déployées avec contrôle de contenu ; son état Git final est donné au lancement. Ne pas confondre son runtime avec celui du nouveau worktree.

## Sources à lire

AGENTS → CLAUDE, PROJECT, docs/codex, MEMORY actives ; [plan](../plans/S-000b.plan.md), [prompt](../prompts/S-000b.prompt.md), [preuves](../evidence/S-000b.md), README identity et satellites auth/security/permissions/backend/frontend/design/i18n/testing/environment selon le nouveau parcours. Le ledger fait foi pour l’état courant. `S-000b-callback-repair.md` est un checkpoint historique dont l’hypothèse d’issuer a été invalidée ; ne pas la réappliquer.

## Décisions acquises

WorkOS coverview / LocalHost, Staging : environnement `environment_01M1KCQBWNWDZKZNVW9R0GH4YM`, application `app_01M1KCQCGN17F8C337FYNTX6M8`, client `client_01M1KCQC9R4RDXEECM62JEZB0V`. AuthKit `exquisite-theory-35-localhost.authkit.app`, callback `http://127.0.0.1:4100/auth/callback`, homepage 4103 ; Magic Auth Enabled et MFA Optional confirmés. Ne pas imposer MFA globalement pour contourner l’absence de parcours d’inscription.

Tests et emails autorisés : `sebastien@bmpartners.ch` et `sebastien.martin@hook.sarl`. Deux identités CoverView distinctes réellement persistées, IDs au ledger. Aucun facteur, mot de passe, droit admin ou organisation créé. Les comptes `.test` restent non vérifiés ; aucun contournement email. Une question de désignation du bénéficiaire admin a été envoyée dans la tâche source, sans réponse au checkpoint ; ne pas répéter une demande de GO ni déduire un grant du nom d’une adresse. La préparation technique indépendante doit continuer pendant cette attente.

La règle `identity.admin.1` exige une habilitation locale explicite et une preuve MFA liée à la session. WorkOS conserve les moyens d’authentification. La politique de l’outil navigateur impose à l’utilisateur d’effectuer personnellement la création/confirmation d’un nouveau credential : préparer entièrement la page d’inscription avant ce passage. Ne jamais collecter son seed Authenticator, le copier dans les logs/artefacts ou inscrire un facteur pour lui.

## Livraison et preuves

Cause réelle : validation SDK réussie puis rejet `token_claims / issuer_mismatch`, configuré `app` OIDC contre token signé `generic` AuthKit. Correction bornée au même client en local/development hors production ; aucune confiance tirée d’un token. Diagnostic permanent à schéma fermé sans secret ni message fournisseur brut. Instrumentation locale temporaire retirée ; `/health` ready et `/identity/config` enabled:true après retrait.

Recette V3 réelle : BMP et Hook connectés par WorkOS et persistés ; espaces personnels propriétaires accessibles, refus croisés ; continuité www/Wallet ; compte ordinaire refusé dans l’équipe. Logout Hook, deuxième appareil BMP avec le même ID canonique, révocation ciblée, reconnexion puis logout global depuis deux sessions actives. État final : 2 utilisateurs, 4 sessions historiques, 0 active, 0 révocation distante en attente. Les sessions sont volontairement déconnectées. Aucun oracle fournisseur remplacé par une fixture.

Contrôles de la réparation : régression configuration d’abord rouge puis verte ; 30 tests configuration/diagnostic/fournisseur passent, types et lint ciblés, build API, frontières/knip, référentiel et vues roadmap valides. Revue indépendante sans défaut concret. Les 29 tests routes/repository supplémentaires n’ont pas pu s’exécuter faute d’accès Docker dans le sandbox ; la relance avec validation a été interrompue. Ne pas les annoncer passés ni répéter les mêmes contrôles sans changement ou doute concret. Pas de migration ni dépendance ajoutée.

## Prochaine action bornée

1. Implémenter le parcours propriétaire d’inscription TOTP : lancement explicite depuis une session authentifiée, protection CSRF/propriété, restitution transitoire du QR uniquement dans la page utilisateur, confirmation et nettoyage des états sensibles. Réutiliser les composants UI actuels, le module identity et le SDK installé ; documenter contrats/risques/DoD dans state puis régénérer. Le code actuel sait seulement lister des facteurs et challenger un TOTP existant ; il ne sait pas inscrire un utilisateur. Ce manque applicatif doit être corrigé avant de demander une intervention personnelle.
2. Recherche déjà effectuée : [WorkOS MFA](https://workos.com/docs/reference/authkit/mfa) ; le SDK installé expose `workos.multiFactorAuth.createUserAuthFactor({userId,type:"totp",totpIssuer,totpUser})`, qui retourne un facteur avec secret et challenge. Vérifier ses types réels : le nom web `userManagement.enrollAuthFactor` diffère. [User Security widget](https://workos.com/docs/widgets/user-security) est une alternative plus large avec dépendances/CORS ; ne pas inventer d’organisation pour satisfaire le type SDK. Aucun parcours QR utilisateur applicatif déjà accessible n’a été trouvé dans le dashboard WorkOS.
3. Vérifier le changement proportionnellement, transférer les sources vers le runtime vivant après contrôle de contenu et préparer le parcours complet. L’utilisateur scanne et confirme personnellement le credential dans la page. L’attribution admin reste tracée et dépend de sa désignation. Vérifier succès MFA, accès admin, refus sans preuve/permission et invalidation appropriée ; ne pas prétendre C05 clos avant ce parcours réel.
4. Après preuves complètes : S-000b done, intégration locale conservatrice, puis nouvelle tâche Astra Ultra S-013. Ordre contact ensuite S-080 → reste S-011 → S-012. Aucune autre slice indépendante n’était éligible avant S-000b done ; ne pas modifier les dépendances pour contourner C05. S-011 reste review avec sources bio/Instagram manquantes.

## Obstacles et tentatives

Ne pas réinvestiguer redirects, issuer OIDC, clé API ou OTP pour le callback désormais prouvé. Ne pas extraire l’environnement du processus. Le navigateur intégré bloque la navigation directe vers `/identity/me` (`ERR_BLOCKED_BY_CLIENT`) ; le refus via les espaces applicatifs a été observé, sans contourner ce blocage. Chrome et navigateur intégré fonctionnent pour les logins réels ; limiter les lectures email aux messages de test autorisés et masquer les OTP dans toute sortie.

Node requis : `C:/Users/sebm1/.codex/worktrees/10c1/coverview-astra/.planning-local/node-v24.20.0-win-x64/node.exe`. Pnpm natif dans `10c1/coverview-astra/.planning-local/toolchain/node_modules/pnpm/pnpm.exe`. Installation frozen dans le nouveau worktree ; pas de pnpm.cjs disponible. Pnpm récursif peut choisir le Node fourni par l’app trop ancien : build API direct avec le Node24.20 si nécessaire. Échecs sandbox réseau/dossiers exigent la procédure d’escalade, pas un contournement.

## Coordination

Après lancement, cette nouvelle tâche est seule propriétaire des écritures applicatives et roadmap. Les sous-agents précédents restituent leur travail avant transfert. API 4100 surveillée par le superviseur Node PID41260 (à revalider) lancé par l’utilisateur dans 9b02 ; préserver ce terminal et son environnement secret. Le watcher recharge les sources sans réinjection de clé. Client/admin/www 4101/4102/4103 tournent depuis 4133 avec les UI de main. Docker `coverview-s000b` sain, volumes à préserver ; ne pas lancer un autre compose sur les mêmes ports. Aucune action sur taliq/growth-codex-prod ou l’infrastructure externe. Onglets et variables CUA doivent être redécouverts ; aucun ID d’onglet n’est portable entre tâches.
