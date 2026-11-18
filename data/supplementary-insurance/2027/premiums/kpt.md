# KPT / CPT : relevé des primes LCA 2027 dans le calculateur officiel

Relevé du 18.11.2026. Fichier : `kpt.csv` (47 856 lignes). Script : `collectors/kpt.mjs`.

## Calculateur

- Entrée : <https://assistant.kpt.ch/fr/donnees-personnelles> (« Calculateur de primes KPT »).
- Autre entrée : `https://www.kpt.ch/api/premium-calculator?productCode=PUL&productClass=ECO&lang=fr` répond 302 vers `https://assistant.kpt.ch/fr/preselect/PUL?part=52&option=191`.
- Étapes à l'écran : personnes (sexe, prénom facultatif, date de naissance, NPA) → assurance de base → assurance complémentaire → récapitulatif → informations (offre ou souscription, non parcourue).

## Méthode : API rejouée dans le navigateur

1. Playwright ouvre le calculateur (`chromium.launch()`, `locale: 'fr-CH'`), une seule session.
2. Le script rejoue, par `fetch` dans la page (même origine, mêmes cookies), l'appel que fait le formulaire en quittant la première étape. Une personne par requête, 1,3 s de pause, environ 2 s par profil.
3. Chaque réponse est mise en cache (reprise possible), puis le CSV est reconstruit en entier.

Points d'API (base lue dans `https://assistant.kpt.ch/appsettings.json` : `https://assistant.kpt.ch/kpt-api/public`) :

| Appel | Rôle |
| --- | --- |
| `GET /premiumcities?postalCode=1003&validAt=2027-01-01` | NPA → commune : `bfsNumber`, `cantonCode`, `postalCodeExtended` |
| `POST /productprice/query` | Tous les prix d'une personne. Corps : tableau d'objets `{callerDefiniedApplicantId, entryReason: "New", firstName, birthDate, genderCode, bfsNumber, cantonCode, postalCodeExtended, basicInsuranceStartDate, supplementaryInsuranceStartDate}` ; en-têtes `Content-Type: application/json`, `Accept-Language: fr-CH` |
| `POST /productprice/cross-sellings/query` | Suggestions du récapitulatif (non utilisé pour les prix) |

La réponse de `productprice/query` contient `basicProducts` (LAMal, ignorés) et `additionalProducts`. Chaque produit porte ses parts (`productParts` : classe, franchise, cases à cocher), un dictionnaire `prices` et un dictionnaire `appliedDiscounts`. Une clé de prix se lit `CODE-<id d'option>[_<id d'option>][_p<id de case cochée>]`, par exemple `H-11_14` = Complémentaire Hôpital, franchise 0.-, division demi-privée ; `H-11_14_p8` = la même avec le contrat de 3 ans. Tous les prix d'une personne arrivent dans une seule réponse : aucun prix n'est interpolé ni déduit d'une tranche.

## Profil réellement appliqué

- Début d'assurance : 01.01.2027 (valeur que le calculateur présélectionne pour la base et pour les complémentaires).
- Localités : 1003 Lausanne, 1204 Genève, 1950 Sion, 2000 Neuchâtel, 1700 Fribourg, 2800 Delémont.
- Naissance le 15.06 de chaque année de 1947 à 2026, femme et homme : 960 profils interrogés. `age` = 2027 − année de naissance, soit 1 à 80 (une personne née en 2026 a `age` 1, pas 0).
- Nouvelle souscription (`entryReason: "New"`), prénom « Test », aucune assurance de base choisie. Les prix des complémentaires ne dépendent pas de la base : contrôle au récapitulatif ci-dessous.
- Sans rabais « contrat de 3 ans » (case décochée). Le prix avec ce rabais de 6,7 % figure dans `notes` (`three_year_contract_price=`) pour Pulse, Complémentaire Hôpital et Hôpital flexible.
- Franchise hospitalière : sans franchise (`option` vide), et aussi 1'000.-, 2'000.-, 5'000.- pour les divisions demi-privée et privées.
- Accident : seul le produit « Assurance en cas de décès et d'invalidité » a une case « Avec assurance-accidents » ; les deux états sont relevés (`accident` = `true` / `false`). Colonne vide pour les autres produits.

