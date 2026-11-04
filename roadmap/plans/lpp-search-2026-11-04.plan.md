# Recherche d’avoirs LPP du 4 novembre 2026 — page, commande, suivi Wallet

Entrée : demande de l’utilisateur du 4 novembre 2026 (premier jet).

> « Rajoute dans le site une page pour retrouver les fonds perdus LPP. Inspire-toi de la page d’accueil de Kala et ce que Kala fait. Un formulaire, ça passe la commande, comme pour le comparateur d’assurance maladie, avec le multi-step, toujours le même checkout. On demande les informations, la commande est passée, la demande est enregistrée dans le système. Il peut suivre la commande, où ça en est, dans quelle étape, et la retrouver dans son compte Wallet. Simple d’utilisation, même charte que le comparateur. Header : contenu et structure de Kala, style visuel du site ; fond animé shadergradient avec un flou par-dessus et la trame de pixels animés des offres Wallet. »

Mandat PROG-23 ([politique d’exécution](../execution-policy.md)) : meilleurs défauts, sans GO répété. Branche `claude/lpp-search`, aucun commit sur `main`, ni déploiement. Session réelle : Claude Code, Claude Opus 5.5.

## Référence Kala (lue le 4 novembre 2026)

Structure reprise, pas les contenus ni les chiffres : hero « recherche gratuite, 100 % en ligne, sans engagement » + CTA répété ; trois tuiles (problème, quand, comment) ; modèle en deux étapes (recherche gratuite, transfert facultatif) ; formulaire en 5 étapes ; « quand faire la recherche » (9 situations) ; « comment ça marche » avec et sans le service ; FAQ (Centrale du 2e pilier) ; CTA de clôture. Les chiffres de Kala (montants retrouvés, utilisateurs, avis, presse) sont les siens : **aucun n’est repris** et aucun chiffre non sourcé n’est inventé (règles du site, refus antérieur des scores inventés).

Sources publiques utilisées pour les faits : [Centrale du 2e pilier — procédure de recherche](https://sfbvg.ch/fr/missions/procedure-de-recherche) (formulaire en ligne ou PDF, résultats par la poste, appels uniquement depuis le +41 31 380 79 75).

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| L-1 | URL de la page ? | `/retrouver-lpp`, déjà au menu Audit et dans les liens éditoriaux ; elle remplace la page « en préparation » à la même URL (pas de redirection nécessaire). | `navigation.ts`, `acquisition.ts` |
| L-2 | Prix de la commande ? | Recherche **gratuite et sans engagement** ; aucun paiement dans le checkout. Étape 2 (regrouper / placer) facultative, sur rendez-vous, conditions présentées avant tout engagement, aucun tarif affiché. | Aucun tarif décidé (PROJECT.md) ; la recherche de la Centrale est gratuite |
| L-3 | Accès : invité ou Wallet ? | **Wallet obligatoire**, avec le même écran que le comparateur (« Continuer avec mon Wallet » si connecté, sinon email + code qui crée le compte). Le numéro AVS et le mandat exigent une adresse vérifiée, et la demande doit se retrouver dans Wallet. Pas de suivi invité. | Demande (« évidemment dans son Wallet ») ; DATA-14 |
| L-4 | Informations demandées ? | Identité (prénom, nom, ancien(s) nom(s), date de naissance, sexe, nationalité), n° AVS (validé 756 + clé EAN-13, même règle que le profil), adresse actuelle, téléphone facultatif ; parcours facultatif : jusqu’à 10 anciens employeurs (nom, lieu, années) et situation (départ de Suisse, etc.). | Champs usuels des demandes de recherche ; minimisation DATA-14 |
| L-5 | Mandat ? | Case explicite obligatoire : autorisation de transmettre la demande en son nom à la Centrale du 2e pilier et aux institutions concernées, version `pension-search-2026-11-04` enregistrée. Texte rédigé par l’agent : **validation juridique externe non fournie**. | G-01 : forme du consentement choisie, pas sa validation |
| L-6 | Étapes de suivi ? | `submitted` Demande reçue → `reviewing` Vérification du dossier → `search_sent` Recherche lancée (transmise à la Centrale) → `results_received` Résultats reçus → `completed` Démarche terminée ; `cancelled` avant terminaison. Chaque transition est faite par un administrateur (MFA, audit), datée dans l’historique ; aucune progression automatique ou fictive. | Modèle des demandes d’offre maladie |
| L-7 | Stockage ? | Nouveau module `pension-searches` : table des recherches (snapshot des informations, historique), défis email, commandes Admin idempotentes. Aucun brouillon serveur : le formulaire reste en mémoire de l’onglet, jamais en stockage navigateur (n° AVS). | DATA-14, G-10 |
| L-8 | Profil Wallet ? | Non modifié par la commande (le snapshot suffit au traitement) ; préremplissage depuis le profil : plus tard. | Plus petit changement cohérent (G-13) |
| L-9 | Hero ? | Fond shadergradient (couleurs CoverView), flou `backdrop-filter`, trame `PixelField` des offres Wallet reprise dans www ; mouvement suspendu hors écran, onglet caché et `prefers-reduced-motion` ; dégradé fixe sans WebGL. | Demande |
| L-10 | Disponibilité en production ? | Commande active si `PUBLIC_REQUESTS_ENABLED` ≠ `false`, comme le comparateur ; sinon la page reste lisible et le CTA l’indique. | `HealthComparator` |

## Definition of Done — oracles

- [ ] API : garde host/origine/CSRF/clé, défi email (5 essais, 10 min, 60 s par boîte), soumission idempotente liée au compte vérifié, lecture propriétaire seul, liste paginée, transitions ordonnées avec révision et rejeu — V2 Testcontainers.
- [ ] Migration générée par drizzle-kit, appliquée sur PostgreSQL vide et local — V1.
- [ ] Types, lint, frontières sur contracts, api-client, api, www, client, admin — V0.
- [ ] Builds www, Wallet, Admin — V1.
- [ ] Page et checkout dans Chromium (bureau, téléphone, mouvement réduit, erreurs) avec l’API réelle locale ; étape de code simulée faute de WorkOS local — V3 partiel.
- [ ] Wallet : liste et suivi dans Chromium avec réponses d’API simulées (session WorkOS impossible en local) — V3 partiel ; V5 titulaire.
- [ ] Admin : transition réelle via test API ; écran dans Chromium simulé — V2/V3 partiel.

## Hors périmètre (premier jet)

Envoi automatique à la Centrale du 2e pilier, dépôt de pièce d’identité et signature électronique du mandat, synthèse des résultats dans Wallet, transfert des avoirs, emails de changement d’étape, rattachement depuis un autre appareil, autres langues.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
