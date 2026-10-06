# Profils publics et évaluations

C2 du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.18 et I.12. Un profil publié présente la personne aux clients qu'elle accompagne et aux partenaires. Les évaluations séparent trois dimensions et ne déduisent jamais la qualité d'une conversion.

## Profil publiable

La personne approuvée rédige sa présentation (40 à 1200 caractères), confirme sa diffusion et la soumet. Chaque soumission crée une version immuable (`partner_profile_versions`, 0068) qui porte la révision professionnelle, le nom et l'organisation déclarés.

L'Admin, avec MFA, publie ou refuse la dernière version avec un motif. La personne ne peut pas valider son propre profil, et seule elle peut le retirer ; un déclencheur l'impose (`partner_profile_reviews`). La dernière décision de publication ou de retrait fait foi. Une nouvelle version en attente ou refusée laisse visible la version publiée précédente ; un retrait masque tout.

Le reste du profil est dérivé à la lecture, jamais saisi :

- spécialités : catégories dont la compétence est examinée et valide ;
- langues et cantons : pratique déclarée courante ;
- modes : disponibilités courantes.

**Photo (C8c).** Facultative, choisie à chaque version : conserver la précédente, la retirer ou en envoyer une nouvelle.

- Le navigateur redessine l'image (JPEG, 1024 pixels au plus) : aucune donnée de l'appareil photo ni de localisation n'est envoyée.
- Le fichier suit le circuit des preuves professionnelles (finalité `partner_profile_photo`, migration 0079) :
  - octets vérifiés avant et après stockage ;
  - type détecté parmi JPEG, PNG et WebP, sinon jamais mis en file ni servi ;
  - analyse antivirus.
- La publication est refusée tant que l'image n'est pas analysée et saine. Sans photo, la fiche affiche les initiales.
- L'API sert la photo publiée à l'audience du profil (`GET /{partner|wallet}/advisors/:userId/photo`), en pièce jointe que le navigateur n'interprète pas. La personne et l'Admin lisent celle d'une version (`GET /partner/profiles/:userId/versions/:revision/photo`).
- Elle n'entre jamais dans la bibliothèque Wallet de la personne.

**Audiences** (`GET /{partner|wallet}/advisors/:userId/profile`) :

- l'Admin ;
- les membres approuvés et opérationnels ;
- le client Wallet dont une demande est suivie par cette personne, comme responsable ou contributeur ayant le droit de contact.

Un refus d'accès et une absence de profil renvoient le même `404`.

## Profil d'organisation (C8c)

- **Rédaction.** Par un responsable opérationnel de l'organisation : présentation de 40 à 1200 caractères et logo facultatif (finalité `partner_organization_logo`, PNG redessiné, 512 pixels au plus).
- **Examen.** Versions immuables (`partner_organization_profile_versions`), examinées par l'Admin sous MFA. Un déclencheur impose qu'aucun membre de l'organisation ne publie ni ne refuse, et que seul un membre retire.
- **Diffusion.** Publié, il accompagne le profil publié de chacun de ses membres, avec son logo (`GET /{partner|wallet}/advisors/:userId/organization-logo`), tant que l'organisation reste validée.
- **Écrans.** Partner : onglet « Organisation » de `/profile/public` pour le responsable. Admin : file « Profils d'organisation à examiner ».

## Évaluations

Les évaluations portent sur une période glissante de 12 mois. Elles sont visibles par la personne elle-même (droit d'accès aux données qui la concernent, R5) et par l'Admin : `GET /partner/evaluations/:userId`.

**Expérience client.** Notes 1 à 5 des enquêtes de fin de demande. La note est attribuée au responsable au moment où l'enquête est créée, par déclencheur (`partner_survey_attributions`). Un transfert ou une reprise ultérieure ne la déplace donc pas. Les enquêtes antérieures à 0068 ont été rattrapées depuis le Lead courant et sont marquées comme telles. La moyenne publique n'apparaît qu'à partir de 5 avis ; en dessous, le volume est affiché, pas la moyenne. On y trouve aussi la répartition et les points appréciés ou à améliorer.

**Qualité opérationnelle.**

- Attributions reçues, et part sans dépassement : une attribution compte comme dépassée si une escalade de continuité ou une proposition automatique est intervenue contre la personne.
- Réclamations attribuées et réclamations closes.
- Dossiers actifs, et dossiers avec un suivi daté non échu depuis plus d'un jour.

**Fiabilité économique.** Dossiers économiques où la personne est partie, contestations et reprises. Réservé à la personne et à l'Admin.

**Contestation.** La personne conteste un avis ou une réclamation qui lui est attribué, avec un motif de 10 caractères au moins. L'Admin accepte ou refuse avec un motif, une seule fois ; un déclencheur l'impose. Un élément accepté sort de tous les calculs, et la trace est conservée.

**Apporteurs, pour l'Admin seulement** (`GET /admin/partner/referrers/:userId/evaluation`) :

- demandes transmises et autorisation de transmission ;
- doublons, par résultat ou par fusion ;
- demandes invalides ;
- changements de catégorie faits par une autre personne (`lead.category_changed`, nouvel événement de l'édition).

## Interfaces et limites

- Partner : `/profile/public` (profil, aperçu, retrait, évaluations, contestations).
- Admin : `/partner/profiles` (profils et profils d'organisation à examiner, avec leur image ; contestations à trancher).
- Wallet : « Voir son profil » à côté de l'interlocuteur d'une demande.

Tests PostgreSQL 18 jetables dans `partner-profiles.test.ts` :

- publication, audiences, auto-validation refusée, version en attente, retrait, immutabilité ;
- photo, dans `partner-pictures.test.ts` : type refusé jamais mis en file, publication refusée avant analyse, audiences, absence de la bibliothèque Wallet, conservation et retrait d'une version à l'autre ;
- profil d'organisation : rédaction réservée au responsable, logo analysé avant publication, bloc dans le profil des membres, examen refusé à un membre, retrait.
- note prudente, attribution figée après transfert, contestation acceptée et décision unique ;
- attributions et dépassements, évaluation des apporteurs réservée à l'Admin.

Limites connues :

- les images sont redessinées par le navigateur, pas retraitées par le serveur : écart déclaré à STOR-04 ;
- les dimensions ne sont pas encore comparées entre dossiers de difficulté comparable ;
- la note n'alimente pas encore le classement du matching ;
- la recette authentifiée reste à faire.
