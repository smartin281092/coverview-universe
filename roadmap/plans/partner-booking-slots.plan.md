# Plan — Créneaux personnels proposés puis réservés dans Wallet

Statut : autorisé par le mandat intégral « Recommence », PROG-23 et execution-policy ; aucun nouveau GO. Session demandée : gpt-6-astra / ultra ; réglage effectif non observable. Budget : une tranche, puis un unique successeur, sans sous-agent.

## Objectif et contexte

I.12 / II.5 / II.8 du [brief intégral](../../references/coverview-partner-2026-10-02.md) : un conseiller personnellement mandaté propose de un à cinq horaires exacts ; le propriétaire Wallet du sujet choisit et confirme un seul rendez-vous. Réutiliser les contrôles et le temps protégé acquis. L’accord de rendez-vous ne certifie ni adéquation ni distribution ni matching complet.

Restauration entrante 1bc1 vérifiée indépendamment avant code : HEAD 4fef49a095739260b9ab9d1becc1a2bf3320a928, 698 WIP / 43 830 587 octets, arbre 1 737, 126 fichiers protégés et 70 tests/specs. Preuves ignorées : .planning-local/restoration-verification.json et incoming-baseline.json.

## Décisions déléguées

- Auteur : conseiller approuvé et organisation approuvée, périmètre professionnel courant, responsable accepté ou contribution advice éditable/contactable sur cette demande ouverte. Aucune substitution d’acteur/session et aucun advisorId fourni par Wallet. La consultation professionnelle est personnelle.
- Proposition immuable de 1–5 options exactes, publication après contrôle individuel et attestations personnelles non précochées (engagement d’honorer le choix, engagements extérieurs, capacité, préparation/déplacements). Expiration choisie, future, au plus sept jours et avant le début occupé de toutes les options. Bornes techniques réversibles ; rayon d’impact : validation/UX seulement.
- Une proposition active par demande. Expiration/retrait/invalidation libèrent ce droit de proposer ; aucune option n’occupe l’agenda avant réservation. Le client est averti de cette revalidation nécessaire.
- Réservation unique et idempotente, atomique : droits/sujet/habilitation/mandat/sources/préférences/horloge/chevauchement recontrôlés après les verrous. Versions et invalidation monotone empêchent une ancienne proposition de redevenir utilisable après aller-retour. Disponibilité déclarée et attestations restent déclaratives.
- Création du rendez-vous et de son temps protégé, preuves des deux accords conservées. Annulation/report/liaisons existants utilisables ensuite. Aucun rattachement automatique aux autres Leads du même client/catégorie.
- L’origine suit la création de rendez-vous existante pour le jalon et la première action utile. Toute action existante ou attente et son échéance sont conservées ; l’action standard de rendez-vous est créée seulement si aucune n’existe. Aucun changement des autres Leads, tâches, attribution, offres ou économie.
- Wallet ne reçoit que les modalités partagées, le nom du conseiller, l’expiration et l’état. Ni buffers, ni preuves privées, ni autres Leads. Parcours dans les dialogues existants, cache privé éphémère, masquage des données après erreur, commande exacte conservée lors d’une réponse incertaine.

## Périmètre et oracles

API Partner/Wallet, contrats/client API, Partner/Wallet UI et traductions ; migration additive 0056 hors catalogue normal. Toutes les migrations entrantes et pending 0049–0055 inchangées. Aucune dépendance ajoutée, aucun job/room/externe. Événements privés de preuve et événements client de proposition/réservation/retrait, notifications durables existantes.

- [x] V0 types/lint ciblés, frontières et knip quatre workspaces.
- [x] V1 builds API/Partner/Wallet/Admin ; génération 0056 avec trois globs et catalogue complet temporaire, seconde génération sans delta, migrations deux fois PostgreSQL18 jetable.
- [x] V2 nouveau test isolé : contrats, droits, publication/choix, expiration, retrait, confidentialité, idempotence, concurrence réelle, sources/mandat/sujet aller-retour, collisions temps protégé, rollback et conservation cycles ; régressions acquises inchangées.
- [x] Deux revues statiques du même agent (sécurité/concurrence puis UI/diff), sans indépendance prétendue.
- [ ] V3 parcours authentifié rempli si accès autorisé disponible ; sinon déclarer non effectué sans auth/MFA/session/grant fabriqué, ni reprise callbacks/montages invalidés.
- [x] Propriétaires, ledger, coverage, mémoire, seule S-110.notes + deux vues générées ; checkpoint 8 sections/11848caractères, snapshot cumulatif non secret et audit source/entrant/protections/tests. Instruction ultérieure : politique d’exécution et plan des quatre lots mis à jour pour Astra Max. Le relais unique et le gel sont effectués par les outils de coordination après cette préparation, sans réécriture ultérieure.

## Satellites et limites

