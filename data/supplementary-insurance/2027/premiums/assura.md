# Assura — relevé des primes LCA 2027 dans le calculateur officiel

Relevé du 2026-11-18 : **25 896 lignes** dans `assura.csv`, 13 produits complémentaires (21 couples produit/variante), naissances 1947 à 2026, femme et homme, 6 localités. Les prix viennent de l'API du calculateur, rejouée depuis la page ; trois profils ont été comparés à l'écran, sans écart.

## Calculateur

- URL : https://calculator.assura.ch/fr (« Assura - Configurateur de produits », application Next.js).
- Parcours : formulaire (sexe, prénom, date de naissance, code postal et localité) → « Sauvegarder » → page des modèles d'assurance de base → « Choisissez vos assurances complémentaires » → cartes des produits complémentaires. Le relevé s'arrête à cette page ; rien n'a été envoyé (ni récapitulatif, ni offre, ni coordonnées).
- Aucun captcha ni blocage rencontré.

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `calculator.assura.ch` | page, scripts | atteint |
| `cms-blue.assura.ch` | CMS : catalogue de produits, textes (aucun prix) | atteint |
| `public-api.assura.ch` | API du calculateur : localités et prix | atteint (ouvert en cours de session ; refusé par le proxy au premier passage) |
| `www.assura.ch`, `static.assura.ch` | site public, documents | non nécessaires au relevé |
| `web.cmp.usercentrics.eu`, `io.fusedeck.net`, `www.googletagmanager.com`, `westeurope-0.in.applicationinsights.azure.com` | consentement, traceurs, télémétrie | refusés par le proxy, sans importance |

## Méthode et points d'API

API rejouée. `collectors/assura.mjs` parcourt d'abord le formulaire pour trois profils de contrôle, puis rejoue la requête de prix depuis la page du calculateur (`fetch` dans le navigateur), une personne par requête, 1,1 s entre deux requêtes : 6 recherches de localité et 960 requêtes de prix, toutes en HTTP 200.

- `POST https://cms-blue.assura.ch/api/collections/get/productsConfigurations` avec `{"filter":{"identifier":"Default_Calc"},"simple":true,"populate":7,"lang":"fr"}` : groupes et produits (`insurance_id`, `title`). Donne les noms affichés.
- `GET https://public-api.assura.ch/api/Localities/<code postal>` : liste `[{id, cantonCode, name, regionCode, nameLocation}]`. Le relevé prend l'entrée dont `name` vaut exactement « 1003 Lausanne », « 1204 Genève », etc.
- `POST https://public-api.assura.ch/api/DisplayRules/GetDisplayProductRulesSyrius` : requête de prix, sans jeton ni cookie. Corps émis par l'application et repris tel quel, sauf les champs variables :
  `{"common":{"localityId":<id>,"policyNumber":null,"lang":"fr"},"productIdsFilter":[…23 identifiants…],"partners":[{"id":"…","gender":"f|m","birthDate":"AAAA-06-15","nationality":"CH","affiliationReason":"change","selectedProducts":[]}],"journeyIdentifier":"Default"}`
- Réponse : `partners[0].products[]`, avec pour chaque produit `id`, `basicInsurance`, `selectable`, `discountDetail`, `accident { hasAccidentCoverage, selectable }` et `variants[] { id, defaultSelected, contractStartDate, insuredCapital | annualAmount | previsiaExtraFields, premium { gross, net, accident, netWithAccident } }`.

## Lecture des prix

