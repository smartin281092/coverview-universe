# AXA : relevé des primes LCA 2027

Relevé du 2026-11-18 dans le calculateur officiel. Fichier : `axa.csv` (11 840 lignes). Script : `collectors/axa.mjs`.

## Calculateur

- URL : https://www.axa.ch/health-dsn/fr (application Next.js, client Apollo). Seul hôte utilisé : `www.axa.ch`.
- AXA ne vend pas d'assurance de base : aucune base n'est incluse dans les prix, et le calculateur n'applique aucun rabais de combinaison avec une base.
- Étapes du calculateur : 1 Ménage (NPA/localité, date de naissance, sexe), 2 Comparaison des produits (prix), 3 Panier, puis données personnelles. Le relevé s'arrête à l'étape 2. Aucune coordonnée saisie, aucun questionnaire, aucune proposition.

## Méthode : API rejouée

Les prix viennent de `POST https://www.axa.ch/health-dsn/api/graphql`, en requêtes GraphQL persistées (le corps porte `operationName`, `variables` et `extensions.persistedQuery.sha256Hash`, sans texte de requête). La session tient dans le cookie `HEALTH_DSN_SESSION_TOKEN`, posé au chargement de la page. Le script ouvre la page une fois avec Playwright, puis rejoue les appels avec `fetch` dans le contexte de la page.

| Opération | Rôle | Empreinte observée le 2026-11-18 |
| --- | --- | --- |
| `Session` | lit la session courante (`uuid`, `dateCreated`, `dateUpdated`) | `90099b81ad518ce4ed694c4d9d30a129e039bc1638fcdc14c6ad19c081296711` |
| `MunicipalitySearch` | NPA vers `bfsNo` + `zipOrderNo` (variables : `searchString`) | `73c842a1e4ad22aad2232eae9dc6d4ddbfb504a813085307c6fa95513607b286` |
| `UpdateSession` | enregistre ménage et domicile, renvoie les produits et prix de chaque personne dans `profiles[].productsNew[]` | `2c73fd2a4fc4260e716f19db45224a9842feb802cc8e540144d184251acea5cb` |
| `updateDsnProductCriteriaSelection` | change une option d'un produit (utilisée par l'interface, pas par le script) | `9a6844d948c0e578cf17d8c1c40cb19ee016397a6f2d0963a4b8ff0ce9879622` |
| `updateDsnProductSelection` | met un produit au panier (interface seulement) | `f495dd0e134926e1f0cc4127cbc35f9e5ef52e2e458816388cadbe0be5d1ce1d` |
| `StaticProducts` | catalogue des produits et de leurs critères tarifaires | `2018acd8f8378dadbd06311e92618881f65f1bb46527e157ffb75299567b18d4` |

Les empreintes changent probablement à chaque déploiement : le script reprend celles que la page émet (`Session`, `UpdateSession`, `MunicipalitySearch`) et ne garde les valeurs ci-dessus qu'en secours.

Points utiles de `UpdateSession` :

- Variables : `step: "HOUSEHOLD"`, `language: "FR"`, `session: { uuid, dateCreated, dateUpdated, profiles: [...], residence: { bfsNo, zipOrderNo }, distributionPartner: { extId: "CP-DIRECT-SALE" }, ... }`.
- Un profil : `{ uuid, gender: FEMALE|MALE, birthDate, contractBeginDate, firstName, profileType }`. Le serveur recalcule `profileType` (ADULT/CHILD) d'après la date de naissance.
- `selectedProducts` et `productConfigurations` peuvent être envoyés dans le même appel : un seul appel donne donc les prix d'une personne pour une configuration complète (franchises, sommes d'assurance).
- Réponse par produit : `price.priceInCents`, `price.id` (code tarifaire, repris dans `notes` sous `tariff_id`), `productCriterias` (options possibles et valeur retenue), `discountRules`, `futureProductsWithPrices`.
- Le code tarifaire se lit ainsi : `AG_` groupe d'âge, `GS_` sexe, `PR_` région de prime (produits d'hospitalisation seulement), `JF_` participation aux coûts, `UZ_` accident, `FR_` rabais famille, `KR_` rabais enfant, `VS_` somme d'assurance.