CLAUDE, PROJECT, docs/codex, execution-policy, MEMORY, brief intégral, index produit, plans/ledger/coverage pertinents ; API/contracts/backend/data/auth/permissions/security/frontend/design/brand/i18n/testing/architecture/conventions/evolution/program/environment/documentation/memory/delivery/events et README/propriétaires acquis lus. Pas de stockage/LLM (aucune extraction). Bases partagées, services/préviews anciens, anciens worktrees et D:/Projects intouchables. Aucun commit WIP/push/deploy/stash/reset/clean/archive. S-110/S-042a/brief ouverts ; tous les autres tracks I–III restent mandatés.

## Journal de vérification

| # | Cible | Oracle | Observé | Décision |
|---|---|---|---|---|
| 1 | Restauration | audit indépendant SHA/bytes/arbre/HEAD/status | conforme | code autorisé dans 811d seulement |
| 2 | Dépendances locales | installation figée sans scripts | 1121 paquets, réussie ; Node24.13.1 < moteur24.20 hérité | ne pas modifier le moteur/lockfile |
| 3 | V2 nouveau parcours | booking-initial.json | 0/18 ; paramètre SQL $1 inutilisé dans branche professionnelle, fixture attente mal encodée JSON | typer le paramètre, corriger seulement la nouvelle fixture ; aucun test hérité modifié |
| 4 | V2 nouveau parcours | booking-second.json | 15/18 ; trois oracles nouveaux mal formulés (rejet synchrone, enum attribution, expiration antérieure à création) | changement de stratégie : lire contraintes, cibler ces trois cas avant régressions ; aucun garde affaibli |
| 5 | Trois cas isolés | booking-focused.json | 3/3 exécutés verts, 15 non sélectionnés non crédités | campagne complète |
| 6 | Lint 17 fichiers TS/TSX | ESLint | 18 erreurs : résultats SQL non typés dans nouveau test, séparateurs UI hors i18n | typer fixtures et externaliser les modalités ; seconde exécution verte |
| 7 | API types après typage fixtures | TypeScript | rows[0] potentiellement absent, 9 erreurs | assertions non nulles dans oracles seulement ; nouvelle vérification |
| 8 | Nouveau parcours + héritage | booking-regressions.json | 124/124,7 fichiers,161538,74ms ;18 nouveaux,106 hérités inchangés | campagne réussie, répétition inutile |
| 9 | V1 migration | catalogue temporaire normal+0049–0056 |98tables, seconde génération sans delta ; migrate deux fois PostgreSQL18 dans nouveau test |0056 seulement hors catalogue, aucune base partagée |
| 10 | V0/V1 | types quatre apps, lint17TS/TSX, builds quatre apps, frontières/Knip ciblé |verts ;623modules/2955dépendances,0erreur et3orphelins www hérités |warnings ApplicationPage/chunks Wallet/Node hérités conservés ; Knip global non relancé |
| 11 | Audit final/relais | SHA/tailles/bytes/arbre/status + roadmap check |710WIP,arbre1748 après ajout du plan de lots et modification autorisée de la politique,1737entrants conservés,129protections/71tests pour suite ; seul S-110.notes et deux vues générées dans l’état machine |source1bc1 et snapshot entrants inchangés ; gel dès dispatch |

Revue statique sécurité/concurrence du même agent : droits personnels/owner courants, scopes immuables, absence de session fabriquée, membre et contributions verrouillés, profil/session/horloge recontrôlés, sources et collisions, proposition/réservation/idempotence atomiques, absence de fuite de buffers. Verrou explicite des contributions ajouté avant la campagne complète. Trois attentes PostgreSQL réellement observées (profil/transfert, profil/expiration, session/expiration), plus deux courses de réservation concurrente.

Revue statique parcours/diff du même agent : descriptions d’ajout sans accord client fictif, attestations vides, choix exact, retrait, états bornés, cache privé et erreur masquante ; composant de commande maintenu malgré erreur GET de la demande dans Partner/Wallet, première commande et clé réutilisées. Pas de doublon d’agenda. Audit différentiel :126protections/70tests entrants identiques,1737fichiers entrants conservés, arbre/source1bc1/HEAD/status inchangés. V3 authentifié rempli/clavier/mobile **non effectué** ; aucune activation déclarée, aucune tentative callback/runtime/auth interdite.

## Brouillon de suite

Instruction ultérieure explicite du 3 octobre : prochaines tâches gpt-6-astra / max, pas ultra ; regrouper en environ3–5tâches. Le [plan des quatre lots](partner-remaining-batches.plan.md) remplace le précédent candidat isolé qualité. Le prochain relais réalise le lot1 Conseil et orchestration, avec plusieurs parcours cohérents dans la même tâche, puis transmet les lots restants sans réduire le brief I–III. La session de la tranche déjà réalisée reste rapportée telle qu’observée.
