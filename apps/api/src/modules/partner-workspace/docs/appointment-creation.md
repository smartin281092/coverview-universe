# Création personnelle d'un rendez-vous

Extensionc902 : [report personnel explicite](appointment-rescheduling.md), réutilisant proposition/contrôles/attestations, avec même rendez-vous et preuve avant/après. Les mentions de report ouvert ci-dessous décrivent l'état historique7db2.

## Parcours et règles

Depuis la fiche Lead → Rendez-vous → « Programmer mon rendez-vous », le conseiller saisit les modalités convenues, vérifie sa proposition puis confirme l'engagement et le temps à protéger. Source : brief Partner I.10–12/18/20, II.5/8 et décision déléguée PROG-23 du relais7db2. [Plan](../../../../../../roadmap/plans/partner-core.plan.md#relais-7db2--création-personnelle-avec-temps-protégé-plan-avant-code).

Le conseiller est toujours l'acteur courant ; aucun identifiant de collègue accepté. Mandat personnel sur un Lead actif, activité/catégorie actuelles et accès opérationnel exigés ; visibilité manager insuffisante, exception Admin personnelle conservée. Admin peut créer son propre rendez-vous, pas lire les conditions privées d'autrui.

Durée15–240minutes, préparation/aller/retour0–240minutes, chaque entier explicite y compris zéro. Ordre des périodes et contrôles communs : [temps protégé](appointment-time.md). Toute la période est future, couverte par déclaration actuelle sans absence ni conflit, mode offert et souhait client confirmé compatibles. Demande de changement prioritaire ; profil/besoin/propriétaire/profession modifiés, y compris aller-retour, exigent les reconfirmations canoniques.

Quatre cases non précochées attestent personnellement : modalités convenues avec le client ; engagements hors CoverView vérifiés ; capacité à assurer le rendez-vous et son suivi ; préparation et trajets adaptés/réalisables. Le serveur conserve ces attestations sans vérifier agenda externe, itinéraire ou capacité globale, ni signer au nom du client. Éligibilité complète toujours à examiner, aucun `missingCheck` retiré, aucun créneau libre/réservation Wallet annoncé.

## API et atomicité

POST `/partner/leads/:id/personal-appointments/preview` reçoit rendez-vous sans conseiller et durées. Retour : proposition exacte, constats privés partagés avec le contrôle existant, intervalle proposé, empreinte et capacité de confirmer. Cette lecture n'écrit ni rendez-vous, version, Lead ou notification ; l'audit HTTP Admin existant reste applicable. Aucune plage brute ou détail d'autre dossier n'est renvoyé.

POST `/partner/leads/:id/personal-appointments/confirm` reçoit la même proposition, empreinte et quatre attestations vraies. Zod strict, origine/CSRF/session/Admin-MFA, limites et timeouts hérités. L'empreinte lie acteur, proposition complète, Lead et sources/révisions ; ce n'est ni une permission ni une réservation.

La transaction recontrôle acteur/session, membre/organisation, mandat/Lead, planning et profil canonique. Sous le verrou conseiller partagé, elle relit sources et occupations ; proposition/source changée refuse l'empreinte, couverture/mode/souhait/futur/conflits sont revérifiés. Création, occupation, version privée et effets historiques sont atomiques ; une erreur de preuve annule tout l'essai.

Effets historiques réutilisés : étape rendez-vous planifié, première action utile si absente, prochaine action/échéance du rendez-vous, attente levée, révision Lead et notifications internes. Aucune acceptation implicite d'affectation ni réattribution. `appointment.scheduled` conserve date/mode sans durées ou attestations ; `appointment.time_protected.v1` reste un audit privé sans Lead/fanout. Aucun événement, room, job, fournisseur ou paquet nouveau.

Même clé/contenu : projection actuelle autorisée du Lead, sans doublon. Clé réutilisée autrement refusée ; retrait de session/mandat bloque aussi le rejeu. Deux créations concurrentes ne gagnent pas une même occupation. Refus générique sans détails d'un autre Lead. Les anciens créateurs gardent leur contrat, respectent le temps protégé mais peuvent encore créer hors déclaration ; aucune attestation rétroactive.

## Preuves privées et interface

La version immuable0046 conserve durées/intervalle, modalités initiales exactes, révision Lead, références du sujet et attestations versionnées, auteur/date. Ces métadonnées identifiantes ne rejoignent aucun DTO public. Le contrôle personnel permet de consulter durées/historique ; les attestations détaillées restent persistées mais ne sont pas projetées par cette tranche. Une nouvelle absence ou source périmée ne libère rien. Annulation/issue et anciens transferts/clôtures conservent leurs règles et preuves.

RHF/Zod, dialogue borné : champs, récapitulatif serveur, confirmations, retour aux champs et refus expliqués. Fuseau suisse explicite ; heures inexistantes/répétées refusées. Après réponse incertaine, commande/clé figées et seul réessai exact proposé. Une erreur masque les constats privés ; état local lié session/Lead, supprimé à fermeture, aucune persistance navigateur. Succès : rendez-vous affiché après invalidation des lectures privées.

## Exploitation et limites

Aucune nouvelle migration :0046 avant API/UI, toujours **non appliquée à la base locale partagée par7db2**.0044/0045/0046 inchangées. Rollback : fermer le parcours, conserver garde/historique et lecteur comprenant les périodes protégées, corriger en avant. S-130/S-131 et dérogation RLS héritée ouverts ; aucune durée de rétention ou conformité nouvelle promise.

[Ledger7db2](../../../../../../roadmap/evidence/partner-core.md#relais-7db2--création-personnelle-avec-temps-protégé) : V0–V2, deux revues statiques même agent ; V3 rempli/clavier/mobile non effectué, WorkOS absent. Acteurs synthétiques PostgreSQL isolé seulement. Suite : report personnel explicite conservant histoire, responsabilité et accord, sans annulation silencieuse ; capacité globale, réservation Wallet, matching et tous tracks restent ouverts.
