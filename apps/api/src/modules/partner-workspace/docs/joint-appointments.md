# Rendez-vous conjoint

C6b du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.12 : « si les sujets nécessitent plusieurs spécialistes, proposer un rendez-vous conjoint lorsqu'il est réalisable ou plusieurs rendez-vous coordonnés », sans fusionner les cycles des demandes.

## Ce qui existait déjà

- **Rendez-vous coordonnés** : réservation Wallet de 2 à 5 propositions de conseillers différents, créneaux disjoints, une seule transaction (`partner.booking.ts`).
- **Un rendez-vous pour plusieurs demandes d'un même conseiller** : liens de rendez-vous, jusqu'à 9 Leads du même client (`partner.appointment-links.ts`).

C6b ajoute **un même rendez-vous réunissant plusieurs spécialistes**.

## Parcours

1. **Invitation par le client.** Dans Wallet, sur un rendez-vous futur planifié, le propriétaire invite le conseiller d'une autre de ses demandes ouvertes, pour le même sujet (lui-même ou le même profil géré).
   - Candidats : le responsable accepté de la demande, conseiller approuvé de sa catégorie, distinct de l'organisateur.
   - Disponibilité affichée en oui/non seulement : déclaration actuelle, mode proposé, plage couverte, aucun engagement protégé en conflit. Sinon Wallet oriente vers les rendez-vous coordonnés.
   - Le client accepte explicitement que les professionnels voient l'horaire, le mode, le lieu et le nom de l'autre conseiller.
2. **Réponse du spécialiste**, depuis l'onglet Rendez-vous de sa propre demande ou une notification « à répondre ».
   - **Confirmer** : il indique sa préparation et ses trajets (zéro pour téléphone et visio) et atteste ses engagements extérieurs et sa capacité. Disponibilité et conflits sont revérifiés avec ses tampons, puis par la garde en base.
   - **Décliner.**
3. **Effets de la confirmation.**
   - La demande du spécialiste passe en « rendez-vous planifié », prochaine action « Tenir le rendez-vous conjoint ».
   - L'organisateur et le client sont avertis.
   - Le rendez-vous apparaît dans l'agenda du spécialiste, à travers sa propre demande.

## Règles

| Situation | Effet |
|---|---|
| Plafond | 3 participations actives par rendez-vous ; une invitation par geste du client. |
| Refus ou retrait d'un spécialiste | Il n'est plus sollicité pour ce rendez-vous. |
| Report par l'organisateur | Chaque participation repasse « à confirmer » aux nouveaux termes. Sa protection horaire cesse aussitôt (révision des termes), et la prochaine action devient « Reconfirmer le rendez-vous conjoint ». |
| Annulation (client, organisateur, clôture ou reprise de la demande hôte) | Participations terminées ; chaque demande participante revient à « rendez-vous à planifier » si rien d'autre n'est prévu. |
| Retrait du spécialiste avant le début | Sa demande revient à planifier ; l'organisateur et le client sont avertis. |
| Clôture de la demande participante, ou perte du droit personnel du spécialiste (réattribution, révocation) | Participation terminée ; l'organisateur et le client sont avertis. |
| Issue | Chaque spécialiste consigne l'issue de sa propre demande. L'organisateur garde la commande existante ; le spécialiste consigne la sienne après le début (effectué : « rendez-vous effectué » ; absence : retour à planifier). |

## Confidentialité et droits

- Aucun professionnel n'apprend l'existence d'une autre demande sans le geste du client. Les événements ne portent que l'horaire, jamais de nom.
- Les noms et organisations des participants ne sont montrés qu'aux professionnels du rendez-vous, au propriétaire et à l'Admin. Les autres lecteurs d'une demande (apporteur, collègues) ne les voient pas.
- Seul le spécialiste invité décide de sa participation. L'Admin lit sans agir. L'organisateur n'a aucun accès à la demande participante.
- Commandes idempotentes, base de confirmation recalculée sous verrous : un changement concurrent donne 409.

## Données et garde

- Table additive `partner_appointment_participants` (migration `0073`). Elle porte :
  - le rendez-vous, la demande et le professionnel ;
  - l'état (`invited`, `confirmed`, `declined`, `withdrawn`, `ended`) et la révision des termes acceptés ;
  - les tampons, les preuves et l'issue.
- Unicité d'une participation active par rendez-vous et par professionnel, et par demande.
- **Temps protégé.** Une participation confirmée occupe le professionnel (début − préparation − trajet aller, fin + trajet retour) tant qu'elle correspond aux termes courants d'un rendez-vous planifié.
  - La garde `partner_guard_protected_time` des organisateurs la respecte désormais.
  - La garde `partner_guard_participation_time` refuse toute confirmation en conflit avec les autres engagements du professionnel, même d'un écrivain qui sauterait le contrôle applicatif.
  - `overlappingAppointment` en tient compte partout : évaluation, création, report.
- **Ordre des verrous** : demande hôte, rendez-vous, demande participante, participations, plannings, sujet, puis réautorisation.

## Routes

- `GET /wallet/leads/:id/appointments/:appointmentId/joint` et `POST …/joint/invitations` (propriétaire).
- `GET /partner/leads/:id/participations`, `GET /wallet/leads/:id/participations`.
- `POST /partner/leads/:id/participations/:participationId` : `confirm`, `decline`, `withdraw`, `outcome`.

## Preuves et limites

- Test PostgreSQL `platform/partner-joint-appointments.test.ts` :
  - candidats limités au même sujet, disponibilité en oui/non, refus des professionnels et autres propriétaires ;
  - base périmée → 409 ;
  - confirmation avec tampons, agenda, détail filtré ;
  - conflit applicatif et refus de la garde en base ;
  - report → reconfirmation et libération du temps ;
  - annulation Wallet → fin ;
  - retrait → plus de sollicitation ;
  - issue propre à la demande ;
  - réattribution → fin.
- Non livré :
  - l'invitation d'un contributeur par l'organisateur lui-même ;
  - le report conjoint en une seule opération : annuler puis réserver à nouveau reste possible ;
  - un lieu ou un lien commun proposé par le système : c'est celui de l'organisateur.