Un appel par personne et par configuration, 1,1 s au minimum entre deux appels, une seule session. 1 237 appels au total, aucun blocage, aucun captcha, aucune erreur hors refus d'âge attendus.

## Profil réellement appliqué

- Début d'assurance : 01.01.2027 (valeur par défaut du calculateur, « janvier 2027 »).
- Naissance le 15.06 de chaque année, femme et homme. `age` = 2027 − année de naissance.
- **Une seule personne par session.** Avec plusieurs personnes le calculateur applique un rabais famille directement dans le prix affiché : observé avec 1 adulte + 2 enfants, `largeFamilyDiscount`, code `FR_V02`, −10 % sur tous les produits. Le catalogue annonce des paliers de 5 % et 10 % ; le cas à deux personnes n'a pas été testé. Les prix du CSV portent tous le code `FR_V00_1` (sans rabais famille).
- Couverture accident incluse (`accident=true`) pour les produits qui ont l'option : les cinq produits d'hospitalisation et les trois produits Santé. Colonne vide pour les produits sans option accident (dentaire, CAPITAL, Indemnité d'hospitalisation, Accident Privé).
- Participation aux coûts : CHF 0 par défaut pour « Semi-privée » et « Division privée » (`option` vide). Les variantes CHF 1000, 3000 et 5000 sont relevées **pour Lausanne seulement**.
- Aucune durée de contrat choisie : le critère « Durée contractuelle » existe dans le catalogue mais n'entre pas dans le prix à cette étape.
- Prix bruts mensuels, sauf la gratuité de la première année de vie (voir Anomalies).

### Localités

| NPA | Localité | Commune retenue (n° OFS) | Région de prime hospitalisation |
| --- | --- | --- | --- |
| 1003 | Lausanne | Lausanne (5586) | `PR_V04` |
| 1204 | Genève | Genève (6621) | `PR_V02` |
| 1950 | Sion | Sion (6266), parmi Savièse, Grimisuat, Sion | `PR_V05` |
| 2000 | Neuchâtel | Neuchâtel (6458), parmi Milvignes, Neuchâtel | `PR_V04` |
| 1700 | Fribourg | Fribourg (2196), parmi Fribourg, Düdingen, Tafers | `PR_V04` |
| 2800 | Delémont | Delémont (6711), parmi Courrendlin, Delémont | `PR_V03` |

Seuls « Semi-privée », « Division privée », « Flex 1 » et « Flex 2 » varient selon la localité. Les dix autres produits ont le même prix dans les six localités ; Lausanne, Neuchâtel et Fribourg ont des prix identiques partout. Exemple, femme née en 1990, Semi-privée : Lausanne 114.30, Genève 139.70, Sion 101.60, Delémont 127.00.

## Produits relevés

14 produits, `product_name` = nom complet renvoyé par l'API, `variant` = titre de la carte dans le calculateur. `product_key` est vide : `../insurers/axa.json` n'existe pas encore. L'identifiant interne figure dans `notes` (`internal=`).

| Groupe à l'écran | `product_name` | `variant` | Identifiant interne | Options relevées | Conditions complémentaires |
| --- | --- | --- | --- | --- | --- |
| Hospitalisation | Hôpital division semi-privée | Semi-privée | `PRD_SV_HPS_V001` | participation 0 (défaut), 1000, 3000, 5000 | https://www.axa.ch/doc/adm4s |
| Hospitalisation | Hôpital division commune | Division commune | `PRD_SV_ALG_V001` | aucune | https://www.axa.ch/doc/admvv |
| Hospitalisation | Hôpital division privée | Division privée | `PRD_SV_PRS_V001` | participation 0 (défaut), 1000, 3000, 5000 | https://www.axa.ch/doc/adm89 |
| Hospitalisation | Hôpital Flex 1 | Flex 1 | `PRD_SV_FL1_V001` | aucune | https://www.axa.ch/doc/admzc |
| Hospitalisation | Hôpital Flex 2 | Flex 2 | `PRD_SV_FL2_V001` | aucune | https://www.axa.ch/doc/admzc |
| Indemnité d'hospitalisation | Indemnité d'hospitalisation | Indemnité d’hospitalisation | `PRD_KV_SPG_V001` | somme 3000 (défaut), 1000, 2000 | https://www.axa.ch/doc/afmvz |
| Accident | Accident Privé | Accident Privé | `PRD_SV_UPR_V001` | aucune | https://www.axa.ch/doc/agbbt |
| Santé | Santé COMPLET | COMPLET | `PRD_AV_COM_V001` | aucune | https://www.axa.ch/doc/adng9 |
| Santé | Santé ACTIF | ACTIF | `PRD_AV_ACT_V001` | aucune | https://www.axa.ch/doc/adncs |
| Santé | Santé PLUS | PLUS | `PRD_AV_PLU_V001` | aucune | https://www.axa.ch/doc/adnkp |
| Dentaire | Assurance dentaire 1000 | Dentaire 1000 | `PRD_ZV_ZA1_V001` | aucune | https://www.axa.ch/doc/admny |
| Dentaire | Assurance dentaire 2000 | Dentaire 2000 | `PRD_ZV_ZA2_V001` | aucune | https://www.axa.ch/doc/admny |
| Dentaire | Assurance dentaire 3000 | Dentaire 3000 | `PRD_ZV_ZA3_V001` | aucune | https://www.axa.ch/doc/admny |
| Capital | CAPITAL | CAPITAL | `PRD_KV_KAP_V001` | sommes par défaut seulement | https://www.axa.ch/doc/aemp9 |

Les liens de conditions sont ceux que l'API fournit ; ils n'ont pas été ouverts.

Lignes : Lausanne 2 840 (1 800 par défaut + 1 040 d'options), les cinq autres localités 1 800 chacune (variante par défaut).

### Indemnité d'hospitalisation

Le calculateur ne la tarife que si un produit d'hospitalisation est au panier (« ne peut être assurée qu'en complément d'une assurance complémentaire hospitalisation stationnaire auprès d'AXA et non seule ») ; sinon la carte n'affiche pas de prix. Le script met donc « Semi-privée » au panier dans chaque appel. Vérifié : cette sélection ne change le prix d'aucun autre produit. Le prix relevé est celui de l'indemnité seule, il faut y ajouter un produit d'hospitalisation. Le code tarifaire ne contient ni sexe ni région.

### CAPITAL

Relevé avec les sommes que le calculateur propose par défaut, rappelées dans `notes` (`default_option`) :

- 1 à 55 ans : maladie décès 10 000, maladie invalidité 100 000, accident décès 10 000, accident invalidité 100 000.
- 56 à 65 ans : accident décès 10 000 et accident invalidité 100 000 seulement. Le calculateur ne propose plus les sommes maladie, d'où la baisse du prix (55.20 à 51-55 ans, 12.90 à 56-60 ans).

## Limites d'âge constatées

| Année de naissance | Âge 2027 | Constat |
| --- | --- | --- |
| 1947 à 1960 | 67 à 80 | Refus du formulaire : `BIRTHDATE_OLDER_THAN_65`, « Nous ne proposons pas d’assurance complémentaire aux personnes de plus de 65 ans ». Aucune ligne. |
| 1961 | 66 | Date acceptée mais liste de produits vide. Aucune ligne. La règle suit l'année civile : né le 31.12.1961, aucun produit ; né le 01.01.1962, produits proposés. |
| 1962 à 1966 | 61 à 65 | 12 produits : tous sauf Flex 1 et Flex 2. |
| 1967 à 2026 | 1 à 60 | 14 produits. |

Le CSV couvre donc les années de naissance **1962 à 2026** (âges 1 à 65), pour chaque année et les deux sexes. Les 14 années 1947-1960 ont toutes été testées à Lausanne (2 sexes) ; dans les cinq autres localités le script s'arrête après deux années refusées de suite (1960 et 1959), le refus ne dépendant pas du domicile.

## Tranches tarifaires observées

Chaque année a été relevée, aucune ligne n'est déduite (`derived_from_band` n'apparaît pas). Les tranches suivent l'âge en année civile (2027 − année de naissance) :

