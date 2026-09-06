# Module `identity`

## Résumé

Le module porte l’identité canonique CoverView et la session serveur commune aux surfaces Wallet, équipe et site public. WorkOS conserve les moyens d’authentification ; CoverView applique la propriété personnelle et l’habilitation administrative explicite.

## Périmètre

**Géré ici** : transactions de connexion, association de l’identité WorkOS à un utilisateur et profil uniques, appareils et révocations, preuve MFA de session et audit de sécurité. Le module est propriétaire de cette capacité transverse pour les applications consommatrices.

**Non géré ici** : organisations et partage foyer (slices propriétaires), rattachement anonyme (S-013), règles d’effacement/export et conservation définitives (S-130/S-131). Les personas `platform` restent des fixtures techniques sans habilitation.

## Règles métier et invariants

- **`identity.canonical.1`** — Une identité WorkOS correspond à un utilisateur applicatif et un profil uniques. Une même adresse email ne fusionne jamais deux identités ; [ADR-0002](../../../../../adr/0002-tenancy.md) fixe leur séparation des espaces métier.
- **`identity.session.1`** — La consommation de la transaction de connexion est atomique et liée au navigateur. Les appareils appartiennent à l’utilisateur canonique ; leur consultation et révocation sont bornées à ce propriétaire.
- **`identity.session.2`** — Le retrait local précède la révocation distante. Un échec distant conserve l’état « en attente ». La déconnexion globale sérialise les callbacks via la ligne utilisateur et invalide les connexions commencées avant elle ; un ancien acquittement distant ne peut terminer une nouvelle révocation.
- **`identity.admin.1`** — L’habilitation administrative est absente par défaut et relue à chaque accès. La preuve MFA concerne une seule session et ne crée jamais la permission. Un challenge consommé est à usage unique ; la validation réussie renouvelle le handle de session.
- **`identity.enrollment.1`** — L’inscription Authenticator appartient à l’utilisateur connecté. Elle exige un lancement explicite, une connexion récente et une réservation durable avant création chez WorkOS. La confirmation du facteur renouvelle la session, sans attribuer de permission ni valider le challenge administratif distinct. Un résultat distant incertain reste visible et ne déclenche aucune création répétée.

## Permissions

