# Comparaison des offres prestation par prestation

C4a du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.13 et III.6–9. Une seule comparaison, calculée par le serveur, sert Partner et Wallet. Elle aligne prestation par prestation le contrat actuel relié et les offres actives, sans jamais inventer une équivalence absente des documents.

## Prestations normalisées

Le référentiel versionné `benefit-catalog-v2` (`@coverview/contracts/partner-benefits`) définit des catégories comparables : franchise, responsabilité civile, casco, parking, assistance, hospitalisation, soins dentaires, capital décès, etc. Chaque catégorie déclare les besoins auxquels elle s'applique et son mode de comparaison :

| Mode | Lecture |
|---|---|
| `coverage` | inclusion ou exclusion seulement |
| `higher` | le montant structuré le plus élevé est le meilleur (limite, somme, jours) |
| `lower` | le montant structuré le plus bas est le meilleur (franchise, frais, délai d'attente) |
| `text` | aucune comparaison numérique (hospitalisation, exclusions, autre) |

La v2 (C4c) ajoute les termes de prévoyance : échéance et horizon, versements, valeurs de rachat, stratégie de placement et conséquences d'un remplacement. Ce sont des lignes de texte sourcées : elles ne sont jamais réduites à un montant comparable, et un remplacement ne produit jamais de perte calculée. Capital garanti, décès, incapacité, libération du paiement des primes, frais et délai d'attente gardent leur mode de comparaison.

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

## Contrat actuel proposé

La demande peut porter un **repère de l'objet** facultatif (`objectReference`) : numéro de police actuel, plaque ou numéro de châssis. Le client le saisit dans Wallet, l'intervenant dans Partner. Il ne sert qu'à proposer le contrat actuel ; il est gelé dès qu'une référence de contrat existe.

`GET /wallet/leads/:id/contracts` (propriétaire seulement) renvoie en plus :

- **`compatible`** : les polices du profil exact dont le domaine d'assurance correspond au besoin, listées en premier :
  - véhicule → automobile ;
  - santé → maladie et accident ;
  - ménage → ménage, responsabilité civile et bâtiment ;
  - protection juridique → protection juridique ;
  - prévoyance → 3a, 3b, prévoyance et vie.

  Entreprise et autre n'ont pas de correspondance fiable : rien n'est jamais proposé pour eux.
- **`proposal`** : présent seulement si le repère est **distinctif** (au moins cinq lettres ou chiffres, dont un chiffre) et si **une seule** police compatible le porte. La police doit avoir le même numéro de police, ou un objet assuré qui contient le repère. « Voiture », un modèle ou un repère ambigu ne proposent rien.

Wallet présélectionne la police proposée et en affiche la raison. Le propriétaire confirme toujours séparément le même objet et le partage, cases non précochées : une proposition ne vaut jamais confirmation.

## Limites

- L'orientation automatique et la recommandation validée sont décrites dans [leur document](orientation-recommendation.md) (C4b). Les spécificités prévoyance et la proposition automatique du contrat actuel relèvent de C4c.
- Le dictionnaire de suggestion couvre le français et quelques termes allemands et italiens. Une suggestion n'est jamais appliquée sans action de l'intervenant.
- Aucune migration SQL : catégorie et montant vivent dans les données JSON existantes des offres et des revues, de façon additive. Les anciennes versions restent comparables par leurs clés.