- Hospitalisation, Indemnité, Accident Privé, CAPITAL : tranches de cinq ans, 1-5, 6-10, …, 61-65 (codes `S01` à `S13`, `M01` à `M13`).
- Santé et Dentaire : 1-18, 19-25, 26-35, 36-45, 46-55, 56-65 (codes `D00`, `D04` à `D08`).
- Le sexe ne joue que sur les cinq produits d'hospitalisation.

## Produits du calculateur absents du relevé

- **myTravel** (`PRD_RV_MTR_V001`) : présent dans le catalogue `StaticProducts`, jamais proposé ni tarifé à l'étape de comparaison. Assurance voyage.
- **Variantes sans couverture accident** : non relevées, le profil demande l'accident inclus. Un seul point observé à l'écran : Semi-privée, femme 1990, Lausanne, 106.30 sans accident contre 114.30 avec.
- **CAPITAL, autres sommes d'assurance** : quatre sommes indépendantes de 0 à 300 000 (jusqu'à 500 000 dans le catalogue pour trois d'entre elles), soit plusieurs centaines de combinaisons par personne. Seule la combinaison par défaut est relevée.
- **Participation aux coûts 1000/3000/5000 et sommes 1000/2000 de l'indemnité hors Lausanne** : non relevées pour limiter la charge (3 appels de plus par personne et par localité). `--options=all` les ajoute.
- **Enfant à naître** (case du formulaire) : non relevé.

