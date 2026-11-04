# Recherches d’avoirs LPP

Propriétaire des recherches d’avoirs du 2e pilier commandées depuis la page publique `/retrouver-lpp`, suivies dans Wallet et traitées dans Admin (4 novembre 2026, [plan et décisions L-1 à L-10](../../../../../roadmap/plans/lpp-search-2026-11-04.plan.md)). L’identité et la session appartiennent à [identity](../identity/README.md) (WorkOS Magic Auth) ; ce module ne crée ni profil ni dossier de personne.

## Parcours

La commande demande un compte Wallet vérifié (L-3). Une session canonique déjà ouverte avec la même adresse suffit ; sinon l’email reçoit un code qui crée la session CoverView, comme le checkout du comparateur. La recherche est gratuite : aucun montant, aucun paiement. Le formulaire n’est jamais conservé côté serveur avant l’envoi ni dans le stockage du navigateur.

Une soumission enregistre un instantané des informations (identité, n° AVS, adresse, parcours facultatif), l’adresse du compte et la version du mandat accepté (`pension-search-2026-11-04`, case explicite obligatoire). Elle n’envoie rien automatiquement à la Centrale du 2e pilier : l’équipe s’en charge et enregistre l’étape.

États : `submitted → reviewing → search_sent → results_received → completed`, ou `cancelled` avant terminaison. Un administrateur habilité avec MFA applique une seule étape à la fois ; chaque transition est datée dans l’historique et la commande gardée avec son acteur. Wallet relit la base toutes les 15 secondes quand la page est visible. Aucun événement, room Socket.IO, job BullMQ ni email de changement d’étape.

## Accès et contrats

Routes `GET /pension-searches/browser`, `POST /pension-searches/{email,verify-email}`, `POST /pension-searches` (commande), `GET /pension-searches` et `/:id` pour le propriétaire ; `GET /admin/pension-searches[/:id]` et `POST /admin/pension-searches/:id/transition` avec audit d’accès administrateur. Contrats dans `@coverview/contracts/pension-searches`, client typé `@coverview/api-client/pension-searches`.

Cookie opaque HttpOnly `cv_pension` (préfixe `__Host-` en HTTPS), empreinte seule en base : il ancre le CSRF et le code email avant qu’une session existe. Host, origine, CSRF et clé UUID sont contrôlés sur chaque mutation ; commande et lecture exigent en plus la session du compte. Connaître un identifiant ne suffit jamais : la lecture filtre par `user_id`.

Code email : un par minute et par boîte (tous navigateurs confondus), 10 minutes, cinq tentatives, rejeu de clé sans second envoi. Commande idempotente par `(user_id, clé)` ; même clé avec un autre contenu : `PENSION_SEARCH_IDEMPOTENCY_REUSED`. Transitions : révision optimiste, étape suivante seulement, rejeu de clé sans effet, permission et MFA revérifiées dans la transaction.

## Données

Migration additive 0085 : `pension_searches`, `pension_search_challenges`, `pension_search_commands`. PII (DATA-14) : `details` contient nom(s), date de naissance, sexe, nationalité, **n° AVS** (identifiant sensible, validé 756 + clé EAN-13 par la même règle que le profil), adresse, téléphone et anciens employeurs ; `email` est identifiant. Rien de cela n’est journalisé. Les codes expirés sont supprimés par passes bornées de 100 lignes (`SKIP LOCKED`) ; les recherches ne le sont jamais par cette maintenance. Rétention, export et effacement restent à définir avec la politique de confidentialité (LAUNCH-02) : une future procédure d’effacement devra supprimer ou anonymiser `details`.

Rollback applicatif : revenir au code précédent et conserver les tables. Aucune nouvelle variable d’environnement.

## Vérifier

`pnpm --filter api test src/platform/pension-searches.test.ts` (PostgreSQL réel par Testcontainers) : gardes HTTP, code email, idempotence, propriété, transitions, MFA. Sans WorkOS, l’envoi de code répond `unavailable` : ces tests ne prouvent aucune livraison d’email réelle. Limites et preuves : [journal du plan](../../../../../roadmap/plans/lpp-search-2026-11-04.plan.md#journal-de-vérification).