### Prix net : rabais en ligne inclus

Le calculateur n'affiche qu'un prix net. Le récapitulatif le dit : « les éventuels rabais (rabais collectif, online, de fidélité) sur les assurances complémentaires sont déjà calculés dans les primes offertes ». L'API renvoie le montant déduit sous le type `OnlineDiscount` (environ 5 %, arrondi à 10 centimes). `monthly_chf` est le prix affiché ; `notes` porte `online_discount_included=<CHF par mois>`, donc prime avant rabais en ligne = `monthly_chf` + ce montant. Pulse et Hôpital flexible n'ont pas ce rabais. Aucun rabais famille n'entre en jeu (une seule personne par requête).

## Produits et limites d'âge constatées

Colonne « âges » : valeurs de `age` présentes dans le CSV, identiques dans les six localités.

| Produit affiché (`product_name`) | Code | `product_key` | Variantes | Âges | Varie selon |
| --- | --- | --- | --- | --- | --- |
| Pulse – assurance complémentaire ambulatoire | PUL | kpt-pulse | Eco, Top, Premium | 1-65 | âge |
| Complémentaire Hôpital | H, HS | kpt-hospitalisation | 4 divisions × 4 franchises (commune : sans franchise) | 1-65 | âge, sexe, localité |
| Assurance complémentaire d'hospitalisation flexible | FLEX | kpt-hospitalisation-flex | Eco, Top | 1-65 | âge, localité |
| Assurance de garantie d'admission SICURANTA | GH | kpt-sicuranta | 3 divisions × durée 5, 10, 15, 20 ans | 5 et 10 ans : 1-60 ; 15 ans : 1-55 ; 20 ans : 1-50 | âge, sexe, localité |
| Assurance d'indemnité journalière d'hospitalisation | HT | kpt-indemnites-journalieres-hospitalisation | 30 ou 60 jours × CHF 100 à 300 | 1-65 | âge, localité |
| Assurance des soins dentaires | Z | kpt-soins-dentaires | Classes de prestations 1, 3, 4 | 1-65 | âge |
| Assurance en cas de décès et d'invalidité | KTI | kpt-capital-maladie-accident | 5 sommes (2 jusqu'à 18 ans) × accident oui/non | 1-55 | âge, sexe |
| Assurance-accidents en cas de décès et d'invalidité | K | kpt-capital-accident | 12 sommes dès 19 ans, 6 jusqu'à 18 ans | 1-65 | âge |
| Prestations de soins Complémentaire Accidents | U | kpt-accidents-prestations-soins | produit seul | 1-65 | âge |
| Protection juridique | VPR | kpt-protection-juridique-circulation-privee | produit seul | 1-65 | âge |
| Teddy - Assurance complémentaire pour enfants | TD | kpt-teddy | 3 classes | 1-18 | aucun facteur |

- **Aucune complémentaire pour les naissances de 1947 à 1961** (`age` 66 à 80) : `additionalProducts` est vide et l'écran ne propose pas l'étape « Assurance complémentaire » (seul bouton : « Afficher le récapitulatif »). Ces 180 profils n'ont donc aucune ligne.
- Les tranches tarifaires suivent l'année de naissance (1-18, 19-25, 26-30, puis par 5 ans, selon le produit). Les limites d'admission, elles, suivent l'âge exact au début d'assurance. Sondages ponctuels hors CSV (Lausanne, femme) :
  - née le 01.01.1962 : aucune complémentaire ; née le 02.01.1962 : offre complète. La limite générale est donc « moins de 65 ans révolus au 01.01.2027 ».
  - SICURANTA : absente pour une naissance au 01.01.1967, présente (5 et 10 ans) au 02.01.1967 ; durée 15 ans encore offerte au 01.01.1972 ; durée 20 ans encore offerte au 01.01.1977.
  - Décès et invalidité (KTI) : absente au 01.01.1972, présente au 02.01.1972.
  - Les lignes d'une année de naissance valent donc pour une naissance au 15.06 ; près d'une limite d'admission, une naissance plus tôt dans l'année peut être refusée.
