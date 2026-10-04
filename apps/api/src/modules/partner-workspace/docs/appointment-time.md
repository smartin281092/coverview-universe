# Protéger le temps autour d'un rendez-vous

Extensionc902 : [report explicite](appointment-rescheduling.md) modifie les modalités et l'occupation ensemble, conserve chaque preuve et enrichit l'historique privé des modalités avant/après. Les limites de report ci-dessous décrivent l'état historique9ff1.

## Résumé et périmètre

Extension7db2 : [création personnelle avec temps protégé dès confirmation](appointment-creation.md). Les anciennes limites de création ci-dessous concernent les créateurs historiques ; report explicite et réservation Wallet restent ouverts.

Depuis Agenda ou la fiche Lead, le conseiller ouvre « Contrôler mon rendez-vous » puis « Organiser mon temps ». Il confirme les minutes de préparation, de trajet aller et de trajet retour pour un rendez-vous déjà convenu. Source : brief Partner I.10–12/18/20 et décision déléguée PROG-23 du relais9ff1. Le parcours protège ces périodes contre les nouvelles occupations CoverView ; il ne déplace pas le rendez-vous et ne crée pas un créneau Wallet réservable.

## Règles métier

Chaque durée est un entier explicite de0 à240minutes. Aucun zéro implicite au formulaire : l'absence de version signifie non renseigné. Préparation puis aller occupent le temps avant le rendez-vous ; le retour occupe le temps après sa fin. Téléphone/visio exigent des trajets nuls. Les calculs utilisent des instants UTC et des minutes écoulées ; Europe/Zurich reste affiché. Début inclus, fin exclue : une occupation adjacente n'est pas un conflit.

Le conseiller doit avoir son accès opérationnel et son mandat personnel courants sur un Lead actif. L'exception Admin personnelle du contrôle existant est conservée. Le rendez-vous est programmé et tout l'intervalle proposé doit rester futur. Déclaration professionnelle actuelle, mode proposé et souhait client confirmé compatible sont exigés ; une demande de changement d'interlocuteur non résolue empêche la confirmation. Une déclaration absente/périmée ou des préférences à reconfirmer ne fournissent aucune condition favorable.

Toutes les minutes, y compris préparation et trajets, doivent être couvertes par les disponibilités déclarées. Les plages adjacentes peuvent se compléter ; un trou reste inconnu et toute absence recouvrante est prioritaire. Le serveur refuse le moindre chevauchement avec un autre engagement programmé, y compris son temps protégé, quel que soit le Lead. Aucun détail de cet autre dossier n'est renvoyé.

Une nouvelle confirmation remplace les seules durées protégées et conserve les versions antérieures. Leur réduction explicite est possible ; elle ne change jamais les dates, le mode, la responsabilité ni l'accord client du rendez-vous. Les autres commandes conservent leurs propres règles d'annulation, clôture et transfert. Un rendez-vous annulé ou terminé n'occupe plus le planning, mais ses preuves restent conservées. Une nouvelle absence ou une source périmée n'efface pas le temps protégé : le contrôle signale l'écart.

Ces durées sont déclarées, sans preuve de préparation effectuée, d'itinéraire ou de durée de déplacement réaliste. Engagements externes, capacité globale, accord client détaillé et éligibilité complète demeurent non vérifiés. Aucun `missingCheck` n'est retiré. Une cohérence déclarative n'est jamais une disponibilité réelle.

## API, permissions et concurrence

POST `/partner/leads/:id/appointments/:appointmentId/time-protection` reçoit durées, confirmation explicite et empreinte de la lecture. GET du [contrôle privé](appointment-assessment.md) est étendu additivement avec le temps protégé, les20 dernières versions et la capacité d'ouvrir le formulaire. Contrats Zod et client partagé ; host/origine/CSRF, session, Admin/MFA, timeout et limites existants réutilisés. L'empreinte identifie les sources lues, **pas un jeton de réservation**.