## Vérifications à l'écran

Parcours complet de l'interface pour cinq profils, lecture des cartes de l'étape « Comparaison des produits », comparaison au CSV : **67 prix identiques, aucun écart**.

| Profil | Produits comparés | Résultat |
| --- | --- | --- |
| Femme, 15.06.1990, 1003 Lausanne | 13 + Semi-privée avec participation 1000 (102.90) + Indemnité après ajout de Semi-privée au panier (21.00) + relecture de Semi-privée et COMPLET après l'ajout | identiques |
| Homme, 15.06.1962, 1003 Lausanne | 11 (pas de Flex) | identiques |
| Femme, 15.06.2026, 1003 Lausanne | 13, dont cinq à CHF 0.00 | identiques |
| Homme, 15.06.1975, 1204 Genève | 13 | identiques |
| Femme, 15.06.2012, 1950 Sion (option « 1950 Sion ») | 13 | identiques |

Sans produit d'hospitalisation au panier, la carte « Indemnité d’hospitalisation » n'affiche pas de prix : elle n'est comparée que pour le premier profil. Les prix par défaut lus à l'écran l'ont été sans rien au panier, ce qui confirme que la sélection utilisée par le script ne les modifie pas.

## Anomalies et points d'attention

- **Première année de vie gratuite (année de naissance 2026).** Cinq produits affichent CHF 0.00 : Semi-privée, Flex 1, Flex 2, Accident Privé, Dentaire 1000 (règle `firstYearDiscount`, code `KR_V01`). L'écran indique « 1re année de vie gratuite. Ensuite : CHF 31.50/mois ». `monthly_chf` vaut 0.00, le prix affiché au 01.01.2027 ; le prix suivant et sa date d'effet (premier anniversaire, 15.06.2027) sont dans `notes` (`discounts_included=firstYearDiscount; price_from_2027-06-15=31.50`). 66 lignes concernées. Pour comparer hors gratuité, utiliser `price_from_…`.
- **CAPITAL baisse à 56 ans** : effet de la disparition des sommes maladie, pas une erreur de relevé.
- **Année 1961** : le formulaire accepte la date, puis ne propose aucun produit, sans message à l'étape des prix.
- **Hôtes bloqués par le proxy**, sans effet sur les prix : `dok.js-cdn.dynatrace.com` (mesure de performance Dynatrace), `load.trk.axa.ch` (traceur AXA), `i.ytimg.com` (vignettes des vidéos YouTube de la page d'accueil).

## Relancer

```bash
NODE_PATH=$(npm root -g) node collectors/axa.mjs                      # relevé complet, environ 33 minutes
NODE_PATH=$(npm root -g) node collectors/axa.mjs --localities=1003 --years=1985-1995 --out=/chemin/essai.csv
```

Options : `--out`, `--localities` (NPA séparés par des virgules), `--years=début-fin`, `--options=first|all|none` (localités où relever franchises et sommes), `--raw=fichier.jsonl` (réponses brutes), `--append`.
