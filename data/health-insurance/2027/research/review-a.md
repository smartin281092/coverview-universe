# Recherche assureurs A — 1er octobre 2026

Artefact : `review-a.json`. Recherche indépendante autorisée CDX-05, sans modification applicative ni contact adressé aux assureurs. `benefits.json` a servi uniquement de point de départ. Les faits proviennent de pages officielles et de documents effectivement lus ; les passages sont des paraphrases.

## Couverture et vérification

**Vérifié par comparaison mécanique avec inventory.json : 16 assureurs, 64 modèles nommés, aucun modèle omis, ajouté ou mal rattaché ; 45 fiches de services, conditions ou offres.** Les identifiants, codes tarifaires et noms sont ceux de l'inventaire. Les raisons sociales ont été recroisées avec la feuille « Assureurs admis » du fichier local `insurers.xlsx`, issu de l'[annuaire OFSP octobre 2026](https://www.priminfo.admin.ch/downloads/assureurs-maladie-admis-2026-10.xlsx).

| OFSP | Marque | Modèles | Fiches | Statut documentaire |
| --- | --- | ---: | ---: | --- |
| 8 | CSS | 5 | 5 | Partiel |
| 32 | Aquilana | 3 | 3 | Partiel |
| 134 | Einsiedler | 1 | 1 | Partiel |
| 194 | Sumiswalder | 4 | 3 | Revue ciblée + partiel |
| 246 | Steffisburg | 5 | 2 | Partiel |
| 290 | CONCORDIA | 4 | 2 | Partiel |
| 312 | Atupri | 6 | 3 | Partiel |
| 343 | Groupe Mutuel | 5 | 4 | Partiel |
| 360 | Luzerner Hinterland | 3 | 2 | Partiel |
| 376 | KPT | 6 | 5 | Partiel |
| 455 | ÖKK | 5 | 2 | Partiel |
| 509 | Sympany | 6 | 3 | Revue ciblée + partiel |
| 780 | Glarner | 2 | 1 | Partiel |
| 820 | curaulta | 2 | 1 | Partiel |
| 881 | EGK | 3 | 5 | Partiel |
| 923 | SLKK | 4 | 3 | Partiel |

61 modèles portent `partial`, 3 portent `review`. **Aucun modèle n'est annoncé entièrement vérifié.** L'existence d'un tarif OFSP 2027 ne prouve ni la reconduction d'une prestation commerciale ni la validité des anciennes conditions. Les règles du modèle, territoires, contacts et exceptions utiles sont dans `confirmed` avec les sources correspondantes ; les contrôles manquants sont explicites par modèle.

## Preuves explicites concernant 2027

- **Sumiswalder HMO plus** : conditions entrant en vigueur le 01.01.2027 ; parcours à trois portes d'entrée documenté, délégation spécialiste limitée au médecin ou à la télémédecine. La gratuité n'est pas établie. Sources : [AVB HMO plus 2027](https://sumiswalder.ch/20/wp-content/uploads/2026/09/HMO-plus-AVB-Sumiswalder-2027.pdf), pages 2, 5 et 6.
- **EGK / ORTHO-TEAM** : avantage commercial explicitement valable du 01.04.2025 au 31.12.2027. Achat d'une analyse, pas remboursement LAMal. La remise exige le prospectus sur place. Sources : [offre EGK](https://www.egk.ch/fr/votre-egk/notre-profil/egk-partenaires/groupe-ortho-team) et [prospectus](https://www.egk.ch/egk-2026/dokumente/egk-partner/ortho-team-ag/ortho-team_flyer_a5_ana_v2.pdf), page 3.

Ce sont les **deux seules fiches** avec `yearConfirmed: true`. `verification: verified` sur une offre datée signifie que le fait décrit est prouvé, pas qu'il demeure actif en 2027. L'ancienne promotion SanerNatur a une fin explicite au 31.08.2026 et ne doit pas apparaître comme active.

## Points nécessitant une revue humaine ou une réponse assureur

1. **Éditions et liens incohérents.** Sympany présente des liens annoncés 2024 menant aux PDF HMO et callmed 2022. SLKK : fichiers nommés 2025 mais conditions HomeCare/TelCare 2019 et SmartMed 2022. Einsiedler : PDF sous chemin 2026, édition 2018. EGK : Care 2011 et TelCare 2014. Le JSON ne reconduit pas ces documents.
2. **Documents partiellement accessibles.** curaulta CASAMED : PDF de six pages sans extraction exploitable ; lecture manuelle à réaliser. Sumiswalder Telmed : lecture de la page dédiée en erreur malgré lien officiel. ÖKK : tableau BikeBonus trouvé par index, puis document inaccessible/404 ; plafond laissé inconnu. Les échecs et questions sont consignés, sans prétendre avoir inspecté les tableaux visuellement.
3. **Sources anciennes dans une navigation actuelle.** Luzerner Hinterland conserve une page d'offres pharmacie contenant des indications légales anciennes ; remises à revalider. curaulta renvoie à Cumpletta de vita surselva, édition 2004 : produit complémentaire et porteur à confirmer pour 2027.
4. **Périmètre et montants.** CSS Multimed annonce un plafond de quote-part adulte que le règlement consulté ne chiffre pas dans son article général. Sympany carte-piscine : incohérence d'année de naissance avec la limite d'âge annoncée. Ces points restent partiels/contradictoires.
5. **Assistance Einsiedler.** La page actuelle exclut plusieurs services d'assistance à l'étranger annoncés par l'ancien magazine 1/2024. L'audit retient les limites actuelles et conserve une question sur ce changement.
6. **Clubs non démontrés.** Pour Einsiedler, Sumiswalder, GLKV et curaulta, la recherche des pages officielles et rubriques partenaires n'établit pas un catalogue complet de club. Cela ne signifie pas qu'aucun avantage existe. Services et rabais complémentaires effectivement trouvés sont enregistrés séparément ; les lacunes demeurent dans `missing`.

Les questions `operatorQuestion` sont préparées pour la curation. Aucun e-mail, formulaire ou message externe n'a été envoyé.

## Règles de lecture pour une future intégration

- Une fiche `commercial` ne diminue jamais une prime OFSP. `extraCostMinor` indique un achat ou accès supplémentaire connu ; `capMinor` ne signifie pas remboursement automatique.
- `requiresSupplementary`, `requiresSameBase` et montants inconnus restent `null`. Un `modelIds` vide ne signifie pas automatiquement tous les modèles : lire l'éligibilité et les questions.
- Conseil téléphonique, tri numérique, prescription, téléconsultation et traitement sont distincts. Une gratuité du premier conseil n'exonère pas les actes suivants.
- Une exemption de franchise n'est pas une suppression de quote-part. PrimaFlex est documenté avec cette distinction ; les dépistages n'ont pas été généralisés à toute mammographie.
- Les prestations de prévention légales communes ou publiques ne sont pas étiquetées comme exclusivités commerciales. Cet audit ne prouve jamais l'unicité d'une prestation.
- Les capacités d'admission des cabinets et pharmacies ne sont pas vérifiées. Les liens vers les réseaux prouvent un point d'entrée, pas l'acceptation du visiteur.
- Les dates d'édition citées restent des éléments historiques tant que la validité 2027 n'est pas expressément établie.

## Oracles et limites

**Vérifié** : lecture des sources citées, correspondance des 64 modèles, intégrité des références de modèles dans les fiches, JSON UTF-8 analysable et champs requis présents. **Fait non vérifié** : disponibilité locale des prestataires, parcours d'adhésion, clauses complètes de toutes les annexes, reconduction 2027 des offres marquées non confirmées. **Aucune hypothèse transformée en absence ou en gratuité.**

Livraison limitée aux deux artefacts de recherche autorisés. Aucun test applicatif, migration, dépendance, job, événement ou changement de permissions.

