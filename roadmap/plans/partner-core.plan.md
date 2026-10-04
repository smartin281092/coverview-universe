# Partner — parcours opérationnel, brief du 2 octobre 2026

Statut : exécution autorisée par la demande utilisateur et PROG-23. La demande « Recommence » reprend ce même brief. Session requise : gpt-6-astra / ultra ; réglage réel non observable. Budget : une tranche verticale avant relais documenté ; aucune clôture fictive du programme existant.

## Résultat attendu

Un partenaire soumet sa candidature ; CoverView la valide explicitement. Un conseiller habilité travaille sur ses Leads, avec tâches, rendez-vous, prochaines actions et historique. L'administrateur possède une vue globale. Un client Wallet conserve son profil existant et consulte les seules offres publiées pour son dossier.

## Source et décisions

Source prioritaire : [brief consolidé intégral](../../references/coverview-partner-2026-10-02.md), parties I, II et III, conservé depuis le message utilisateur de la tâche `01a0fcaa-00c7-7063-8b17-d3a5318df184`. Client ≠ Lead ; plusieurs demandes du même client et du même produit sont légitimes. Aucune unicité métier sur client/catégorie. Aucun droit de conseil issu d'une simple candidature ou de l'appartenance à une organisation. Les prix et commissions d'exemple ne seront pas insérés comme données métier.

Les profils personnels et gérés existants restent les dossiers clients canoniques. Un contact apporté en attente de rattachement reste une demande à vérifier, sans recherche publique d'email et sans accès à un Wallet. Aucun consentement implicite. Les interfaces Admin et Wallet existantes sont conservées.

## Découpage de réalisation et suivi du périmètre intégral

1. **Cœur opérationnel** : identité et validation séparée des accès, client/Lead, pipeline/liste, fiche à onglets, tâches, rendez-vous, notes par audience, clôture motivée, droits et journal des mutations.
2. **Offres et Wallet** : source originale, données structurées et provenance, versions, revue, publication, comparateur par Lead/objet et contrat actuel, choix/questions/modifications/conservation, signature sur version et contrôle du contrat final.
3. **Distribution et continuité** : collaboration explicite, référents par catégorie, éligibilité/matching, disponibilités, attribution notifiée, règle 24 h, attentes justifiées, escalade bornée, reprise humaine et suspension des accès.
4. **Marketplace et économie** : fiches anonymisées, candidature/réservation unique, accord immuable, prix fixe OU succès, bases explicites, encaissements/réserves/reprises/rapprochement, flux CoverView distincts. Enchères inactives par défaut.
5. **Pilotage et qualité** : dashboards actionnables, vues enregistrées, statistiques définies et objectifs calculés dans le périmètre autorisé, notifications, réclamations, enquête et branchement demandé des avis, transcriptions sourcées avec accord préalable.

Chaque ligne reste ouverte jusqu'à ses preuves. Ce découpage conserve tout le brief ; il ne constitue pas cinq livraisons déjà faites. Les intégrations externes et validations métier ne sont jamais remplacées par une simulation.

## Architecture et données

Module `partner-workspace` dans l'API commune ; contrats Zod et client HTTP partagés. Surface `partners`, entrées de supervision Admin et consultation Wallet. PostgreSQL, migration additive, monnaie en centimes CHF, dates UTC, contrôles d'accès à chaque requête et sous verrou pour les mutations, révisions optimistes et clés idempotentes. Aucun accès collectif implicite. Les événements visibles sont des projections autorisées du journal persistant.

## Oracles

- V0 : types/lint des packages et applications modifiés.
- V1 : builds, migration additive sans réinitialiser la base locale.
- V2 : invariants sensibles sur PostgreSQL réel : non-validé, conseiller voisin, apporteur, client, administrateur ; concurrence/révisions, transition conditionnelle et versions d'offres.
- V3 : navigateur réel : candidatures, pipeline, création, fiche, progression, publication/lecture client quand une session autorisée est disponible. Ne pas fabriquer de données clients réelles ni de session privilégiée pour la recette.

## Protections et limites

Checkout déjà largement modifié à l'entrée : préserver toutes les modifications préexistantes. Pas de reset, nettoyage, bascule de branche ni déploiement. Les pièces originales réutilisent le stockage documentaire privé. Une analyse incertaine reste à vérifier, aucune couverture inventée. Les intégrations de signature, téléphonie, email/SMS et paiement exigent une preuve de raccordement réelle avant activation.

## Référentiels chargés

CLAUDE, PROJECT, MEMORY actives, codex, execution-policy, program, architecture, backend, API, contracts, data, permissions, security, frontend, design, brand, i18n, testing ; README identity, profiles et insurance-requests. Stockage/événements/jobs chargés à leur intégration. Marketing, Stripe et législation hors périmètre de cette implémentation du brief fourni.

## Journal

- 2026-10-02 : inspection : aucun module Partner existant ; profils, documents privés et demandes d'assurance disponibles. Travaux préexistants recensés, non remplacés.
- 2026-10-02 : première tranche implémentée dans API/Partner/Wallet/Admin ; [ADR-0010](../../adr/0010-partner-leads-wallet.md) et README propriétaires ajoutés. Migrations additives 0027/0028 générées et appliquées sans reset.
- 2026-10-02 : types des quatre applications, lint ciblé, builds API/Partner/Wallet/Admin, frontières (194 modules/750 dépendances) et Knip des quatre workspaces passent. Les 23 contrôles ciblés Partner/identité/documents passent ; les trois tests PostgreSQL Partner ont été rejoués après les corrections de transfert et passent aussi.
- 2026-10-02 : erreurs réelles corrigées pendant vérification : réponse de route Fastify mal formée, DTO de tâche/RDV trop stricts, catégories d'auto-attribution, horloge des brouillons, conservation des sources lors d'une reprise, fermeture des dialogues mobile et choix de profil sur place. Aucune règle de contrôle désactivée.
- 2026-10-02 : V3 limité à WorkOS réel, accès candidat non habilité et Wallet vide/formulaire 390 px/820 px. Compte connecté sans habilitation Partner/Admin ; aucune permission fabriquée. Import/publication/choix avec une offre réelle non vérifiés en navigateur.
- 2026-10-02 : [couverture complète et reste à faire](../partner-coverage.md), [ledger](../evidence/partner-core.md) et [reprise](../handoffs/partner-core-suite.md). La tranche et le brief ne sont pas déclarés intégralement terminés. S-042a préexistant n'est pas clôturé pour libérer artificiellement une dépendance.
