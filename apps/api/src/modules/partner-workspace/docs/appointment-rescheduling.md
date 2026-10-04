# Report personnel explicite d'un rendez-vous

## Parcours et conditions

Fiche Lead → Rendez-vous → « Reporter mon rendez-vous ». Le dialogue personnel présente les modalités antérieures puis la nouvelle proposition contrôlée par le serveur. Source : brief Partner I.8/10–12/19/20 et II.5/8 ; défauts délégués PROG-23 du [planc902](../../../../../../roadmap/plans/partner-core.plan.md#relais-c902--report-personnel-explicite-plan-avant-code).

Le même rendez-vous, son conseiller et son Lead sont conservés. Le rendez-vous doit être programmé et encore futur ; la nouvelle date doit être différente et tout le nouvel intervalle doit être futur. Une avance convenue est aussi permise. Il ne s'agit pas d'annuler puis de créer un rendez-vous distinct. Pour un rendez-vous passé, utiliser les issues existantes ; la tranche ne réécrit pas rétroactivement sa tenue.

Les règles de [création personnelle](appointment-creation.md) sont réutilisées : mandat personnel, activité/catégorie et Lead actif ; exception Admin personnelle conservée, manager seul insuffisant. Déclaration professionnelle actuelle, mode offert, souhait client confirmé compatible, absence de demande de changement d'interlocuteur, couverture complète sans absence ni conflit. L'ancien rendez-vous est exclu du seul contrôle de chevauchement, ce qui autorise des horaires ancien/nouveau partiellement communs. Une incohérence de l'ancien créneau n'empêche pas de le corriger vers une proposition recevable.

Durée15–240minutes, préparation/aller/retour0–240minutes explicitement revérifiés, trajets nuls en téléphone/visio. Les quatre attestations de création sont redemandées non précochées pour les nouvelles modalités. Elles restent des déclarations du conseiller, sans preuve indépendante de l'accord client, d'agenda externe, de capacité globale ou de trajet. Les critères non prouvés restent non vérifiés.

## API et atomicité

POST `/partner/leads/:id/appointments/:appointmentId/rescheduling/preview` reçoit la proposition personnelle existante. Il retourne l'ancien rendez-vous autorisé, la proposition exacte, les constats privés, l'intervalle proposé et une empreinte ; aucune persistance métier. POST du même préfixe `/confirm` reçoit la proposition exacte, l'empreinte et les quatre attestations. Origine/CSRF/session/Admin-MFA, contrats stricts, limites et timeouts hérités.

L'acteur/session, membre/organisation, Lead, rendez-vous personnel, planning du conseiller et profil canonique sont verrouillés et recontrôlés. L'empreinte couvre proposition, anciennes modalités/occupations, révision du Lead, sources professionnelles/préférences/profil et dernière version privée. Elle n'est ni une permission ni une réservation. Un changement exige une nouvelle lecture ; les occupations sont relues après attente du verrou partagé avec les commandes historiques.

Date, durée, mode, lieu/connexion, fuseau et occupations sont modifiés en une seule écriture SQL : la garde0046 examine directement les nouvelles modalités avec les nouvelles durées. Une nouvelle version privée, les événements, la révision Lead et les notifications font partie de la même transaction. Une panne de preuve annule le report entier. Même clé/contenu sans nouvelle mutation, clé changée de contenu refusée. Rejeu : autorisation actuelle, réponse actuellement visible, même si le rendez-vous a depuis été annulé ; Lead clos ou mandat/session retiré refuse. Les anciennes commandes de Lead avec une révision antérieure deviennent périmées.

## Historique, suivi et audiences

0046 conserve une version immuable contenant anciennes/nouvelles modalités exactes, ancienne occupation et référence de sa preuve ou `null` si aucune déclaration antérieure, nouvelles durées/intervalle, références sujet/profil/révisions, attestations versionnées et auteur/date. Les20 dernières versions du contrôle privé exposent additivement les modalités avant/après du report ; les attestations détaillées restent en base. Anciennes versions intactes, absence de preuve antérieure jamais transformée en attestation rétroactive. Consultation toujours personnelle, y compris face à Admin.

Étape, responsabilité, attribution, acceptation, première action utile, tâches et attente sont conservées. Seule l'échéance principale encore égale à l'ancien début, associée à l'action automatique « Tenir le rendez-vous convenu » et sans attente, suit le nouveau début. Une autre action ou attente n'est pas repoussée. Les alertes existantes sont réconciliées sur ces faits, sans suspension implicite ni acceptation d'affectation.

Événement de timeline `appointment.rescheduled.v1`, audience client existante, sujet rendez-vous et texte limité à ancienne/nouvelle date et mode. Les lecteurs autorisés voient le rendez-vous courant via les DTO existants. Notification de service interne au propriétaire Wallet courant et au responsable opérationnel actuel, dédupliquée par événement/destinataire, informative sans nouvelle tâche. Le reçu ne prouve pas une lecture ni un envoi externe. Durées privées, lieux historiques, sources et attestations ne sont pas ajoutés aux notifications ni aux DTO partagés. Audit `appointment.time_protected.v1` privé sans Lead/fanout conservé.

RHF/Zod, récapitulatif avant/après, heure suisse ambiguë refusée, reprise exacte de commande/clé après réponse incertaine, données du contrôle masquées après erreur. État modal par session/Lead/RDV, aucune persistance navigateur. Les mutations invalident les lectures de la session ; les autres surfaces utilisent leur rafraîchissement existant. Pas de push temps réel ajouté.

## Exploitation, preuves et suite

Aucune migration nouvelle ;0044/0045/0046 inchangées.0046 reste **non appliquée à la base locale partagée** par cette tranche. Activation0046→API/UI. Rollback : fermer l'entrée et conserver garde, versions et lecteur compatible, correctif en avant. Aucun paquet/variable/fournisseur/job/room nouveau. Les dates/modalités et preuves identifiantes restent dans le périmètre S-130/S-131 ouvert ; dérogation RLS héritée, aucune conformité ni durée de rétention nouvelle annoncée.

[Ledgerc902](../../../../../../roadmap/evidence/partner-core.md#relais-c902--report-personnel-explicite) :75tests PostgreSQL/4fichiers, V0/V1 et deux revues statiques même agent. V3 rempli/clavier/mobile non effectué, WorkOS absent ; acteurs synthétiques uniquement dans PostgreSQL isolé. Capacité globale, recherche de créneaux, réservation Wallet, multi-Leads, matching complet et tous autres tracks restent ouverts.
