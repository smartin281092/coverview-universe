# S-042a — Demandes 3e pilier reçues de horizon3.finance

Addition urgente à la slice en cours, demandée le 14 octobre 2026. Mandat PROG-23 : implémentation et vérification locales sans GO répété ; la mise en production attend les réponses ci-dessous. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Questions bloquantes — production seulement (PROG-15)

Elles ne bloquent pas l’implémentation locale : en production, aujourd’hui, comptes, emails et travaux de fond sont coupés et Partner n’est pas déployé.

| ref | question | choix | défaut proposé |
|---|---|---|---|
| Q-1 | Mettre l’endpoint en production maintenant ? | a) non, local d’abord ; b) déployer l’API seule : les demandes sont enregistrées et dédupliquées, mais ni email ni suivi avant que comptes, emails et Partner soient en production | a |
| Q-2 | Fournisseur d’email en production ? | a) Resend (défaut MAIL-02) ; b) SMTP de l’hébergement du domaine ; c) autre | a |
| Q-3 | Contenu de l’email de notification ? | a) minimum (MAIL-06) : produit, compagnie, stratégie, montants, référence et lien vers le lead ; b) ajouter nom, email et téléphone du client | a |

## Objectif

Une commande de solution 3e pilier envoyée par horizon3.finance est enregistrée une seule fois, notifiée à `sebastien@coverview.ch` et suivie comme un lead dans Partner, attribuée à Sébastien Martin et visible de lui seul, y compris face aux autres administrateurs.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| H-1 | Où vit l’intake ? | Module partner-workspace, propriétaire des leads : table `partner_external_requests` (source, `request_id`, empreinte, données validées, lead, état d’envoi). | ARCH-11 ; précédent des demandes du comparateur |
| H-2 | Route et réponse ? | `POST /api/public/h3/contact` (Traefik transmet le chemin tel quel), corps JSON ≤ 4 Ko validé (Zod, champs inconnus ignorés), réponse 200 `{ success: true, requestId }` à la création comme à la reprise. | Contrat donné par l’utilisateur |
| H-3 | Déduplication ? | Unicité `(source, request_id)` ; même contenu → 200 sans rien recréer ni renvoyer ; même `requestId` avec un autre contenu → 422 `PARTNER_IDEMPOTENCY_REUSED`. | API-04 |
| H-4 | Montants ? | Convertis en centimes (`investment` → versement, `initialCapital` → capital initial), deux décimales au plus. | DATA-11 |
| H-5 | Notification ? | File en base relevée chaque minute (MAIL-01), destinataire `H3_NOTIFY_EMAIL` côté serveur ; échec → nouvel essai 5 min × tentatives, 10 tentatives ; envoi resté en cours > 10 min → remis en file (au moins une fois) ; plafond de 60 envois par heure (MAIL-07) ; sans fournisseur d’email, la demande reste en file sans consommer d’essai. Contenu minimal (Q-3 a). | MAIL-01, MAIL-06, MAIL-07, G-10 |
| H-6 | Attribution ? | Compte désigné par `H3_OWNER_EMAIL` : lead créé dans la même transaction, responsable et créateur = ce compte, déjà accepté, étape « À contacter », priorité haute, action « Contacter le client » sous 24 h. Sans ce compte, la demande est gardée et son lead créé dès qu’il existe (même file). | `creator_id` obligatoire |
| H-7 | Visibilité ? | Colonne `partner_leads.restricted_to` : le lead n’est visible que de ce compte, administrateurs compris (prédicat central `visible()`), exclu de la continuité (aucune réattribution ni remontée) et ses notifications ne vont qu’à lui. Politique d’exception documentée. | « seulement visible par moi » ; PERM-06 |
| H-8 | CORS ? | Pour cette route seulement : `https://horizon3.finance`, `https://www.horizon3.finance`, `http://127.0.0.1:5187`, `http://localhost:5187`, `POST`/`OPTIONS`, `Content-Type`, sans cookies. Les autres routes gardent leur CORS. | Demande explicite, SEC-04 |
| H-9 | Abus ? | 10 requêtes par minute et par adresse IP, corps ≤ 4 Ko, validation stricte des champs, aucune clé secrète (appel depuis un navigateur) : dérogation à SEC-05 (pas de signature possible). | SEC-04, demande explicite |
| H-10 | Données personnelles ? | Inventaire : nom, prénom, email, téléphone, année de naissance (identifiantes), montants (financières). Jamais dans les logs ni l’email (Q-3 a). Rétention : non définie, comme les leads (aucune durée légale déduite). | DATA-14 |
| H-11 | Auteur dans le journal du lead ? | Acteur système `partner-intake-v1`, admis par la contrainte `partner_event_actor` et le contrat des événements (ajout compatible) : le compte qui suit la commande ne l’a pas créée lui-même. | Exactitude de l’audit |
| H-12 | Autorisation de transmission ? | Non recueillie (`transmissionAuthorized: false`) : rien ne dit que le client a autorisé une transmission à un autre intervenant. Modifier le lead demande de cocher l’autorisation, comme pour tout lead. | G-01, aucune autorisation inventée |
| H-13 | Garde-fous ? | Réattribution, collaboration et marketplace refusées (403) ; contrôles masqués sur la fiche (`canAssign`, `canCollaborate`) ; aucune date de remontée annoncée ; la base refuse tout autre responsable (`partner_lead_restricted`, responsable = compte réservé ou personne). | Intégrité, défense en profondeur |
| H-14 | Compteurs Admin ? | Les compteurs de suivi du tableau Admin, qui mènent au kanban, n’incluent pas les leads réservés à un autre compte. Les statistiques par conseiller restent des agrégats sans accès au lead. | Cohérence compteur et kanban |
| H-15 | Lead impossible à ouvrir à la réception ? | La commande est gardée d’abord ; si son lead ne peut pas être ouvert (compte absent, erreur), la réponse reste 200 et la tâche réessaie chaque minute. | « Sauvegarder avant de confirmer » |
| H-16 | Client dans Wallet ? | Inchangé : s’il est un jour invité et relié, il voit sa propre demande, comme toute autre. | Accès du client à ses données |