- `premium.gross` est toujours nul pour les complémentaires. `premium.net` est la prime mensuelle sans accident, `premium.accident` le supplément accident, `premium.netWithAccident` leur somme.
- Avec `selectedProducts` vide, aucun rabais n'est appliqué (`discountDetail` à zéro sur toutes les lignes) : `net` est donc la prime avant rabais. Le calculateur accorde un **rabais de combinaison** dès que plusieurs produits sont choisis (constaté : Complementa Extra + Optima Varia, CHF 2.00 de moins sur chacun ; idem avec Hospita). Il n'est pas dans le CSV.
- Option accident : le calculateur affiche « Inclure le risque accident » avec son supplément une fois le produit coché. Le CSV contient donc **deux lignes** par profil pour ces produits : `accident=true` (prime avec accident, profil standard du brief) et `accident=false` (prime sans accident). Les notes indiquent `price=net+accident(<supplément>)` ou `price=net`.
- Supplément accident nul (Denta Sana, Denta Ortho, Hospita 500 et 1000 des enfants) : une seule ligne `accident=true`, note `accident_surcharge=0.00`.
- Previsia Extra est l'assurance accident elle-même (`hasAccidentCoverage=false`) : `accident` vide. Quand elle est choisie, le calculateur retire l'option accident des autres produits (« incluse dans la couverture du produit Previsia Extra »).

## Profil appliqué

- Début d'assurance : 01.01.2027 (`contractStartDate` de toutes les variantes, valeur par défaut du calculateur).
- Localités : 1003 Lausanne, 1204 Genève, 1700 Fribourg, 1950 Sion, 2000 Neuchâtel, 2800 Delémont (4 316 lignes chacune).
- Naissances : 15.06 de chaque année de 1947 à 2026, femme et homme ; `age` = 2027 − année de naissance, soit 1 à 80. Chaque année a été interrogée, aucune ligne dérivée d'une tranche.
- Nouvelle souscription sans assurance de base Assura ni autre produit sélectionné, nationalité CH, motif « change » (valeurs par défaut du formulaire).
- Pas de franchise à choisir : les produits hospitaliers n'ont qu'une variante dans le calculateur. `option` est vide partout.

## Produits, variantes et limites d'âge constatées

Un produit hors limite est simplement absent de la réponse et de l'écran. Les limites sont identiques pour les deux sexes et les six localités.

| Produit (`product_key`) | Variantes relevées | Âges obtenus (2027 − naissance) | Accident |
| --- | --- | --- | --- |
| Complementa Extra (`assura-complementa-extra`) | une | 1 à 80 | option payante |
| Natura (`assura-natura`) | une | 1 à 60 | option payante |
| Medna (`assura-medna`) | une | 1 à 80 | option payante |
| Mondia (`assura-mondia`) | une | 1 à 80 | option payante |
| Mondia Plus (`assura-mondia-plus`) | une | 1 à 80 | option payante |
| Denta Sana (`assura-denta-sana`) | une | 1 à 80 | inclus, supplément 0 |
| Denta Ortho (`assura-denta-ortho`) | montant 2'000, 6'000 (défaut), 10'000 | 1 à 80 | inclus, supplément 0 |
| Previsia Extra (`assura-previsia-extra`) | Variante 6 de 1 à 18 ans, Variante 2 de 19 à 65 ans | 1 à 65 | sans objet |
| Optima Flex Varia (`assura-optima-flex-varia`) | une | 1 à 75 | option payante |
| Optima Varia (`assura-optima-varia`) | une | 1 à 75 | option payante |
| Optima Plus Varia (`assura-optima-plus-varia`) | une | 1 à 75 | option payante |
| Ultra Varia (`assura-ultra-varia`) | une | 1 à 75 | option payante |
| Hospita (`assura-hospita`) | capital 500 et 1'000 de 1 à 50 ans ; 1'500, 2'000, 2'500, 3'000 (défaut) de 19 à 50 ans | 1 à 50 | option payante (0 pour les enfants) |

