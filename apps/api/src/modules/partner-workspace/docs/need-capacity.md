# Décision personnelle de capacité pour un besoin

L’[examen personnel des conflits](need-conflicts.md) est un autre dossier privé : aucune capacité ou charge observée ne détermine sa position. Les sources de contexte communes sont réutilisées sans changer l’empreinte de capacité.

## Sens et audience

Propriétaire : partner-workspace ; brief I.10.2–10.4/12/18/20 et II.7. Fiche Lead → Mon adéquation → Décider de ma capacité pour ce besoin. Ce dossier privé conserve une appréciation humaine explicite, distincte de la [déclaration globale et des compteurs](personal-capacity.md). Les [bilans v1/v2](advisor-assessment.md) gardent leurs contrats et leurs six contrôles ; cette nouvelle décision ne résout pas l'adéquation complète.

Trois positions : capacité confirmée personnellement pour ce besoin, capacité insuffisante, éléments à clarifier. Choix initial vide, motif de10à1000caractères, échéance future et confirmation explicite ; aucune reconfirmation préremplie. Une demande client de changement ouverte bloque la position positive, sans empêcher une appréciation négative/à clarifier ou le retrait. Aucun choix client, mandat, attribution, horloge, tâche ou rendez-vous n'est modifié. La déclaration globale `unavailable` informe la décision humaine sans la prendre à sa place.

GET/POST `/partner/leads/:id/capacity-decision`, historique GET `beforeRevision` facultatif. Aucun `advisorId` reçu. Conseiller personnellement responsable ou contributeur avec accès de conseil, activité/catégorie courantes, Lead ni brouillon ni clos. La visibilité de manager ne suffit pas. Admin doit être lui-même affecté, permission/MFA courants ; son exception de catégorie ne fournit aucune preuve professionnelle. Wallet, voisin, organisation et Admin superviseur d'autrui n'accèdent ni à la décision ni au motif. Perte de mandat : aucun accès résiduel à l'historique ou au retrait ; les preuves restent persistées.

## Portée et fraîcheur

Chaque version fige besoin affiché, sujet canonique, auteur, révisions et sources de contexte. Empreinte serveur liée aux révisions de besoin, profil, membre/périmètre professionnel, mandat (responsable/cycle/contributions courantes), préférences, choix de référent, dernière demande client, capacité globale et disponibilité déclarée. Les révisions monotones empêchent la réactivation après aller-retour. Le propriétaire canonique courant fait autorité. Un autre sujet rattaché au Lead ne reçoit aucune ancienne décision ou histoire ; les versions restent numérotées par conseiller/Lead. Un profil géré transféré demeure le même sujet, avec portée à réexaminer.

Les compteurs de liens de travail sont une observation datée figée dans chaque version. Leur évolution seule ne périme pas une décision et ne fournit aucun seuil de capacité. Le bilan conserve séparément les autres contrôles (compétence précise, conflits, conventions/solution, disponibilité réelle, qualité) ; cette empreinte n'est pas une preuve de stabilité de tous ces domaines.

États : manquant, retiré, à réexaminer, expiré, enregistré. Le retrait prime la portée modifiée, qui prime l'expiration. Seul l'état enregistré expose une position effective. Validité demi-ouverte jusqu'à l'échéance choisie ; expiration calculée sans écriture. Aucun retour à une ancienne version. Retrait explicite motivé, sans position/échéance ; nouvelle décision nécessaire ensuite. Historique20, limité au sujet courant et indépendant du curseur pour l'état courant. Les positions historiques restent identifiées comme telles.

## Cohérence et confidentialité

Garde personnelle réutilisée avec le bilan existant. Lecture repeatable read datée au début ; mutation sous verrous acteur/session, membre/organisation, Lead/profil et contrôle de révision/empreinte. Pour décision et rejeu, l'instant serveur est pris après acquisition du verrou canonique ; l'échéance est encore contrôlée à l'insertion. Une attente de verrou ne permet pas au rejeu de présenter une décision expirée comme actuelle. Deux nouvelles commandes concurrentes sur la même révision ne gagnent pas ensemble.

Version, commande idempotente et audit privés sont atomiques. Réessai exact : droits et état courants, jamais restitution d'une ancienne autorisation ou réactivation. Même clé/autre contenu refusé. Les gardes HTTP origine/CSRF/session/débit et audit des accès Admin restent en vigueur. Audits `need_capacity.decided.v1` et `need_capacity.withdrawn.v1` : auteur personnel, sujet=version, audience privée, texte vide et Lead nul. Aucun motif, compteur ou détail du besoin dans ces événements ; aucune notification/job/room.

RHF/Zod, motifs i18n, heure Europe/Zurich avec refus des heures inexistantes/ambiguës. Vues remplaçantes dans le même dialogue ; focus placé sur le titre lors du passage au formulaire et au retour. Première commande/clé figées ; réponse incertaine → réessai identique même après échéance ; erreur4xx → retour/relecture avant nouvelle commande. Cache utilisateur/session/Lead, gcTime0, relecture10s/manuelle ; erreur masque les anciennes données. Un changement de portée détecté ferme l'édition de la commande initiale sans altérer son éventuel rejeu.

## Migration et activation différée

La contrainte du relais protège byte-for-byte les100fichiers entrants de `apps/api/drizzle`, journal compris. **0049 est donc préparée hors catalogue**, dans `apps/api/drizzle-pending/0049_partner_need_capacity/` : SQL généré, snapshot complet et entrée de journal. Elle crée seulement `partner_need_capacity_decisions`, ses FK/indexes et contraintes d'action/position/date/révision/empreinte/motif. Pas de backfill. Les tests assemblent un catalogue temporaire complet sous `.planning-local`, appliqué deux fois dans PostgreSQL isolé ; la génération suivante n'a aucun delta.

**Le `db:migrate` normal n'applique pas0049 aujourd'hui.** Une future intégration explicitement autorisée du catalogue doit placer SQL/snapshot/entrée aux emplacements Drizzle, après contrôle des migrations intervenues entre-temps ; ne jamais ajouter l'entrée aveuglément ni modifier le journal protégé dans ce relais. Ordre d'activation : catalogue0049 validé → migrations requises → API → interface. Sans0049, les nouvelles routes échouent ; v1/v2 et les détails existants ne lisent pas cette table et restent compatibles. Ne pas activer le nouveau parcours sur cette base. Rollback applicatif : fermer l'entrée/les routes nouvelles, conserver toutes les preuves.

0046–0048 non appliquées à la base partagée, aucune application/lecture de décompte partagée ici. Aucune nouvelle variable, dépendance, permission, fournisseur ou worker. RLS héritée ; rétention/export/effacement S-130/S-131 ouverts, aucune durée juridique inventée.

## Preuves et limites

[Ledger a9ba](../../../../../../roadmap/evidence/partner-core.md#relais-a9ba--décision-personnelle-de-capacité-par-besoin) :15tests nouveaux PostgreSQL, régressions, types/builds quatre apps et contrôles ciblés. Deux revues statiques du même agent, aucune indépendance. V3 rempli/clavier/mobile non effectué faute de nouvel accès WorkOS ; aucune identité/habilitation réelle fabriquée. Migration et recette nécessaires avant usage réel. Brief intégral/S-110/S-042a restent ouverts ; prochaine tranche : conflits bloquants par besoin, puis les autres tracks.
