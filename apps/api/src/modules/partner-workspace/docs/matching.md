# Matching et réattribution automatique bornée

Décision utilisateur 2a du 4 octobre 2026 ([plan](../../../../../../roadmap/plans/partner-completion.plan.md)). Le système classe les intervenants à partir des déclarations validées par CoverView, explique chaque proposition, et un humain décide. Brief I.10.2–10.4, I.11.3 et II.9.

## Classement

**Candidats.** Conseillers approuvés de la catégorie du Lead : organisation approuvée, rôle conseiller, réexamen non échu, accès non révoqué. Au plus 100 profils sont évalués, et la troncature est signalée. Le responsable courant est exclu.

**Exclusions (comptées par motif, jamais nominatives).**

- compétence non examinée ou non valide pour la catégorie ;
- aucune convention examinée et valide pour la catégorie ;
- langue ou canton qui diffèrent d'un souhait client confirmé ;
- absence déclarée en cours ;
- capacité déclarée « indisponible ».

Une déclaration absente reste « à confirmer » : elle n'exclut pas, mais elle classe plus bas et elle est signalée.

**Ordre lexicographique.**

1. référent choisi par le client, puis intervention passée pour ce client ;
2. nombre de critères concordants (langue, zone, mode), mode discordant, puis nombre d'inconnues ;
3. compétence de catégorie avant compétence limitée, convention de catégorie avant convention limitée ;
4. disponibilité dans les 14 jours, déclarée sans créneau proche, puis non déclarée ;
5. capacité ouverte, au cas par cas, puis inconnue ;
6. charge observée, puis attributions des 30 derniers jours ;
7. identifiant, pour un ordre stable.

**Données exclues.** Aucune donnée économique (conditions, commissions, rémunérations) n'est lue. Les conflits propres au besoin sont déclarés par la personne une fois en charge : le classement les signale « à confirmer » et ne les déduit jamais.

## Décision humaine et traçabilité

`GET /partner/leads/:id/matching` est réservé à l'Admin, avec MFA récent. La projection contient les 10 premiers candidats avec leurs statuts, des raisons et réserves sous forme de clés, les compteurs d'exclusion et les 20 dernières décisions. Aucun texte privé des dossiers professionnels n'y figure. Sans candidat éligible, la recommandation est la file CoverView, et aucun « meilleur conseiller » n'est affiché.

La commande `assign` recalcule le classement sur le Lead verrouillé. Un `matchingBasis` différent de l'empreinte courante renvoie `409` et impose une nouvelle lecture. L'empreinte suit le résultat du classement, pas les révisions des déclarations. Le motif, déjà obligatoire, documente le choix ; il devient le motif d'écart quand la personne choisie n'est pas la première éligible.

`partner_matching_decisions` (0067) est en ajout seul : un déclencheur refuse modification et suppression. Une décision conserve :

- le type (`manual` ou `automatic`) et l'acteur, ou le système ;
- la personne choisie, son rang et la première du classement ;
- l'indicateur d'écart et le motif ;
- l'empreinte, l'instantané des 10 premiers (identifiants et statuts) et les exclusions.

## Réattribution automatique

La politique de continuité porte `automaticReassignments` (0 à 3, défaut 1), réglable dans Admin. Un dossier peut atteindre son échéance d'escalade sans attente valide, ou perdre l'habilitation de son responsable. Dans ce cas, le worker vérifie le nombre de propositions automatiques depuis la dernière décision humaine. Si ce nombre est inférieur au quota, il propose le dossier au premier éligible, en excluant le responsable sortant et toutes les personnes déjà sollicitées dans la chaîne.

La personne doit accepter : c'est la décision humaine de l'intervenant. La proposition reprend les effets d'une attribution :

- accès et tâches transférés, rendez-vous futurs du sortant annulés ;
- nouveau cycle et nouvelles échéances ;
- événement CoverView `lead.reassigned_automatically` ;
- événement client neutre, qui ne promet aucun appel avant l'acceptation.

Au-delà du quota, ou sans candidat, la reprise humaine CoverView s'applique comme avant.

## Vérification et limites

Tests PostgreSQL 18 jetables dans `partner-matching.test.ts` :

- classement, explications et exclusions ;
- absence de texte privé, refus des non-administrateurs ;
- décision avec écart, empreinte périmée, immutabilité ;
- réattribution automatique bornée, quota zéro et absence de candidat.

Limites connues :

- les profils publics et les évaluations de qualité (I.18) n'alimentent pas encore le classement ;
- l'évaluation lit jusqu'à 100 dossiers par appel, débit limité à 20 appels par minute ;
- le worker calcule le classement dans son lot transactionnel. Une évaluation ensembliste en SQL sera nécessaire au-delà de quelques centaines de conseillers par catégorie ;
- la recette authentifiée reste à faire.