- `variant` : libellé de l'écran suivi de la valeur (« Capital à choix 3'000 », « Choix du montant de la couverture 6'000 »). Pour Previsia Extra l'écran ne nomme pas la variante : « Variante 2 » / « Variante 6 » vient du champ `previsiaExtraFields.variante` de la réponse. L'identifiant technique est dans `notes` (`variant_id=…`), ainsi que `default_variant` pour la variante présélectionnée.
- Medna porte la note `not_selectable_alone` : sans autre produit, le calculateur la renvoie avec `selectable=false`. Elle devient sélectionnable une fois Complementa Extra ou Natura choisie (constaté à 40 ans). Le prix affiché est le même.
- Seule Previsia Extra dépend du sexe (dès 19 ans, CHF 6.00 de plus pour les hommes). Seuls les quatre produits hospitaliers Varia dépendent de la localité (exemple Optima Varia, 40 ans, avec accident : Genève 78.00, Lausanne 67.00, Neuchâtel 64.00, Delémont 59.00, Fribourg 54.00, Sion 52.00).

## Produits du calculateur absents du relevé

- Assurance de base (9 modèles LAMal) : hors périmètre.
- Lexa (protection juridique, 4 variantes) : pas une assurance santé, exclue par le script.
- Previsia Extra : le calculateur ne propose qu'une variante par classe d'âge et rien après 65 ans ; les autres variantes du produit n'y sont pas configurables.
- Produits Assura absents du calculateur, donc sans prix ici : Materna Varia, Nativa, Pecunia, Previsia, Previsia Plus, Previsia Maxi, Previsia Maladie.

## Vérifications à l'écran

Faites par le script avant d'écrire le CSV : prix de chaque carte produit comparé au relevé (la carte affiche la prime sans accident de la dernière variante de la liste).

| Profil (Lausanne) | Cartes comparées | Résultat |
| --- | --- | --- |
| Femme, 15.06.1987 | 13 (Complementa Extra 13.20, Natura 16.00, Medna 4.00, Mondia 7.00, Mondia Plus 8.00, Denta Sana 22.50, Denta Ortho 19.00, Previsia Extra 23.60, Optima Flex Varia 38.50, Optima Varia 61.00, Optima Plus Varia 101.00, Ultra Varia 149.00, Hospita 5.00) | identiques |
| Homme, 15.06.1958 | 10 (Complementa Extra 27.10, Medna 4.00, Mondia 7.00, Mondia Plus 8.00, Denta Sana 108.50, Denta Ortho 19.00, Optima Flex Varia 246.60, Optima Varia 311.00, Optima Plus Varia 409.00, Ultra Varia 572.00) ; Natura, Previsia Extra et Hospita absents de l'écran comme du relevé | identiques |
| Fille, 15.06.2019 | 13 (Complementa Extra 5.55, Natura 5.00, Medna 1.80, Mondia 7.00, Mondia Plus 8.00, Denta Sana 16.00, Denta Ortho 26.00, Previsia Extra 9.15, Optima Flex Varia 9.30, Optima Varia 16.00, Optima Plus Varia 26.00, Ultra Varia 53.00, Hospita 2.00) | identiques |

Option accident (femme 1987, Complementa Extra seule cochée) : supplément affiché 2.05 et total 15.25 avec l'option, identiques au relevé.

Non vérifié à l'écran : les cinq autres localités (prix lus dans l'API seulement) et le prix avec accident des autres produits.

## Anomalies

- Denta Sana baisse après 75 ans : 130.50 de 71 à 75 ans, 120.00 de 76 à 80 ans (toutes localités). Valeur telle que renvoyée par le calculateur, à confirmer auprès d'une autre source avant publication.
- L'âge affiché par le calculateur est l'âge au jour du relevé (39 ans pour une naissance en 1987), alors que les tranches tarifaires suivent l'année de naissance : les changements de prix tombent sur les âges 2027 − naissance (19, 26, 31, 36…).
- Dans la réponse sans produit sélectionné, `accident.hasAccidentCoverage` vaut `false` pour tous les produits ; il n'est renseigné qu'une fois un produit coché. Le script lit donc ce champ dans la réponse du profil pilote, après avoir coché Complementa Extra.
- L'application embarque une clé de site reCAPTCHA ; elle n'a pas été sollicitée par ce parcours.