L’espace personnel utilise l’identité et la propriété, sans accès implicite d’un foyer ni d’une organisation WorkOS. `administration.access` exige une attribution locale explicite avec sa preuve ; aucune fixture, interface, adresse email ou nom de projet ne l’attribue. Il n’existe pas de route publique d’attribution. Les règles MFA et l’intégration fournisseur suivent [AUTH-11](../../../../../docs/auth.md#auth-11--fournisseur-coverview--workos).

## État réel

Les connexions WorkOS de deux identités, leur persistance, l’isolation personnelle, la continuité www/Wallet et les révocations d’appareils sont vérifiées en local. Inscription Authenticator personnelle, attribution nominative et accès administratif avec MFA distincte ont été exécutés avec WorkOS réel ; le compte ordinaire reste refusé. Les preuves et limites sont centralisées dans [le ledger S-000b](../../../../../roadmap/evidence/S-000b.md), l’attribution locale dans [sa trace opérateur](../../../../../roadmap/evidence/S-000b-admin-grant.md). `AUTH_ENABLED=false` conserve un état d’indisponibilité explicite.

## Activer et vérifier localement

1. Identifier en lecture seule l’environnement WorkOS autorisé, son application, son client ID et les identités de test autorisées. Le constat courant et le diff de configuration à préparer sont dans le ledger. Vérifier Magic Auth (email/OTP) et MFA dans cet environnement ; tout changement distant doit rester dans le périmètre autorisé.
2. Après démarrage de l’infrastructure locale, appliquer `pnpm db:migrate`. Le seed ne crée aucun compte WorkOS ni droit d’administration. Configurer les origines non secrètes de [`.env.example`](../../../../../.env.example) selon le tableau ci-dessous ; conserver `127.0.0.1` sur toutes les surfaces, sans le mélanger avec `localhost`.
3. Dans un terminal PowerShell 7, lancer `./scripts/start-auth-preview.ps1 -ClientId <client_id vérifié>` depuis la racine. `-NodeExecutable` permet de sélectionner le Node du projet. Coller la clé WorkOS dans la saisie masquée ; le script génère la clé de session de 32 octets en mémoire. Il valide la configuration avant d’arrêter la preview possédée, puis relance l’API avec `AUTH_ENABLED=true` et `FIXTURE_MODE=false`. Les processus frontend et Docker ne reçoivent ni `WORKOS_API_KEY` ni `AUTH_SESSION_SECRET`. Aucun secret n’est écrit dans `.env`, un script, l’historique, les arguments ou le dépôt. Une nouvelle exécution demande à nouveau la clé.
4. `WORKOS_ISSUER` désigne l’émetteur de l’**access token de session AuthKit** : `https://api.workos.com/` par défaut, ou le domaine d’authentification personnalisé effectivement configuré, selon la [documentation WorkOS Sessions](https://workos.com/docs/authkit/sessions). Ne pas y recopier l’issuer de découverte OIDC du client. Le chargement corrige uniquement l’ancienne valeur exacte `https://api.workos.com/user_management/<WORKOS_CLIENT_ID>` du même client en local/development hors runtime production ; signature, émetteur et identité restent vérifiés. La cause et la régression sont documentées au ledger.
5. Le lanceur vérifie que l’API a effectivement activé l’authentification ; il ne conserve pas silencieusement une API déjà lancée sans celle-ci. Ce contrôle de configuration ne prouve ni la validité de la clé ni une connexion WorkOS : exécuter ensuite le parcours navigateur ci-dessous.

Si l’opérateur possède déjà un terminal avec les variables injectées uniquement pour l’API, conserver ce contexte : y lancer `pnpm --filter api check:env`, puis `pnpm --filter api dev`. `check:env` valide le fichier d’exemple ; le démarrage API valide la configuration effective du processus. Aucun des deux ne prouve la validité des credentials auprès de WorkOS. Lancer les surfaces dans un autre contexte sans secrets : `pnpm --filter client --filter admin --filter www dev`.

Après lancement, `/health` doit répondre `200` et `/identity/config` doit retourner `{"enabled":true}`. Un serveur déjà présent sur le port 4100 peut continuer à répondre avec l’authentification désactivée tandis que le nouveau lancement échoue. Identifier son propriétaire avant de l’arrêter, puis relancer l’API dans le même terminal contenant les secrets. Ne pas relancer toute la preview depuis ce terminal : les frontends ne doivent pas hériter des secrets. Réutiliser l’infrastructure CoverView déjà active sur les ports prévus ; deux projets Compose ne peuvent pas publier les mêmes ports simultanément.

| Usage                                  | Valeur locale exacte                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| `AUTH_API_ORIGIN`                      | `http://127.0.0.1:4100`                                             |
| Redirect URI à enregistrer dans WorkOS | `http://127.0.0.1:4100/auth/callback`                               |
| `AUTH_WALLET_ORIGIN` et retour Wallet  | `http://127.0.0.1:4101` → `/account`                                |
| `AUTH_ADMIN_ORIGIN` et retour équipe   | `http://127.0.0.1:4102` → `/account`                                |
| `AUTH_WWW_ORIGIN` et retour www        | `http://127.0.0.1:4103` → `/account`                                |
| `CORS_ORIGINS`                         | `http://127.0.0.1:4101,http://127.0.0.1:4102,http://127.0.0.1:4103` |

Les trois destinations sont sélectionnées côté serveur ; elles ne sont pas trois callbacks WorkOS. Les éventuelles URL de build `VITE_API_URL`, `PUBLIC_API_URL`, `VITE_WEBSITE_URL` et `PUBLIC_WALLET_URL` doivent correspondre aux mêmes origines. Hors loopback local, HTTPS est exigé. Le cookie est HttpOnly, SameSite=Lax et Secure en HTTPS ; les mutations contrôlent l’origine, le CSRF et une clé d’idempotence.

Ouvrir `/account` dans Wallet, se connecter par email/OTP avec une identité autorisée et vérifier la continuité avec www. Un second profil navigateur avec une autre identité doit conserver un autre ID et recevoir un refus sur l’espace du premier. Vérifier les appareils, la révocation individuelle et la déconnexion globale ; si WorkOS échoue, l’accès local est déjà retiré et l’interface conserve la révocation distante en attente. Reprendre l’opération avec la même clé d’idempotence. Consigner les résultats dans le ledger sans cookie, code OTP, token ni credential.

La session locale expire au plus tard avec la session distante, et au plus après `AUTH_SESSION_TTL_SECONDS` (huit heures par défaut). Aucun refresh token n’est conservé. WorkOS est interrogé à chaque authentification ; une indisponibilité ou une liste distante tronquée entraîne un refus. La preuve MFA vaut quinze minutes, son challenge au plus cinq minutes ; un nouvel essai nécessite un nouveau challenge.

## Procédure opérateur d’habilitation administrative

Cette procédure prépare une attribution explicite ; elle n’en exécute aucune. L’opérateur doit déjà être habilité à modifier les permissions dans l’environnement concerné. Une adresse email, un rôle de fixture, l’accès à l’interface équipe ou une organisation WorkOS ne fournit pas cette autorisation (`identity.admin.1`).

1. Faire établir une session normale par l’identité autorisée. Relever l’ID canonique retourné par `/identity/me`, puis vérifier en lecture seule que `identity_users.id` et `identity_users.workos_user_id` correspondent ensemble à cette même identité WorkOS constatée dans le bon environnement. Ne pas sélectionner le bénéficiaire par email seul.
2. Préparer une trace d’intervention précisant environnement, opérateur autorisé, bénéficiaire canonique et WorkOS, permission `administration.access`, motif et référence de preuve de l’autorisation. Cette référence non secrète sera conservée dans `identity_admin_permissions.evidence` ; une chaîne arbitraire non vide ne prouve pas l’autorisation.
3. Dans l’outil SQL déjà autorisé de l’opérateur, préparer une transaction paramétrée : créer un ID d’habilitation non séquentiel, puis insérer la permission seulement si la paire d’identifiants canonique/WorkOS correspond encore et qu’aucune habilitation active identique n’existe. Conserver la référence de preuve, contrôler qu’exactement une ligne est concernée et relire le résultat avant validation. Si le contrôle diverge, annuler la transaction et résoudre l’identité ou l’autorisation. S-000b n’ajoute ni CLI d’attribution ni route publique à cette fin.
4. Le titulaire inscrit lui-même son Authenticator depuis `/authenticator` côté équipe, accessible depuis son compte même sans permission administrative. Il lance la création, scanne le QR puis confirme son code. WorkOS conserve le facteur ; CoverView ne conserve ni seed, ni URI, ni QR. Tester ensuite `/account` côté équipe : habilitation seule insuffisante, accès après un challenge MFA distinct valide, refus de l’identité ordinaire et d’une requête falsifiant rôle ou application.
5. Consigner l’intervention et sa vérification dans la trace approuvée, sans secret. Pour un retrait autorisé, renseigner `revokedAt` sur l’habilitation exacte et conserver la ligne avec sa preuve ; vérifier le refus sur la requête suivante. Une révocation de permission n’exige pas la suppression des identités ou de leur audit.

## Parcours propriétaire Authenticator

L’API expose `/identity/mfa/enrollment` en lecture et les commandes `/start`, `/challenge`, `/confirm` et `/cancel`. Toutes les commandes contrôlent session locale et distante, propriétaire, origine, CSRF et idempotence. L’inscription et l’annulation nécessitent une authentification WorkOS datant de moins de dix minutes : l’heure vient du claim `auth_time` du JWT déjà vérifié, pas de la création locale de la session. Une session ancienne ou sans cette preuve propose `/auth/login?surface=admin&reauthenticate=true`, qui exige `maxAge: 0` chez WorkOS. Les connexions ordinaires conservent leur comportement. Les identifiants du facteur et du challenge proviennent exclusivement de WorkOS et du suivi serveur ; aucun identifiant de cible n’est accepté du navigateur.

Le QR est renvoyé une seule fois après création et seulement sous forme d’image PNG encodée, avec une expiration de cinq minutes au maximum. Exception volontaire au rejeu de réponse d’API-04 : une répétition du démarrage renvoie un conflit à relire, sans conserver le QR pour le rejouer. Le frontend le garde dans son seul état local et l’efface à expiration ou sortie ; aucune donnée de credential dans le cache TanStack ni le stockage navigateur.

Après fermeture de la page, un titulaire ayant scanné le QR peut demander un nouveau challenge du même facteur. S’il ne l’a pas scanné, il peut demander explicitement l’annulation de cette inscription inachevée puis recommencer. Aucun facteur préexistant découvert chez WorkOS n’est supprimé. Une vérification dont la réponse est incertaine ne permet pas l’annulation, car le fournisseur pourrait avoir confirmé le facteur ; seule sa confirmation peut être reprise. Une création incertaine sans identifiant conservé exige une résolution opérateur chez WorkOS et ne fabrique pas un second facteur.

La présence d’un facteur dans la liste WorkOS ne prouve pas sa confirmation : le SDK ne fournit pas cet état. L’inscription utilisateur et l’accès administratif conservent donc leurs oracles distincts au ledger.

## Données et persistance

| Catégorie / tables           | Propriétaire et classification                                          | Export, effacement et conservation                                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Utilisateur et profil        | Personne canonique ; email identifiant, ID fournisseur pseudonyme       | Contrat S-130/S-131 : export propriétaire, rectification via identité, effacement coordonné fournisseur et relations. Aucune durée juridique définie ici ; pas de suppression publique dans S-000b.                                   |
| Sessions                     | Utilisateur ; appareil et dates techniques, hash du handle sensible     | Révocation persistante ; aucune session brute ni refresh token conservé. Export futur des appareils et dates, jamais des hashes. Purge/anonymisation à raccorder à S-131.                                                             |
| Connexions et challenges MFA | Navigateur puis session ; données techniques sensibles temporaires      | State et navigateur hashés, vérificateur PKCE chiffré. Suppression à consommation ; purge des expirés par lots de 100 au démarrage d’une connexion. Aucun secret dans l’export. Sans activité, une purge planifiée reste à raccorder. |
| Habilitations                | Utilisateur concerné ; permission et référence de preuve administrative | Retrait par `revokedAt`, conservation auditée ; export/effacement selon S-130/S-131, sans durée inventée.                                                                                                                             |
| Audit                        | Acteur canonique ; action, ressource, corrélation et instant techniques | Login, MFA et révocations persistés sans secret ni email. Export/anonymisation et durée selon S-130/S-131 ; pas de suppression silencieuse.                                                                                           |
| Inscription MFA | Utilisateur canonique ; suivi technique sensible de l’opération, IDs fournisseur, état et dates | Aucun seed, URI, QR ou code. Un suivi unique empêche les créations répétées, garde les reprises et l’audit. Export/effacement S-130/S-131 ; aucun secret à exporter, aucune durée juridique inventée. |

Les migrations initiales ajoutent sept tables sans altérer les personas ; `0002` ajoute le suivi d’inscription et `0003` l’heure d’authentification signée nullable sur les sessions. Les anciennes sessions restent utilisables pour leurs capacités ordinaires ; l’inscription demande une reconnexion pour acquérir la preuve de fraîcheur. Les contraintes SQL assurent unicité, intégrité référentielle, forme des hashes et preuve d’attribution non vide. Les mises à jour de sécurité sont transactionnelles, sans appel réseau sous verrou. Les requêtes personnelles sont explicitement bornées au propriétaire ; RLS n’est pas activée dans S-000b (écart à DATA-09 DEVRAIT, contrôles applicatifs et tests d’isolation présents).

Le retour à l’application N-1 conserve les tables additives ; les supprimer ferait perdre identités et audit. Le reset local est destructif pour ces tables et requiert désormais les deux confirmations décrites dans [platform](../../platform/README.md#données-et-exploitation). Il n’est pas une procédure de rollback. Un retrait de schéma nécessiterait un export/restauration vérifié et une autorisation distincte, avant toute donnée réelle.