Lecture/écriture exclusivement personnelles, même pour Admin : aucun manager, collègue ou propriétaire Wallet ne reçoit les durées, l'historique ni les plages privées. Les projections publiques des rendez-vous gardent leurs champs antérieurs. Le refus de conflit, déjà exposé aux commandes autorisées, reste générique. Aucun nouveau destinataire des sources privées.

La transaction recontrôle session/identité, membre/organisation, Lead, rendez-vous, planning et profil canonique sous leurs verrous. L'empreinte couvre les révisions du Lead, de la déclaration/profession, des préférences/portée/profil, les faits du rendez-vous et la version personnelle. Les occupations sont relues sous le même verrou conseiller que les commandes existantes. L'ordre de verrouillage reste celui du module ; aucune attente réseau pendant la transaction.

Même clé et contenu : aucune seconde version ; projection autorisée de l'état actuel, y compris si une absence est apparue depuis. Clé réutilisée autrement : refus. Retrait d'accès/mandat au rejeu : refus. Deux confirmations nouvelles d'une même lecture ne réussissent pas ensemble. La comparaison complète et l'écriture des durées, version et audit sont atomiques.

## Persistance et compatibilité

Migration additive0046 : deux durées d'occupation sur les rendez-vous, table privée de versions, bornes et unicité par rendez-vous/révision. Les anciens rendez-vous reçoivent zéro occupation supplémentaire, ce qui ne prouve pas zéro préparation : sans version ils restent affichés non renseignés. Une garde SQL sérialise les écritures et refuse tout recouvrement impliquant un temps protégé, y compris pour un ancien créateur ignorant les nouvelles colonnes. Les conflits historiques entre deux rendez-vous sans temps protégé ne sont pas réécrits ; les commandes applicatives les préviennent déjà et le contrôle les détecte. L'historique est protégé contre UPDATE/DELETE ; aucun effacement automatique annoncé.

L'audit privé `appointment.time_protected.v1` référence la version avec texte vide, sans Lead ni fanout. Aucun événement client, horloge, notification, tâche, attente, référent, préférence, examen ou révision du Lead n'est modifié. Aucun fournisseur, dépendance, variable, worker ou room supplémentaire. Données identifiantes : conseiller, rendez-vous, périodes et révisions des sources ; aucun motif de trajet/absence ou engagement externe collecté. Les services S-130/S-131 de rétention/export/effacement restent ouverts. Dérogation RLS héritée, contrôles applicatifs et oracles d'isolation maintenus.

Appliquer0046 avant API/UI.0044/0045 sont inchangées. Migration testée en PostgreSQL isolé, **non appliquée à la base locale partagée par9ff1**. Pour rollback, fermer l'entrée nouvelle et conserver les données/gardes, puis corriger en avant ; le lecteur du contrôle doit comprendre les occupations protégées après activation. Ne pas supprimer les preuves ni revenir à un contrôle ignorant les durées. Les anciennes commandes gardent leur contrat ; elles ne bloquent toujours pas toutes les créations hors déclaration.

## Interface, preuves et suite

Formulaire RHF/Zod dans le dialogue existant, champs requis et confirmation non précochée. L'intervalle avant confirmation est qualifié de proposé ; le serveur décide sa recevabilité. Commande/clé figées en cas de réponse incertaine ; conflit impose relecture. Les données d'ouverture ne suivent pas silencieusement une révision actualisée. Historique dans une vue distincte et bornée, cache privé utilisateur/session/Lead/RDV, supprimé à fermeture ; une erreur masque le contenu précédent.

[Ledger9ff1](../../../../../../roadmap/evidence/partner-core.md#relais-9ff1--temps-personnel-protégé) : V0–V2 et deux revues statiques du même agent, aucune indépendance revendiquée. WorkOS configuré mais fichier et trois valeurs requis absents ; V3 rempli/clavier/mobile non effectué, aucun runtime/session/grant/client réel fabriqué. Suite : création personnelle avec durées et confirmation atomique dès le rendez-vous, puis report explicite conservant histoire/responsabilité/accord. Capacité externe, réservation Wallet/matching et tous les autres tracks restent ouverts.