- Complémentaire Hôpital : le code passe de `H` à `HS` (même nom à l'écran, mêmes variantes) dès 51 ans révolus au début d'assurance, soit `age` 52 à 65 ici. Ces lignes portent `calculator_code=HS` ; le prix reste dans la continuité de la tranche (51-55 identique sous `H` et `HS`).
- Protection juridique : gratuite jusqu'à 18 ans (`monthly_chf` 0.00, `child_free`). Le calculateur exige une complémentaire ambulatoire en parallèle (`requires_one_of=…`, Pulse dans l'offre actuelle).
- Soins dentaires classe 4 : 0.00 pour l'année de naissance 2026 (rabais `Child` de 9.90 renvoyé par l'API), 9.40 dès `age` 2.

## Produits du calculateur absents du relevé

- Assurance de base (LAMal) : hors périmètre.
- Sexe « Prénatal » : hors profil.
- Prix avec contrat de 3 ans : pas de ligne propre, valeur dans `notes`.
- Clés de prix renvoyées par l'API mais sans option à l'écran, donc sans libellé : `Z-82`, `Z-86`, `Z-87` (soins dentaires ; un message de l'API cite la « classe 6 » pour `Z-87`, liée aux produits Area) et, pour les âges où la durée n'est plus proposée, les durées SICURANTA de 15 et 20 ans. Non écrites.
- Les messages d'exclusion de l'API citent d'autres codes (AP, APC, APA, APCA, C360, PRI, F) que le calculateur ne propose pour aucun profil relevé.
- Produits de `../insurers/kpt.json` que le calculateur ne propose pour aucun profil relevé : assurance voyages et vacances, perte de gain, patient privé.

## Vérifications à l'écran

`node collectors/kpt.mjs --verify=…` remplit le formulaire comme un visiteur, décoche le contrat de 3 ans, parcourt toutes les combinaisons de listes déroulantes de chaque produit et compare le prix affiché à la ligne du CSV.

| Profil | Prix affichés | Identiques au CSV |
| --- | --- | --- |
| 1003 Lausanne, 1990, f | 67 | 67 |
| 1003 Lausanne, 1962, m | 45 | 45 |
| 1003 Lausanne, 2015, f | 58 | 58 |
| 1204 Genève, 1975, m | 64 | 64 |
| 1950 Sion, 2001, f | 67 | 67 |
| 2000 Neuchâtel, 1968, f | 51 | 51 |
| 1700 Fribourg, 1984, m | 67 | 67 |
| 2800 Delémont, 2026, f | 58 | 58 |
| 2800 Delémont, 1961, m | étape complémentaire non proposée | 0 ligne dans le CSV |

477 prix comparés, aucun écart, aucune ligne du CSV de ces profils absente de l'écran. Date de début affichée à chaque fois : 01.01.2027.

Récapitulatif sans assurance de base (Lausanne, 1990, f) : Pulse Eco 12.50 + Complémentaire Hôpital demi-privée sans franchise 183.60, total 196.10, identiques au CSV.

## Anomalies

- Deux réponses HTTP 503 (page HTML) sur `productprice/query` pour Fribourg 1955 f et m ; nouvel essai après 10 s réussi. Une erreur passagère du même appel pendant la reconnaissance (écran « Could not load products »). Aucun captcha ni blocage.
- Pour le code `HS`, l'écran laisse choisir une franchise avec la division commune mais n'affiche alors aucun prix ; ces trois combinaisons n'ont pas de ligne.
- Les lignes gratuites gardent le `online_discount_included` que renvoie l'API (0.10 ou 0.50) bien que le prix soit 0.00.
- Le récapitulatif répète le libellé « Avec 6,7% de rabais pour un contrat de 3 ans » même case décochée ; le prix affiché est bien celui sans contrat.
- Hôte bloqué par le proxy : `www.googletagmanager.com` (traceur), sans effet sur le calculateur.
