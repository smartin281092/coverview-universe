# Comparaison des offres prestation par prestation

C4a du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.13 et III.6–9. Une seule comparaison, calculée par le serveur, sert Partner et Wallet. Elle aligne prestation par prestation le contrat actuel relié et les offres actives, sans jamais inventer une équivalence absente des documents.

## Prestations normalisées

Le référentiel versionné `benefit-catalog-v1` (`@coverview/contracts/partner-benefits`) définit des catégories comparables : franchise, responsabilité civile, casco, parking, assistance, hospitalisation, soins dentaires, capital décès, etc. Chaque catégorie déclare les besoins auxquels elle s'applique et son mode de comparaison :

| Mode | Lecture |
|---|---|
| `coverage` | inclusion ou exclusion seulement |
| `higher` | le montant structuré le plus élevé est le meilleur (limite, somme, jours) |
| `lower` | le montant structuré le plus bas est le meilleur (franchise, frais, délai d'attente) |
| `text` | aucune comparaison numérique (hospitalisation, exclusions, autre) |

Une prestation d'offre ou de revue du contrat actuel garde son libellé, sa valeur, ses conditions, ses exclusions et sa source. Elle reçoit, de façon additive :

- une **catégorie normalisée**. L'intervenant la choisit à la saisie ; un dictionnaire déterministe la suggère d'après le libellé, sans rien imposer. Les anciennes clés (`deductible`, `parking`, `hospitalization`…) sont reprises par une table de correspondance, et « autre » reste regroupé par libellé normalisé ;
- un **montant structuré** facultatif `{ valeur, unité, période }`, seulement si le document l'indique. Unités : CHF en centimes, % en centièmes, jours. Périodes : par événement, par jour, par année, au total.

À la revue (`offer_review`, `contract_review`), un montant structuré exige, comme une inclusion ou une exclusion, la page et l'extrait exact présents dans l'original de cette version. Une prestation marquée absente ne peut pas porter de montant.

## États d'une cellule

Avec un contrat actuel relié, chaque cellule d'offre est qualifiée face à lui :

| État | Condition |
|---|---|
| `identical` | mêmes couverture, valeur, conditions et exclusions, les deux vérifiées |
| `added` / `removed` | exclusion vérifiée → inclusion vérifiée, ou l'inverse |
| `better` / `worse` | montants structurés, vérifiés, sourcés avec page, de même unité et période, différents |
| `exclusions_changed` | identiques sauf les exclusions |
| `changed` | valeurs vérifiées différentes, sans comparaison numérique possible |
| `to_verify` | offre non revue, échue ou de source changée ; valeur à vérifier, calculée ou sans source ; plusieurs lignes d'une offre dans la même catégorie |
| `missing` | absente d'un côté : une absence n'est jamais une exclusion |

Garde-fous repris du [relais 175f](../README.md#contrat-actuel-exact-et-comparaison--relais-175f) :

- une valeur libre différente reste « différente », sans promesse d'équivalence ;
- une inclusion incertaine ne devient ni gain ni perte ;
- la différence de prime n'apparaît qu'avec les deux primes vérifiées. Le facteur d'annualisation est affiché (mois ×12, trimestre ×4, semestre ×2).

Sans contrat actuel relié, les cellules n'ont pas d'état : la comparaison ne conclut rien sur un maintien.

Dans chaque ligne, la **meilleure limite des offres** est marquée quand au moins deux montants structurés, vérifiés et sourcés partagent l'unité et la période du premier.

## Restitution

- `leadDetail.offerComparison` (`GET /{partner|wallet}/leads/:id`), colonnes dans l'ordre des cartes d'offres. Wallet ne compare que les versions qui lui ont été publiées.
- Une ligne est principale si une offre y gagne, y perd ou y diffère par ses exclusions. La vue synthétique montre :
  - la prime annuelle ;
  - le bilan « ce que je gagne, ce que je perds » ;
  - les lignes principales, ou les six premières.

  « Voir toutes les prestations » ouvre la matrice complète, avec chaque source et sa page.
- Gains et pertes sont toujours affichés ensemble. Choisir de conserver le contrat actuel reste une décision distincte.
- Le composant `ComparisonMatrix` (`@coverview/ui`) n'affiche que ce que l'API calcule. Le regroupement par libellé côté client a disparu, tout comme l'ancienne comparaison par carte (`SourcedComparison`).
- Le champ `comparisons` reste servi pour les indicateurs de pilotage et la compatibilité.

## Limites

- L'orientation automatique et la recommandation validée sont décrites dans [leur document](orientation-recommendation.md) (C4b). Les spécificités prévoyance et la proposition automatique du contrat actuel relèvent de C4c.
- Le dictionnaire de suggestion couvre le français et quelques termes allemands et italiens. Une suggestion n'est jamais appliquée sans action de l'intervenant.
- Aucune migration SQL : catégorie et montant vivent dans les données JSON existantes des offres et des revues, de façon additive. Les anciennes versions restent comparables par leurs clés.
