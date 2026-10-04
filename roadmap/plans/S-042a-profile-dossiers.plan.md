# Dossiers par profil, activités et portée globale Wallet

Demande du 11 septembre 2026 ; exécution autorisée par l’utilisateur et la préférence d’autonomie. Suite de S-042a, sans clôture artificielle des travaux précédents.

## Résultat attendu

- Admin : annuaire comprenant une entrée par profil, compte de rattachement explicite et transfert administratif d’un dossier vers un compte existant. Une mutation réelle de compte client n’est pas nécessaire à la recette et ne sera pas exécutée sur les données du poste.
- Dossier Admin : onglets Profil, Documents, Contrats, Activités. Générales/Finances/Santé sont les sous-onglets de Profil. Activités : cartes de tâches avec détail, notes, tâches, événements et rendez-vous internes persistants.
- Wallet : sélection globale dans l’en-tête, Tous les profils et création de profil. Documents, contrats, actions, profils et autorisations suivent le choix. Les comptes/connexions restent des ressources du compte. Les documents dont l’attribution reste indéterminée apparaissent seulement dans la vue consolidée, jusqu’au choix explicite.

## Répartition et frontières

Wallet frontend : agent wallet_profile_scope. Admin onglets et activités : admin_dossier_activities. Annuaire/transfert : profile_transfer. Root : API de filtrage, intégration, migrations et vérifications transverses. Fichiers partagés contracts/index et api-client/index, composition serveur et migrations réservés au root. Préserver les modifications non committées antérieures.

Portée URL proposée : `profile=all|self|prf_…` ; les anciens liens `person=` explicites sont compatibles. Les filtres sont validés côté API et dans les clés de cache, pas uniquement dans l’affichage. Le transfert nécessite administration.access + preuve MFA valide, verrous ordonnés source/destination, révision, idempotence, audit et couverture des originaux/données liées. Les preuves historiques conservent leur signataire ; changer de compte ne doit pas créer de consentement ni réattribuer une signature.

## Données et vérification

Nouvelles données d’activités internes et commandes/audit ; migration additive à générer. Aucun envoi d’invitation/calendrier/email externe et aucun appel IA de recette. Limites des listes et du nombre de profils conservées. Le transfert doit retirer l’accès à l’ancien compte et garantir l’accès aux octets au nouveau sans réécrire un original.

Oracles : tests PostgreSQL isolés des transferts, permissions, reprise et filtrage ; types/lint/build API/Admin/Wallet ; contrôle réel des interfaces existantes et création/gestion via données de test isolées. Migrations appliquées seulement après génération, inspection et validation. Documentation de réversibilité et limites dans le ledger final. Satellites : sécurité, permissions, données, API/contrats, backend/frontend, stockage, jobs, i18n, tests et READMEs propriétaires ; hors périmètre marketing, paiements et hébergement.

## Journal

Inspection initiale : tous les dossiers privés portent déjà un propriétaire et un profileId, mais les projections de compagnies/contrats sont encore limitées à self ; résumé et navigation des actions n’acceptent pas encore le filtre global. Les interfaces sont réparties entre trois agents, intégration centrale en cours.

11 septembre, intégration : filtres API/clients pour documents, contrats, compteurs, détails et navigation des actions ; agrégation des contrats séparée par profil. Modules annuaire/transfert et activités intégrés au serveur et aux contrats partagés. Migration additive `0018_many_blur.sql` inspectée, validée sur PostgreSQL isolé puis appliquée à la base locale existante ; API relancée avec authentification réelle. Les contraintes composites ciblées sont différables mais restent immédiates pour les commandes ordinaires.

Vérifications intermédiaires passées : types API et api-client, lint ciblé, dependency-cruiser et knip ; 18 tests de ciblage documentaire/projection assurance/actions ; 18 tests contrats/client/actions après extension des assertions. Quatre tests PostgreSQL de transfert passent (dossier complet, accès aux octets côté nouveau propriétaire, refus source, signatures révoquées avec reçu intact, idempotence, permissions, rollback), renforcement concurrence en cours. Parcours réel Wallet confirmé par agent : vue Tous, changement de profil, documents et compteurs filtrés, navigation Profil conservant la sélection. Tests des activités et contrôles intégrés finaux encore en cours ; ledger final à compléter.

Vérification finale : six tests PostgreSQL de transfert, cinq d’activités et dix assurance/Admin passent ; dix tests frontend passent. Types, lint, builds des trois apps et frontières intégrées passent. Recettes authentifiées Admin/Wallet terminées en lecture et dialogues sans soumission ; aucune mutation de dossiers réels. Écritures des trois agents achevées. Résultats, migration, réversibilité et limites : [ledger final](../evidence/profile-dossiers.md). Cette extension est terminée ; les critères globaux S-042a restent dans leur plan existant.
