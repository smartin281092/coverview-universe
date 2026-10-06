# Habilitations : décisions, restrictions et réexamens

C8a du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.4 : « valider une organisation et ses utilisateurs séparément, restreindre certaines activités, demander des documents, fixer une date de réexamen, suspendre un utilisateur ou bloquer une organisation entière. Toute décision doit comporter un auteur, une date, un motif et, lorsque pertinent, une date de révision. »

## Décisions déléguées

Réponses par défaut du 6 octobre 2026 (PROG-23), C8-1 et C8-2 du plan :

- **Restrictions** : liste fermée, effet sur les nouveaux engagements seulement. Rien n'est levé automatiquement.
- **Réexamen échu** : l'accès cesse comme avant ; le système rouvre en plus le dossier (« complément demandé »).

## Journal des décisions

`partner_access_decisions` (migration 0077), immuable :

| Décision                    | Auteur                              | Contenu                                                       |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Examen d'une candidature    | CoverView                           | état, habilitations, motif, date de réexamen                  |
| Décision sur l'organisation | CoverView                           | état, motif, date de réexamen                                 |
| Restriction                 | CoverView                           | activités et catégories, motif, date de réexamen              |
| Réexamen automatique        | système (`partner-continuity-v1`)   | état « complément demandé », date atteinte, sans motif rédigé |
| Fin d'adhésion              | responsable de l'organisation (C8b) | état « fermé », motif                                         |

- Le journal commence à la migration : aucune décision antérieure n'est reconstituée.
- La personne lit ses décisions et celles de son organisation (`GET /partner/access/decisions`, « Profil et organisation ») ; elles figurent aussi dans sa copie de données (C7, registre v2).

## Organisation validée à part

- `POST /admin/partner/organizations/:id/review` : état, motif, date de réexamen, révision. Admin sous MFA, jamais un membre de l'organisation.
- Bloquer l'organisation retire l'accès opérationnel à tous ses membres, par la même fonction que la suspension d'un membre :
  - demandes remises à CoverView pour réattribution ;
  - contributions closes ;
  - engagements futurs traités ;
  - preuves et droits économiques conservés.
- Les décisions propres aux membres ne changent pas.
- L'examen d'une candidature peut valider l'organisation encore à examiner, sur choix explicite ; la décision est journalisée à part. Un état inchangé n'écrit rien.

## Restrictions

`partner_members.restrictions`, avec sa propre révision : une restriction n'invalide ni rendez-vous, ni liaisons, ni propositions de créneaux.

| Restriction              | Effet                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nouvelles demandes       | exclu du matching (motif « restreint »), des propositions automatiques, des attributions, des transferts et co-conseils, des réservations marketplace, de l'orientation CoverView ; plus proposé comme référent ; une demande qu'il crée part à CoverView |
| Transmission de demandes | plus de création de demande ; la déclaration de conditions commerciales reste possible                                                                                                                                                                    |
| Marketplace              | ni publication, ni candidature, ni réservation ; une réservation pas encore acceptée devient caduque                                                                                                                                                      |
| Catégories exclues       | les effets « nouvelles demandes », limités à ces catégories (déclarées par la personne)                                                                                                                                                                   |

- **Ce qui continue.** Les demandes en cours, leurs tâches, rendez-vous et offres. Pour les retirer, suspendre la personne.
- **Décision.** Admin sous MFA, motif communiqué à la personne, date de réexamen facultative. L'aperçu donne le nombre de demandes en cours qui continuent. Tout décocher lève la restriction, avec motif.
- **Réexamen.** Une date de réexamen de restriction alimente la file Admin. Rien n'est levé automatiquement.

## Réexamens automatiques

- **Rappel.** À 30 jours de la date de réexamen d'un membre ou de son organisation, Partner l'affiche à l'accueil et dans « Profil et organisation » ; la file Admin la liste.
- **Échéance.** L'accès opérationnel cesse à la date, comme avant, et le worker de continuité traite les demandes.
- **Réouverture.** Dans le même tick, la personne ou l'organisation approuvée dont la date est atteinte passe en « complément demandé », avec décision automatique et événement `application.review_due` ou `organization.review_due`. Au plus 50 par tick, une seule fois.
- **Suite.** La personne met à jour et resoumet sa candidature ; CoverView la réexamine et fixe une nouvelle date.

## File Admin

L'écran des candidatures (Partner, mode Admin) devient une file filtrable :

- à examiner ;
- réexamens à 30 jours ;
- restrictions ;
- justificatifs à échéance : compétences et conventions dont l'examen expire dans 30 jours ou a expiré.

Chaque carte montre ces signaux et le nombre de demandes en cours. Elle ouvre l'examen, les restrictions, l'organisation (membres, conséquences, décision, historique) et l'historique de la personne. `GET /admin/partner/access?filter=` sert la file : 100 personnes au plus, compteurs par filtre.

## Limites

- **Notifications.** Aucune notification ni aucun email : `partner_notifications` exige une demande. L'information passe par l'accueil, la candidature et la file Admin.
- **Calendrier.** L'organisation est rouverte au plus tard une minute après sa date, au tick suivant du worker.
- **Pas de RLS**, comme dans tout le projet ; chaque lecture vérifie l'Admin ou la personne elle-même.

## Preuves

`apps/api/src/platform/partner-access.test.ts`, PostgreSQL réel :

- restrictions :
  - nouveaux engagements bloqués (matching, attribution, collaboration, référent proposé, création, marketplace, catégorie) ;
  - demandes en cours poursuivies et révision d'adhésion intacte ;
  - journal immuable, lu par la personne et refusé à un tiers ;
- organisation bloquée puis rétablie, avec membres retirés et décisions de membre inchangées ;
- réexamen automatique d'un membre et d'une organisation, rejeu sans effet, resoumission puis nouvelle validation ;
- file Admin : candidature à examiner, restriction, justificatif à échéance, refus hors Admin.
