# Équipe du responsable

C8b du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.3 : le responsable d'une organisation partenaire supervise « les utilisateurs, demandes, affectations et conditions commerciales de son organisation, uniquement selon une habilitation de responsable explicitement accordée ».

## Décisions déléguées

Réponses par défaut du 6 octobre 2026 (PROG-23), C8-3 et C8-4 du plan :

- **Rejoindre une organisation** : uniquement sur invitation du responsable, liée à l'adresse vérifiée du compte invité, puis validation de la personne par CoverView.
- **Pouvoirs du responsable** : voir son équipe, inviter, mettre fin à l'adhésion d'un collègue, réattribuer dans l'équipe, lire les conditions de l'équipe.
- **Ce qu'il ne fait jamais** : valider, accorder un rôle, restreindre, voir les flux financiers d'un collègue, retirer un autre responsable ou lui-même.

## Qui est responsable

Le rôle `manager` accordé par CoverView, sur une adhésion et une organisation validées, réexamen non échu. L'appartenance à une organisation ne donne rien d'autre. Un conseiller ordinaire ne voit toujours que ses demandes.

## Inviter un collègue

`partner_team_invitations` (migration 0078), `POST /partner/team/invitations` :

- **Adresse.** Normalisée en minuscules, sans espaces.
- **Validité.** 14 jours. Une nouvelle invitation à la même adresse remplace la précédente.
- **Bornes.** 20 invitations ouvertes et 10 nouvelles par 24 heures au plus, par organisation.
- **Refus.** Le serveur refuse seulement l'adresse d'un membre actuel de la même organisation. Il ne dit rien des autres comptes.
- **Pas d'email.** L'invitation apparaît dans Partner à la connexion avec l'adresse invitée ; le responsable prévient son collègue.
- **Annulation.** Possible tant qu'elle est ouverte. L'issue (acceptée, refusée, annulée) s'écrit une fois ; rien n'est supprimé.

## Rejoindre

- **Qui voit l'invitation.** Seul le compte dont l'adresse vérifiée correspond (`GET /partner/team/invitations/received`). Il peut la refuser.
- **Accepter, c'est candidater.** `POST /partner/application` avec `invitationId` :
  - l'adhésion est rattachée à l'organisation, dont le nom est imposé ;
  - l'état devient « dossier soumis », sans habilitation ;
  - CoverView valide la personne à part, l'organisation déjà validée n'est pas réexaminée.
- **Changement d'organisation.** Le rattachement fait avancer la révision professionnelle : les examens, conditions et liens de l'ancienne organisation ne valent plus.
- **Impossible** depuis une adhésion validée ou suspendue : elle doit d'abord prendre fin. Possible après une fin d'adhésion.

## Page Équipe

`GET /partner/team`, Partner « Équipe » :

- **Membres actifs**, avec pour chacun :
  - état, habilitations et date de réexamen ;
  - types de restriction, sans motif ni date ;
  - demandes en cours et en retard, avec accès à ses demandes (vue d'équipe existante).
- **Invitations** et leur état.
- **Lien vers les conditions commerciales de l'équipe**, en lecture : le responsable les liste avec les siennes, sans pouvoir les retirer ni les examiner.

## Mettre fin à une adhésion

`POST /partner/team/members/:userId/removal` (révision, motif) :

- **Qui.** Un collègue de l'organisation ; ni soi-même, ni un autre responsable, que CoverView traite.
- **Effet.**
  - état « fermé », décision `team_removal` au [journal](access.md) ;
  - les demandes reviennent à CoverView pour réattribution, comme lors d'une suspension ;
  - les preuves, l'historique et les droits économiques restent ;
  - CoverView est informé par un événement.
- **Avant de confirmer.** Le dialogue indique le nombre de demandes en cours, à réattribuer d'abord dans l'équipe si le responsable le souhaite.

## Réattribuer dans l'équipe

La commande `assign` est ouverte au responsable :

- pour une demande dont le responsable actuel appartient à son organisation ;
- vers un collègue de la même organisation, éligible (conseiller validé dans la catégorie) et non restreint.

Le motif est obligatoire. La décision est tracée comme celle de l'Admin, sans accès au classement de matching réservé à CoverView. Le collègue doit encore accepter, et le client est informé du changement.

## Données personnelles

Le registre v2 nomme le responsable comme destinataire des données opérationnelles de l'équipe : état, habilitations, réexamen, types de restriction et charge, jamais les motifs, les déclarations privées ni les rémunérations.

## Limites

- **Pas d'email** d'invitation : à ajouter derrière l'adaptateur d'envoi existant si besoin.
- **Organisations orphelines.** Une organisation laissée vide par un rattachement reste en base, sans membre.
- **Pas de RLS**, comme dans tout le projet.

## Preuves

`apps/api/src/platform/partner-team.test.ts`, PostgreSQL réel :

- invitation liée à l'adresse et normalisée, refus d'un collègue actuel, de l'intrus, de l'invitation échue ou bloquée ;
- refus, annulation, remplacement, issue écrite une fois, borne journalière ;
- page d'équipe sans motif de restriction, refusée à un conseiller ;
- fin d'adhésion (soi-même, autre responsable, autre organisation, révision périmée), journal et demandes traitées, nouvelle organisation ensuite ;
- réattribution dans l'équipe seulement, collègue restreint refusé, décision tracée ;
- conditions de l'équipe en lecture seule.
