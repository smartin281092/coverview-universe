# Profils publics et évaluations

C2 du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.18 et I.12. Un profil publié présente la personne aux clients qu'elle accompagne et aux partenaires. Les évaluations séparent trois dimensions et ne déduisent jamais la qualité d'une conversion.

## Profil publiable

La personne approuvée rédige sa présentation (40 à 1200 caractères), confirme sa diffusion et la soumet. Chaque soumission crée une version immuable (`partner_profile_versions`, 0068) qui porte la révision professionnelle, le nom et l'organisation déclarés.

L'Admin, avec MFA, publie ou refuse la dernière version avec un motif. La personne ne peut pas valider son propre profil, et seule elle peut le retirer ; un déclencheur l'impose (`partner_profile_reviews`). La dernière décision de publication ou de retrait fait foi. Une nouvelle version en attente ou refusée laisse visible la version publiée précédente ; un retrait masque tout.

Le reste du profil est dérivé à la lecture, jamais saisi :

- spécialités : catégories dont la compétence est examinée et valide ;
- langues et cantons : pratique déclarée courante ;
- modes : disponibilités courantes.

La photo n'est pas encore gérée (sous-étape C2b) : la fiche affiche les initiales.

**Audiences** (`GET /{partner|wallet}/advisors/:userId/profile`) :

- l'Admin ;
- les membres approuvés et opérationnels ;
- le client Wallet dont une demande est suivie par cette personne, comme responsable ou contributeur ayant le droit de contact.

Un refus d'accès et une absence de profil renvoient le même `404`.

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
- Admin : `/partner/profiles` (publications à examiner, contestations à trancher).
- Wallet : « Voir son profil » à côté de l'interlocuteur d'une demande.

Tests PostgreSQL 18 jetables dans `partner-profiles.test.ts` :

- publication, audiences, auto-validation refusée, version en attente, retrait, immutabilité ;
- note prudente, attribution figée après transfert, contestation acceptée et décision unique ;
- attributions et dépassements, évaluation des apporteurs réservée à l'Admin.

Limites connues :

- pas encore de photo ni de profil d'organisation ;
- les dimensions ne sont pas encore comparées entre dossiers de difficulté comparable ;
- la note n'alimente pas encore le classement du matching ;
- la recette authentifiée reste à faire.