## Definition of Done — oracles

- [x] Enregistrement, réponse, déduplication, contenu différent refusé, validation, CORS (pré-vol et réponse), limitation — V2 (tests sur PostgreSQL réel) et V3 (`curl` local, navigateur réel) (journal 1, 7, 9).
- [x] Lead attribué au compte désigné, invisible d’un autre administrateur et d’un autre conseiller, hors continuité — V2 (journal 2).
- [x] Notification envoyée une fois, reprise après échec — V2 (adaptateur de test) et V3 (Mailpit) (journal 3, 8).
- [ ] Lead visible dans le kanban Partner du compte désigné — V2 fait (liste du compte, journal 2) ; V5 à faire par l’utilisateur, avec un compte qui ouvre Partner (note locale).
- [x] Migration sauvegardée puis appliquée ; types, lint, suite API complète (journal 4 à 6).

## Note locale

En local, `sebastien@coverview.ch` existe sans accès Partner (ni administrateur, ni membre approuvé) : les commandes locales lui sont attribuées mais restent invisibles dans le Partner local. Pour les voir, poser `H3_OWNER_EMAIL` dans le `.env` local sur le compte avec lequel Partner est ouvert, puis relancer l’API.

## Hors périmètre

- Mise en production (Q-1), fournisseur d’email réel (Q-2), SPF/DKIM/DMARC (MAIL-05).
- Effacement et export des demandes externes (droits RGPD) et durée de rétention.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Contrat HTTP | `partner-intake.test.ts` sur PostgreSQL réel (Testcontainers) | pré-vol des quatre origines (POST, OPTIONS, Content-Type, sans credentials) ; origine étrangère sans en-tête ; autres routes fermées à horizon3 ; 200 puis reprise 200 sans nouvelle ligne ; autre contenu 422 ; 9 refus 400 sans écriture ; 413 au-delà de 4 Ko ; corps texte 400 ; 11e requête de la minute 429 | — |
| 2 | Lead réservé | même fichier | fiche et liste du compte désigné (casse de l’adresse ignorée) ; autre administrateur et conseiller approuvé : 404 et absent de la liste ; réattribution 403, base 23514 ; continuité : le lead témoin quitte son responsable, le lead réservé reste ; rappels au seul compte ; notifications d’un autre administrateur sans ce lead | — |
| 3 | Avis interne | même fichier | sans adaptateur : en file, aucun essai ; refus puis nouvel essai après 5 min ; 2 avis puis plus rien ; aucun nom, email ni téléphone ; envoi interrompu renvoyé ; 10e refus : `failed` ; plafond de 60 par heure ; lead ouvert dès que le compte existe, une seule fois | — |
| 4 | Suite API complète | worktree figé, commit 195a9da | 82/82 fichiers, 795/795 tests (1 043 s) | — |
| 5 | Contrôles | `tsc` API et contrats, ESLint des fichiers touchés, dependency-cruiser | verts ; knip : 7 fichiers inutilisés et un doublon d’export, identiques sur `main` 9607f1f (préexistants, G-07) | — |
| 6 | Migration locale | sauvegarde `pg_dump` (148 tables de données listées), puis `db:migrate` | 84 migrations ; colonne `restricted_to` et table `partner_external_requests` présentes | — |
| 7 | API locale | `curl` depuis l’origine `http://127.0.0.1:5187` | pré-vol 204 (origine exacte, `POST, OPTIONS`, `Content-Type`, max-age 600) ; 200, reprise 200, autre contenu 422, corps invalide 400 ; commande gardée une fois ; lead « 3e pilier · Jeanne Exemple » (données fictives) réservé au compte local `sebastien@coverview.ch`, accepté, « À contacter », événement `partner-intake-v1` | — |
| 8 | Avis réel | Mailpit local | avis reçu environ 25 s après, adressé à `sebastien@coverview.ch`, gabarit `horizon3-request-v1`, lien vers le lead ; ni nom, ni email, ni téléphone | — |
| 9 | Navigateur réel | page servie sur `http://127.0.0.1:5187` dans le navigateur intégré | `fetch` 200, reprise 200, 422 lisible par la page, autre route de l’API bloquée par CORS ; 250,50 CHF par mois gardés en 25 050 centimes, capital absent affiché « aucun » | kanban V5 |
