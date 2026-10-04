# Modes, disponibilités et absences déclarés

Les [modes explicitement partagés](shared-modes.md) ont désormais leur propre déclaration et leur propre audience. Ce dossier reste privé, y compris ses modes ; aucune synchronisation, importation ou publication rétroactive.

Le [bilan minimal du référent](referent-assessment.md) précise les comparaisons autorisées dans les audiences actuelles du Lead et les sources qui restent privées.

## Résumé et périmètre

Le [bilan personnel d'adéquation](advisor-assessment.md) compare le seul mode déclaré au souhait courant du besoin, dans l'audience personnelle existante ; il n'utilise pas les plages pour conclure sur la disponibilité ou la capacité.

Cette capacité couvre la déclaration personnelle des modes proposés et de périodes datées de disponibilité ou d'absence, selon I.4/5/10.2–10.4/11.2/12/18/20 du [brief intégral](../../../../../../references/coverview-partner-2026-10-02.md). Elle ne fournit pas encore de créneau réservable : durée, préparation, déplacement, capacité et engagements externes restent à examiner. Le souhait du client appartient aux [préférences du besoin](advice-preferences.md), les langues/cantons à [practice](professional-practice.md), les rendez-vous convenus et délais au README propriétaire.

## Règles métier et invariants

Le membre possède un dossier personnel après sa candidature, y compris avant approbation et pendant suspension ; aucun droit opérationnel n'en découle. Les quatre modes reprennent l'enum canonique des rendez-vous (téléphone, visioconférence, bureau, domicile). Une liste vide signifie non renseigné. Aucun mode/plage initial n'est inféré des textes libres, du domicile, du calendrier24h, de l'approbation ou des rendez-vous existants.

Défaut délégué : jusqu'à60 plages datées, chacune de366jours au plus, début inclus et fin exclue, avec type `available` ou `absent`. Les plages de même type ne se chevauchent pas ; des plages adjacentes sont permises. Une absence peut recouvrir une disponibilité et prime dans leur interprétation. Hors plages : non renseigné, jamais libre par défaut. Aucune récurrence, capacité ou motif personnel n'est collecté. Le fuseau Europe/Zurich est explicite et les instants sont stockés en UTC ; le formulaire refuse une heure locale inexistante ou répétée au changement d'heure. L'API reçoit toujours un instant avec offset explicite.

Chaque confirmation remplace la déclaration courante complète et ajoute une version immuable avec les parties, l'organisation canonique, la révision professionnelle et la date. Retirer une plage ou tous les modes/plages exige la même confirmation ; les versions antérieures restent consultables. La [portée professionnelle](professional-scope.md) suit les changements de parties/catégories et les aller-retour. Après changement, l'ancienne déclaration est indiquée inapplicable et n'est pas préremplie pour une nouvelle confirmation.

La révision propre de déclaration n'altère aucune candidature, habilitation, preuve de compétence/convention, préférence de client, référent, Lead, horloge, notification ou rendez-vous. Une absence nouvellement déclarée ne supprime ni ne reporte un engagement existant. Le contrôle actuel de chevauchement des rendez-vous reste en place ; son raccordement à la confirmation de nouveaux engagements, la capacité et le matching restent ouverts. Le contrôle personnel des engagements est décrit dans le document lié ci-dessous. L'interface l'explique avant confirmation. Aucun critère de continuité n'est retiré de `missingChecks` et aucune plage privée n'est projetée dans Wallet ou un Lead.

## Permissions, API et concurrence

GET/POST `/partner/availability/:userId`, GET avec `beforeRevision` facultatif : lecture personnelle ou Admin avec `administration.access` et MFA récent, écriture personnelle seulement. Un responsable d'organisation ou un collègue n'obtient pas ce dossier, même dans la même organisation ; Wallet est refusé. Un compte Partner fermé peut consulter son historique mais ne peut plus déclarer. Le retrait de session/permission s'applique aussi au rejeu.

Host/origine/CSRF/idempotence utilisent les frontières existantes. La transaction verrouille acteur/session puis membre, recontrôle révisions professionnelle et de déclaration, et écrit version/périodes/audit atomiquement. Même clé et contenu : projection actuelle autorisée, sans duplication ; autre contenu sur la même clé : refus. Deux écritures nouvelles sur une même révision ne gagnent pas ensemble. L'historique est paginé par20 ; le courant demeure celui de la dernière version, quelle que soit la page. Les lectures du membre en partage empêchent l'assemblage de périmètres concurrents ; agrégation SQL bornée par20 versions/60 périodes, sans requête par plage.

## Parcours et exploitation

Partner → Profil ou Agenda → « Modes et disponibilités ». Admin ouvre la même consultation depuis Candidatures dans Partner, par l'entrée de supervision existante. Dialogue de consultation, formulaire RHF/Zod, puis historique et détail remplaçant le contenu du dialogue. Confirmation non précochée, révisions d'ouverture conservées, commande et clé figées en cas de réponse incertaine ; conflit impose relecture. Erreur d'accès masque les données et l'historique sélectionné est dérivé de la réponse courante. Cache privé utilisateur/session/cible, sans stockage navigateur persistant, rafraîchi toutes les10secondes et supprimé à fermeture.

Migration additive0045 : `partner_availability_declarations` et `partner_availability_periods`, références membre/organisation, unicité des versions/positions, contraintes de portée, modes, fuseau, type et bornes temporelles. Les chevauchements de même type et codes dupliqués sont contrôlés par les contrats serveur. Aucun backfill et aucune réécriture de0044. Audit privé `availability.declared.v1`, sujet = version, texte vide et aucun Lead ; aucun fanout, notification, room, worker, transport ou fournisseur ajouté.

Appliquer0045 avant l'API et les interfaces. Une ancienne API ignore cette capacité ; rollback par fermeture des entrées et conservation des tables/preuves, correctif en avant sans suppression. S-130/S-131 : métadonnées professionnelles identifiantes et périodes potentiellement privées, sans motif d'absence. Export/rétention/effacement restent à implémenter ; aucune durée juridique ni effacement automatique promis. Dérogation RLS héritée de l'architecture actuelle, avec contrôles propriétaires et oracles PostgreSQL. Aucun paquet ou variable nouveau.

## État réel et vérification

Extension7db2 : [création personnelle d'un rendez-vous](appointment-creation.md) sous couverture complète et contrôles partagés, attestations explicites et temps protégé atomique. Aucune publication des plages ni disponibilité externe déduite.

Extension9ff1 : [protéger préparation et trajets d'un rendez-vous](appointment-time.md) exige la couverture déclarée de tout l'intervalle et l'absence de conflit. Cette commande personnelle distincte ne transforme pas les plages en créneaux réels/réservables et ne modifie pas leur audience. Une absence ultérieure n'efface aucune protection existante.

Le [contrôle privé des rendez-vous convenus](appointment-assessment.md) rapproche désormais cette déclaration des engagements du conseiller, sans les modifier ni les déclarer réservables. Il ne publie pas les plages à une nouvelle audience ; la capacité et le matching restent ouverts.

Implémentation et oracles dans [le ledger908d](../../../../../../roadmap/evidence/partner-core.md#relais-908d--modes-et-disponibilités-déclarés). La migration locale conserve les données, et la base ne possède encore aucun membre/Lead/déclaration réelle. Les tests utilisent uniquement PostgreSQL Testcontainers et des identités synthétiques isolées.

V3 rempli/clavier/mobile non effectué : fichier WorkOS configuré et trois valeurs nécessaires absents au contrôle booléen. Aucun callback précédemment refusé retenté, aucune session/habilitation/donnée client réelle fabriquée, aucun runtime908d lancé. Réservation Wallet, calendrier interactif complet, récurrences, capacité, préparation/déplacement, conflits et matching restent ouverts ; le brief/S-110/S-042a n'est pas clos.
