# Modes de rendez-vous explicitement partagés

## Périmètre et parcours

Propriétaire : partner-workspace, brief I.10.2–10.4/12/18/20. Partner → Profil → « Modes partagés avec mes clients » permet de publier une déclaration personnelle, de la retirer et de consulter son historique. Admin consulte le dossier depuis Candidatures dans la supervision Partner. Wallet et lecteurs opérationnels consultent le seul résumé courant dans les sources du [bilan du référent](referent-assessment.md).

Cette déclaration est distincte des [modes et disponibilités privés](professional-availability.md). Aucune valeur privée n'est importée, précochée ou publiée rétroactivement. Les deux déclarations peuvent différer : la comparaison personnelle conserve sa propre source. Aucun créneau, engagement, disponibilité réelle, capacité, certification ou réservation n'est déduit du partage.

## Audience et confirmation

**partner.shared-modes.1** — Le membre choisit explicitement un à quatre modes canoniques : téléphone, visio, bureau, domicile. Le formulaire montre les parties et catégories actuelles, l'audience et les limites avant une confirmation non précochée. Le contrat strict exige `confirmed:true` et l'audience versionnée `confirmed-referent-leads-v1` ; toute future extension d'audience exige une nouvelle confirmation et une évolution compatible.

Audience du résumé : propriétaire Wallet canonique courant et lecteurs opérationnels déjà autorisés des besoins où ce membre est le référent confirmé pour la catégorie. Le choix de référent n'accorde aucun accès supplémentaire à un Lead. Aucun annuaire, recherche publique, accès de collègue au dossier, marketplace ou effet économique. L'équipe CoverView autorisée peut consulter le dossier/historique ; elle ne peut pas confirmer pour un tiers.

**partner.shared-modes.2** — La publication reste personnelle après candidature, y compris avant approbation ou pendant suspension, sans droit opérationnel induit. Un compte fermé ne peut plus publier ; il peut encore retirer son partage courant. Le retrait exige une confirmation explicite, crée une version à modes vides et ne supprime pas les anciennes preuves. Une nouvelle publication est nécessaire pour reprendre le partage.

## Portée, droits et cohérence

Chaque version fige membre, organisation, noms, catégories, révision professionnelle, modes, action, audience et date. La [révision professionnelle monotone](professional-scope.md) invalide une publication après changement ou aller-retour des parties/catégories. Une ancienne version ne redevient jamais courante automatiquement ; l'interface ne préremplit aucun mode de portée modifiée. La révision de partage et la révision professionnelle affichées sont recontrôlées sous verrou avant écriture.

GET/POST `/partner/shared-modes/:userId`, GET avec `beforeRevision` facultatif. Lecture personnelle ou Admin avec permission et MFA actuel ; écriture personnelle seulement. Wallet, voisin et manager même organisation sont refusés pour ce dossier. Les gardes existants host/origine/CSRF, session et idempotence s'appliquent à chaque requête et au rejeu.

Acteur/session puis membre verrouillés ; déclaration, commande et audit privé atomiques. Deux écritures sur la même révision ne gagnent pas ensemble. Rejeu exact : relit droits et état courant, sans republier une ancienne version après retrait ; même clé/autre contenu refusé. Historique par20, courant indépendant du curseur. Dossier et historique sont lus sous verrou partagé du membre ; le bilan minimal utilise son instantané repeatable read existant.

## Projection et compatibilité

**partner.shared-modes.3** — GET `/wallet|partner/leads/:id/referent-assessment?version=2` ajoute `sharedModes` au bilan d'un référent actuel : état, modes et date seulement. Sans publication actuelle, les modes sont vides et la date nulle. États distincts : manquant, retiré, portée modifiée, déclaré. Aucun historique, révision professionnelle, original, plage/absence ou détail d'autre besoin n'est partagé.

Le mode souhaité actuellement confirmé est comparé aux seuls modes explicitement partagés. Présence = correspondance déclarée ; absence dans une liste publiée = écart ; souhait absent/périmé ou déclaration manquante/retirée/inapplicable = inconnu avec raison. Priorités client, clôture et choix invalide conservent l'absence de bilan candidat. Les autres critères restent indépendants et les six vérifications restantes demeurent ouvertes.

Sans paramètre ou avec `version=1`, le contrat initial conserve son mode littéralement inconnu et ne lit pas la nouvelle table. Les nouvelles interfaces demandent explicitement v2. Déployer0047, puis API, puis interfaces ; les anciens clients restent compatibles. Le bilan personnel et le détail partagé du Lead ne changent pas de source.

## Interface et exploitation

Dialogue borné, vues de consultation/formulaire/historique remplaçantes, RHF/Zod. Cache par utilisateur/session/cible sans persistance, gcTime0, relecture10s et bouton manuel. Toute erreur masque données et historique ; les détails viennent de la réponse courante. Révisions d'ouverture et commande/clé figées pour retry ; conflit impose relecture. Modes partagés courants seulement préremplis lors d'une republication, confirmation toujours vide.

Migration additive0047 : table `partner_shared_modes`, versions uniques par membre, FK membre/organisation, contraintes de révisions, parties, catégories, action/modes et audience. Aucun backfill et aucune modification SQL/métadonnée antérieure ; seule nouvelle entrée ajoutée au journal Drizzle. Migration appliquée deux fois dans PostgreSQL isolé, jamais sur la base partagée.0046 y reste également non appliquée.

Audit privé `modes.shared.v1` ou `modes.withdrawn.v1`, auteur personnel, sujet=version, texte vide et aucun Lead. Aucun événement client, notification, job, room, fournisseur ou variable ajouté. Lead, préférences, horloges, rendez-vous, disponibilités privées, compétences et conventions inchangés. RLS héritée conservée ; métadonnées identifiantes, rétention/export/effacement S-130/S-131 ouverts sans nouvelle durée juridique. Rollback : fermer les entrées de partage/v2 et conserver les tables/preuves ; anciens clients v1 disponibles.

## État réel

Preuves, diagnostics et limites dans le [ledgere366](../../../../../../roadmap/evidence/partner-core.md#relais-e366--modes-de-rendez-vous-partageables). Tests PostgreSQL isolés et deux revues statiques du même agent, aucune indépendance revendiquée. V3 rempli/clavier/mobile non effectué faute de nouvel accès WorkOS ; aucune session/grant/client réel fabriqué, callback historique retenté ou service partagé modifié. Tous tracks du brief, S-110 et S-042a restent ouverts.
