# Examen personnel des conflits par besoin

## Sens, informations et audience

Propriétaire : partner-workspace ; brief I.10.3/18/20 et II.9. Fiche Lead → Mon adéquation → Examiner mes conflits. Déclaration humaine privée pour un besoin, distincte des chevauchements d'agenda et de la [capacité par besoin](need-capacity.md). Trois positions : aucun conflit bloquant identifié **dans le périmètre examiné**, conflit bloquant déclaré, éléments à clarifier. Aucun score, détection exhaustive, certification juridique ou droit de conseil n'en résulte. Une mesure à prendre reste à traiter séparément ; aucune attribution, fermeture, horloge, tâche, notification ou rendez-vous modifié.

Le conseiller précise le périmètre réellement examiné (10–500 caractères), un motif ou une suite minimale (10–1000), une échéance future et sa confirmation. Toutes les valeurs sont vides pour une nouvelle décision ou reconfirmation. Ne pas saisir d'identité de tiers ni de détail confidentiel inutile. Les faits externes ne sont pas détectés par le système ; leur évolution demande un réexamen humain. Une demande client de changement ouverte interdit la position d'absence, mais laisse possibles conflit, clarification et retrait.

GET/POST `/partner/leads/:id/conflict-review`, historique GET avec `beforeRevision` facultatif. Aucun advisorId en entrée. Responsable personnel ou contributeur de conseil actuellement autorisé, membre/organisation/activité/catégorie et Lead actif selon la garde du bilan. Manager seul, voisin, Wallet et superviseur Admin d'autrui exclus. Admin lui-même affecté seulement, avec permission/MFA courants ; son exception de catégorie ne vaut pas preuve professionnelle. Perte du mandat : aucun accès résiduel au dossier, à l'historique ou au retrait.

## Portée, validité et cohérence

Empreinte serveur : sujet canonique/propriétaire, besoin et révision, profil, membre et révisions professionnelles, mandat courant, préférences, référent et demande client. Révisions monotones contre les allers-retours. Sources communes avec la capacité dans `partner.need-context.ts`, sans partage de décisions ni changement de l'empreinte historique de capacité. Aucun compteur, disponibilité ou position de capacité ne conclut à un conflit et leur évolution seule n'invalide pas cet examen.

Versions immuables. États dans l'ordre : manquant, retiré, portée à réexaminer, expiré, enregistré. Seul enregistré expose une position effective. Expiration à l'échéance, sans écriture et sans retour à une ancienne version. Retrait motivé, sans position, périmètre ni échéance. Historique20 limité au sujet canonique courant ; courant indépendant du curseur. Transfert de propriétaire : même sujet mais réexamen ; nouveau sujet rattaché : aucune ancienne histoire affichée.

Lecture repeatable read ; mutations sous verrous acteur/session, membre/organisation, Lead et profil canonique. Date après verrou profil pour décision et projection du rejeu, avec contrôle final d'échéance à l'insertion. Révision/empreinte obsolètes refusées. Version, commande idempotente et audit atomiques. Réessai exact reprojette les droits et l'état actuels ; même clé avec autre contenu refusée. Les gardes HTTP existantes origine/CSRF/débit/session et audit des accès Admin restent applicables.

Audits `need_conflict.decided.v1` et `need_conflict.withdrawn.v1`, privés : auteur personnel, sujet=version, texte vide et Lead nul. Aucun motif, périmètre ou position dans l'événement ; aucune notification, room ou job. Les bilans v1/v2 et leurs six `remainingChecks` restent inchangés ; ce dossier ne suffit pas à une adéquation complète.

## Interface et reprise

Vues remplaçantes dans le même dialogue : courant, formulaire, historique et détail. RHF/Zod, libellés français, heure Europe/Zurich avec refus des heures inexistantes ou ambiguës. Focus explicite aux transitions, jamais une preuve de navigation réelle. Cache utilisateur/session/Lead, gcTime0, relecture10s/manuelle, erreur masquant les données. Première commande et clé conservées en mémoire dans le panneau, y compris si une erreur de lecture masque puis remonte le formulaire ; aucun stockage navigateur. Réponse incertaine : réessai identique même après échéance. Erreur4xx : retour/relecture avant nouvelle commande. Retour ou fermeture abandonne la reprise proposée ; toute nouvelle commande repart d'une lecture et d'une confirmation vides.

## Migration, exploitation et limites

0050 préparée hors catalogue dans `apps/api/drizzle-pending/0050_partner_need_conflicts/` (SQL, snapshot complet, entrée de journal). Table `partner_need_conflict_reviews`, FK/indexes et contraintes de version, empreinte, action/position, texte, JSON et échéance ; aucun backfill. Les100fichiers Drizzle et les3artefacts0049 entrants restent inchangés. Génération et tests assemblent un catalogue temporaire comprenant0049 puis0050 ; deuxième génération sans delta et migrations appliquées deux fois dans PostgreSQL18 isolé.

**Activation non livrée.** `db:migrate` normal n'applique ni0049 ni0050. Une future intégration explicitement autorisée doit contrôler la chaîne complète des SQL/snapshots/entrées, intégrer le catalogue puis appliquer migrations → API → interface. Ne pas activer ce parcours sur une base sans0050. Les anciens bilans, décisions de capacité et référent ne dépendent pas de0050 ; nouvelle route en erreur explicite si table absente. Rollback applicatif conserve les versions ; aucune suppression de preuves.

0046–0048 non appliquées à la base partagée, aucune lecture/décompte/migration partagée ici. Aucun paquet, fournisseur, variable ou permission ajouté. RLS héritée. Contrat de rétention/export/effacement à raccorder à S-130/S-131 : objet privé attaché à l'auteur, au Lead et au sujet canonique, contenant périmètre/motif/besoin figé/révisions/dates ; audience courante appliquée à toute restitution. Aucune durée juridique inventée et aucun service d'effacement livré par cette tranche.

[Preuves e88b](../../../../../../roadmap/evidence/partner-core.md#relais-e88b--examen-personnel-des-conflits-par-besoin) :99tests distincts en deux campagnes, dont15nouveaux ; types/builds quatre apps/lint/frontières/Knip ciblé. Deux revues du même agent, aucune indépendance. V3 rempli/clavier/mobile non effectué sans nouvel accès WorkOS. Brief/S-110/S-042a restent ouverts ; suite proposée au plan, puis tous tracks I–III.
