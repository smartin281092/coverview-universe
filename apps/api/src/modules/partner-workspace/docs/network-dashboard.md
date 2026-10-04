# Cartes de Leads et pilotage du réseau

C5b et C5c du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.7, II.6 et II.14.

## Carte de Lead (C5b)

La carte reste compacte : elle donne ce qu'il faut pour décider de la prochaine action, et le détail reste dans la fiche. Le résumé (`leadSummarySchema`) apporte, pour un accès opérationnel seulement :

- `referrerName` : l'apporteur, quand c'est un professionnel distinct du responsable ;
- `lastContactAt` : le dernier contact utile (contact établi ou rendez-vous effectué) ;
- `lastActivityAt` : la dernière activité, hors simples consultations ;
- `indicators` :

| Indicateur | Condition, sur un Lead actif |
|---|---|
| `stale` | aucune activité depuis 7 jours, hors consultations |
| `urgent` | priorité urgente |
| `task_overdue` | une tâche ouverte en retard |
| `appointment_today` | prochain rendez-vous aujourd'hui, heure de Zurich |
| `near_deadline` | moins de 4 heures avant la limite de 24 heures de la première action |
| `coverview_needed` | sans responsable, ou repris ou à réattribuer par CoverView |

La carte affiche aussi :

- la prochaine action et son échéance ;
- la date du prochain rendez-vous et le dernier contact utile ;
- le responsable, l'apporteur et le nombre de jours dans l'étape ;
- le nombre de tâches ouvertes ;
- **toutes** les alertes, et non plus la première seule.

Un apporteur qui ne suit que l'avancement ne reçoit ni ce contexte ni ces indicateurs.

La valeur économique reste celle déjà exposée (`estimatedCommissionMinor`, libellée comme estimation). Aucune estimation n'est encore rattachée aux Leads ordinaires : rien n'est affiché plutôt qu'une valeur supposée. Aucun signal de document manquant n'existe au niveau du Lead.

## Pilotage du réseau (C5c)

Page Admin `/partner/pilotage`, sous MFA, filtrée par période (30, 90 ou 365 jours) et par catégorie. Elle combine deux sources.

**Pilotage existant** (`/partner/pilotage`, portée réseau) :

- bloc réseau : partenaires et conseillers actifs, nouveaux inscrits, demandes de validation, membres suspendus ;
- répartitions par catégorie, conseiller et partenaire ;
- mesures d'activité, de qualité, de performance et d'économie, avec leur statut (« source insuffisante », « hors de vos droits »…).

**Aperçu réseau** (`GET /admin/partner/overview`, Admin seulement) :

- **suivi, état actuel :** Leads actifs, sans prochaine action, règle des 24 heures dépassée, suivi en retard, sans responsable, repris par CoverView ;
- **réattributions de la période :** décisions manuelles faisant suite à une décision antérieure, et propositions automatiques. Elles sont tracées depuis le matching expliqué (C1) ;
- **comparaison des conseillers :** Leads actifs, clôturés sur la période, avec contrat, conversion, cycle jusqu'au contrat, retards. La satisfaction n'apparaît qu'à partir de 5 avis, selon les mêmes règles que la note publique (enquêtes invalidées et contestations acceptées exclues) ;
- **comparaison des partenaires :** les mêmes agrégats par organisation du responsable.

Chaque nombre ouvre la liste Partner des Leads concernés avec les filtres correspondants : vue, alerte, attribution, conseiller, organisation, catégorie. Ces filtres restent bornés par les droits de la personne connectée.

**Limites.** Les commissions signées restent indisponibles tant qu'aucune preuve de signature n'est raccordée. L'économie d'équipe et d'organisation suit les restrictions du pilotage. Les anomalies ne sont pas encore une famille de mesures.

## Rentabilité CoverView (C6c)

Brief I.21 : « recettes et coûts de qualification, traitement, contrôle et suivi, par Lead et par branche lorsque disponibles ».

- **Recettes.** L'aperçu réseau reprend la mesure `coverview_revenue` des statistiques, par le même calcul (`pilotageMeasures`), pour le réseau entier puis pour chaque branche de la période. Les deux écrans donnent donc toujours la même valeur.
  - La mesure est la variation de la part contractuelle CoverView des encaissements consignés.
  - C'est un total opérationnel, pas un chiffre d'affaires comptable validé.
  - Réservée à l'Admin, comme dans les statistiques.
  - Le détail par Lead s'ouvre dans les statistiques, avec la même période et la même branche.
- **Coûts.** Aucune donnée de coût n'est saisie dans CoverView : qualification, traitement, contrôle, suivi. La rentabilité n'est donc **pas calculée**, et l'écran le dit (« non saisis »). Aucun coût n'est supposé.
- **Absence de donnée.** Une branche sans encaissement affiche « pas d'observation comparable », jamais CHF 0.
- **Preuve.** Le scénario économique de `platform/partner-quality-pilotage.test.ts` vérifie la même recette (statistiques, aperçu, branche concernée), une autre branche sans observation, et des coûts « non saisis ».
