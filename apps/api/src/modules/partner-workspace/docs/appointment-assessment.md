# Contrôle privé des rendez-vous convenus

Extensionc902 : [report personnel explicite](appointment-rescheduling.md) accessible depuis le Lead, avec historique avant/après consultable ici. Le contrôle reste une lecture ; les mentions de report ouvert ci-dessous décrivent ses tranches antérieures.

## Résumé et périmètre

Extension7db2 : les constats sont aussi réutilisés par [la création personnelle](appointment-creation.md), avec proposition sans persistance puis confirmation atomique. Cette lecture d'un engagement existant garde sa portée et ses limites.

Extension9ff1 : ce dialogue propose aussi [la protection personnelle de préparation et trajets](appointment-time.md), une commande séparée de la lecture. Lorsqu'une protection existe, les constats de plages/absences/chevauchements couvrent l'intervalle étendu affiché. Le texte ci-dessous conserve les limites du contrôle, qui reste sans écriture.

Depuis Agenda ou l'onglet Rendez-vous d'un Lead, « Contrôler mon rendez-vous » rapproche un engagement programmé de la [déclaration professionnelle](professional-availability.md) et du [souhait client confirmé](advice-preferences.md). Source : brief I.10–12/18/20 ; décision déléguée PROG-23 du relais f189. Le résultat est une lecture datée, pas une réservation ni une preuve de disponibilité réelle. Les autres tracks du brief restent ouverts.

## Règles et interprétation

Le serveur utilise la dernière déclaration complète. Son périmètre professionnel doit être actuel, y compris après un aller-retour de parties/catégories. Déclaration absente ou périmètre modifié : mode et plages inconnus. Liste de modes vide : non renseigné. Un mode absent d'une liste renseignée est un écart déclaré, sans réécrire le mode déjà convenu.

La durée complète du rendez-vous est comparée en instants UTC, début inclus/fin exclue. Des disponibilités adjacentes peuvent la couvrir ensemble ; un trou, même court, reste non renseigné. Toute absence recouvrante prime sur les disponibilités. Une absence finissant exactement au début ou commençant à la fin ne recouvre pas le rendez-vous. Le fuseau Europe/Zurich reste affiché. Aucune disponibilité n'est inférée de l'approbation, du calendrier de continuité, des textes libres ou du rendez-vous lui-même.

Les autres rendez-vous programmés du même conseiller sont examinés, même sur un autre Lead. Le contrôle retourne uniquement le fait d'un chevauchement ; aucun identifiant, client, lieu, date ou titre de cet autre dossier. Un rendez-vous annulé/terminé/absent n'est pas un engagement programmé. Les commandes existantes continuent à refuser atomiquement de nouveaux chevauchements ; ce contrôle ne les remplace pas.

Le souhait de mode est comparé seulement si sa confirmation est valable pour le besoin et le propriétaire actuel du profil. Après modification/transfert/aller-retour, aucun ancien mode n'est présenté comme souhait actuel. Une demande de changement d'interlocuteur non résolue reste prioritaire. Le contrôle ne la résout pas et n'attribue aucun conseiller.

La responsabilité opérationnelle exige droits actuels, catégorie et mandat personnel (responsable ou contribution autorisée à éditer et contacter), sur un Lead actif ; l'exception Admin personnelle existante est conservée. Une visibilité de responsable d'équipe seule ne fournit pas ce mandat. L'éligibilité complète reste à examiner séparément.

Le bilan est « écart à traiter », « informations à compléter » ou « cohérence déclarative uniquement ». Même sans écart déclaré, préparation, engagements externes, capacité, accord client détaillé et adéquation complète ne sont pas prouvés. Le déplacement reste également à vérifier pour bureau/domicile. Ce n'est jamais un indicateur « libre », ni un retrait de `missingChecks`, ni une autorisation de réservation.

## API, permissions et concurrence

GET `/partner/leads/:id/appointments/:appointmentId/assessment`, contrats Zod et client HTTP partagé. L'acteur authentifié doit posséder l'accès opérationnel courant au Lead **et être le conseiller du rendez-vous programmé**. Aucun intervalle libre ou identifiant de conseiller n'est accepté. Un Admin/MFA peut contrôler ses propres rendez-vous ; sa permission ne donne pas accès au contrôle privé d'un collègue. Le dossier professionnel Admin préexistant reste distinct. Manager, apporteur en progression et Wallet n'obtiennent pas ce résultat pour autrui.

La transaction contrôle/verrouille session et identité, membre/organisation, Lead, rendez-vous, planning du conseiller et profil canonique. Le verrou de planning est celui des commandes d'engagement ; les déclarations et préférences sont relues sous les verrous de leurs porteurs. Résultat ponctuel, susceptible de changer après la transaction, jamais jeton de réservation. Les timeouts SQL/HTTP existants bornent l'opération. Requêtes finies : un rendez-vous, une déclaration d'au plus60 périodes, préférences bornées et deux recherches d'existence. Aucun appel externe.

## Effets, interface et exploitation

Aucune écriture métier : ni révision, historique, tâche, Lead, engagement, référent, examen, horloge, notification ou résolution d'alerte. L'audit d'accès Admin de la frontière HTTP reste applicable. Aucun événement métier, migration, dépendance, variable, fournisseur, worker ou room supplémentaire. Les migrations0044/0045 déjà appliquées sont conservées intégralement ; aucun changement de base locale dans ce relais.

Dialogue borné, pas d'expansion de page. Le serveur fournit les constats et le bilan ; l'interface ne recalcule aucune disponibilité. Horodatage et versions des sources identifient la lecture. Actualisation manuelle et toutes les10secondes, cache privé utilisateur/session/Lead/RDV, supprimé à fermeture, aucun stockage navigateur persistant. Une erreur masque le contenu précédent. Retour vers la fiche pour traiter explicitement l'engagement avec le client ; pas d'annulation/report depuis ce contrôle.

Activation additive : API avant nouvelle interface ; une ancienne API ne connaît pas cette route. Rollback par retrait des deux entrées UI ou retour applicatif, aucune donnée à restaurer. La projection dérivée n'est pas persistée ; les contrats S-130/S-131 des sources restent applicables. Aucune nouvelle audience des plages privées, aucune durée de conservation ou conformité inventée. Dérogation RLS héritée : contrôles applicatifs testés, pas de RLS nouvelle.

## Preuves et limites

Voir [le ledger f189](../../../../../../roadmap/evidence/partner-core.md#relais-f189--contrôle-privé-dun-rendez-vous-convenu). Les tests PostgreSQL utilisent des acteurs synthétiques isolés ; deux revues statiques du même agent, aucune indépendance revendiquée. V3 rempli/clavier/mobile non effectué : fichier WorkOS configuré et trois valeurs requises absents au contrôle booléen, aucun callback refusé retenté ni session/grant/client réel créé.

Le contrôle n'empêche pas une création de rendez-vous hors déclaration, ne réconcilie pas automatiquement un écart et ne calcule pas de capacité réelle. La commande9ff1 permet désormais de déclarer et protéger préparation/trajets sur un engagement existant ; leur réalité, les engagements externes, la réservation Wallet, le report atomique, le multi-Leads et le matching complet restent ouverts. Prochaine tranche : confirmation personnelle dès la création avec les mêmes protections.
