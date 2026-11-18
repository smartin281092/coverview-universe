# Sanitas — relevé des primes LCA 2027 dans le calculateur officiel

**État au 2026-11-18 : (relevé des autres localités en cours) lignes dans `sanitas.csv`**, 20 produits ou variantes du calculateur, femmes et hommes, années de naissance 1948 à 2026 (1 à 79 ans en 2027), 6 localités. Lausanne : toutes les options (franchises hospitalières, avec et sans accident, options Vital Smart). Genève, Sion, Neuchâtel, Fribourg, Delémont : variantes par défaut, accident inclus. Aucun prix estimé ni interpolé : chaque ligne est un prix renvoyé par le calculateur pour ce profil exact.

## Calculateur

- URL : https://calculator.sanitas.com/fr, redirigée vers `/fr/persons/` ; application Vue « dvp », version `v26.9.1-SAL-1868928` (pied de page).
- Étapes : Personnes → Offre (onglets Assurance de base, Assurance d'hospitalisation, Assurances complémentaires) → Panier → Proposition → Conclusion. Le relevé s'arrête au plus tard à la page Panier, ouverte une seule fois pour une vérification.
- Titre de la page : « Primes de caisse maladie 2026 | Sanitas Assurance Maladie ». Le titre n'a pas été mis à jour, mais les prix relevés sont bien ceux d'un début au 01.01.2027 :
  1. `GET /contractStartDate/default` renvoie `kvgContractStartDate` et `vvgContractStartDate` = `2027-01-01` ; le script s'arrête si ce n'est plus le cas.
  2. Chaque panier est créé avec `contractStartDate` et `vvgContractStartDate` = `2027-01-01`, et la réponse les confirme ; la page Panier affiche « Début du contrat de l'assurance complémentaire 01.01.2027 ».
  3. Contre-épreuve : les mêmes personnes avec un début au 01.12.2026 obtiennent d'autres prix. Femme née en 1987, Lausanne, accident inclus : Hospital Extra Liberty 118.55 (01.12.2026) contre 133.95 (01.01.2027), Hospital Top Liberty 129.05 contre 145.50, Vital Premium 77.60 contre 86.45, Hospital Day Comfort 8.80 contre 6.60 (le « rabais variable » n'existe que dans le tarif 2027). Le tarif 2027 est donc distinct et c'est lui qui est relevé.

## Méthode

API rejouée, pas d'automatisation de l'interface. Le parcours a d'abord été fait une fois dans l'interface en observant le réseau, puis le script `collectors/sanitas.mjs` ouvre la page une fois avec Playwright et rejoue les appels avec `fetch` dans le contexte de la page (aucun jeton, aucun cookie d'authentification).

Points d'API (hôte `api3.sanitas.com`, suffixe `?v=<version de l'application>`) :

| Appel | Rôle |
| --- | --- |
| `GET /masterdata/locations?country=CH&q=<NPA>&referenceDate=2027-01-01` | objet adresse (canton, `primeRegion`, `locationNumber`) à renvoyer dans le panier |
| `GET /ovpv3/public/contractStartDate/default` | dates de début proposées |
| `GET /ovpv3/public/products?contractStartDates[]=2027-01-01&masterTreaty=SA-EV` | catalogue : groupes, exclusivités, combinaisons interdites ou requises, produits masqués |
| `POST /ovpv3/public/baskets` | crée un panier (langue, date de début, personnes, adresse, partenaire `219369` « Sanitas Internet ») ; renvoie par personne tous les produits avec leurs options et un prix « tuile » |
| `PUT /ovpv3/public/basketSimulate/updateProducts?personId=…&selectedCalculations=true` | recalcule le panier envoyé dans le corps, avec les produits marqués `selected` ; c'est l'appel que fait la fenêtre « Détails » ; rien n'est enregistré |
| `PUT /ovpv3/public/baskets/<id>` | enregistre le panier (bouton « Ajouter ») ; utilisé une seule fois, à la main, pour la vérification de la page Panier ; jamais par le script |

Structure d'un produit dans la réponse : `prices[]` (une entrée par combinaison `duration` 1 ou 3 ans, `value` = franchise hospitalière ou somme assurée, `amValue`/`gfValue` = options Vital Smart, `toggle` = accident inclus), dont seule l'entrée `selected` porte un `price` ; `reductions[]`, `messages[]`, `valid`.

Règles appliquées par le script, toutes issues d'essais décrits sous « Anomalies » :

- **Seul le prix d'un produit sélectionné est relevé** (réponse de `basketSimulate`), jamais le prix « tuile » du `POST`.
- **Lausanne : un produit par appel** (36 appels par panier), avec son prérequis quand il y en a un : Hospital Upgrade avec son produit parent, Medical Private et les capitaux maladie avec Vital Basic.
- **Autres localités : 6 appels groupés par panier**, plusieurs produits compatibles sélectionnés ensemble (R1 : Hospital Standard Liberty, Upgrade demi-privée, Vital Basic, Dental Basic, Day Comfort, Accident Top Liberty, Medical Private, les 4 capitaux ; R2 : Hospital Extra Liberty, Upgrade privée, Vital Smart, Désir d'enfant ; R3 : Hospital Top Liberty, Vital Premium ; R4 : Dental, Accident Extra Liberty ; R5 et R6 : Easy 1 an et 3 ans). Ces mêmes tours ont été refaits à Lausanne et comparés aux prix isolés : **2713 prix comparés sur les 158 profils, aucun écart**. Les lignes concernées portent `priced_in_combined_selection=R…` dans `notes`.
- **Paniers de 8 personnes, au plus 2 mineurs par panier.** Toute réduction autre que le « rabais variable sur les primes » fait recalculer la personne seule ; il n'y en a eu aucune ((relevé des autres localités en cours)).
- Courtoisie : une session, appels séquentiels, au moins 1,1 s entre deux départs et 0,5 s après chaque réponse ; arrêt sur 403, 429, captcha ou deux échecs de suite. Aucun blocage ni captcha rencontré. Volume : environ (relevé des autres localités en cours) appels de prix et (relevé des autres localités en cours) paniers créés (relevé et essais), sur environ (relevé des autres localités en cours).

## Profil réellement appliqué

- Début d'assurance 01.01.2027 (date par défaut du calculateur).
- Domicile : 1003 Lausanne (VD), 1204 Genève (GE), 1950 Sion (VS), 2000 Neuchâtel (NE), 1700 Fribourg (FR), 2800 Delémont (JU).
- Naissance le 15.06 de chaque année de 1947 à 2026, femme et homme ; prénom « Test » ; « Nouveau en Suisse » désactivé.
- `age` = 2027 − année de naissance (1 à 80). C'est aussi l'âge tarifaire de Sanitas : les prix changent par année de naissance, pas à la date d'anniversaire.
- Accident : inclus partout où l'option existe (Hospital Standard, Extra et Top Liberty, Dental, Medical Private) ; à Lausanne, la variante sans accident est aussi relevée (`accident=false`). Dès 66 ans, le calculateur propose par défaut les produits hospitaliers sans accident : les lignes `accident=true` de ces âges portent `calculator_default_accident=false`. Colonne `accident` vide : le produit n'a pas cette option.
- Franchise hospitalière : CHF 0 (`option` vide) ; à Lausanne aussi CHF 1500, 3000 et 5000 pour Hospital Extra et Top Liberty, accident inclus.
- Nouvelle souscription sans assurance de base Sanitas : aucun produit LAMal sélectionné, `existingCustomer=false`. Aucun rabais de combinaison avec la base n'a été vu (essai avec TelMed Basic au panier : mêmes prix LCA).
- Durée contractuelle 1 an. La durée 3 ans donne le même prix pour tous les produits essayés, sauf Easy (voir plus bas).
- Paiement mensuel (valeur par défaut du panier). Aucun rabais famille ni pluriannuel dans les prix.
- **Prix net pour trois produits** : le calculateur n'affiche que le prix après « Rabais variable sur les primes » (pastille « Rabais » sur la tuile) pour Hospital Top Liberty (15 % de la prime brute), Hospital Day Comfort (25 %) et Medical Private (10 %). `monthly_chf` est ce prix affiché ; `notes` donne `variable_premium_discount_included=<montant>` et `gross_before_discount=<prime brute>`. Tous les autres produits sont sans réduction.

## Produits relevés

`product_name` et `variant` sont les deux libellés de la tuile (petit titre, grand titre). `product_key` renvoie à `../insurers/sanitas.json`.

| Produit (code interne) | `product_key` | Options relevées | Âges avec prix |
| --- | --- | --- | --- |
| Hospital Standard Liberty, Division générale (`H3SL04`) | `sanitas-hospital-standard-liberty` | accident oui ; Lausanne : aussi non | 1-65 |
| Hospital Extra Liberty, Division demi-privée (`SSHB01`) | `sanitas-hospital-extra-liberty` | accident oui, franchise 0 ; Lausanne : franchises 1500, 3000, 5000 et sans accident | 1-79 |
| Hospital Top Liberty, Division privée (`SSPB01`) | `sanitas-hospital-top-liberty` | idem | 1-79 |
| Hospital Upgrade, Option de surclassement demi-privée (`SSOB01`) | `sanitas-hospital-upgrade` | avec Hospital Standard Liberty | 1-60 |
| Hospital Upgrade, Option de surclassement privée (`SSOB02`) | `sanitas-hospital-upgrade` | avec Hospital Extra Liberty | 1-60 |
| Hospital Day Comfort, Ambulatoire (`SAMB05`) | `sanitas-hospital-day-comfort` | aucune | 1-79 |
| Division demi-privée en cas d'accident, Accident Extra Liberty (`SSHU01`) | `sanitas-accident-extra-liberty` | aucune | 1-65 |
| Division privée en cas d'accident, Accident Top Liberty (`SSPU01`) | `sanitas-accident-top-liberty` | aucune | 1-65 |
| Vital Basic (`SAMB06S`) | `sanitas-vital` | aucune | 1-79 |
| Vital Smart (`SAMB06M`) | `sanitas-vital` | option par défaut du calculateur ; Lausanne : les 4 combinaisons médecine alternative 2500 ou 5000 × promotion de la santé 400 ou 600 | 1-79 |
| Vital Premium (`SAMB06L`) | `sanitas-vital` | aucune | 1-79 |
| Dental Basic (`SDZA02`) | `sanitas-dental-basic` | aucune | 1-65 |
| Dental (`Z04`) | `sanitas-dental` | accident oui ; Lausanne : aussi non | 1-59 |
| Medical Private (`PE04`) | `sanitas-medical-private` | accident oui ; Lausanne : aussi non | 1-65 |
| Désir d'enfant, Fonder une famille (`SAMK02`) | `sanitas-desir-d-enfant` | aucune | femmes 19-35 |
| Easy, L'assurance maladie pour l'étranger (`SBVB01`) | `sanitas-easy` | durée 1 an et durée 3 ans | 1-65 |
| Capital : invalidité à la suite d'une maladie (`PKIS`) | `sanitas-capital-maladie` | somme assurée par défaut | 1-55 |
| Capital : décès à la suite d'une maladie (`PKTS`) | `sanitas-capital-maladie` | somme assurée par défaut | 1-55 |
| Capital : invalidité à la suite d'un accident (`PUIS`) | `sanitas-capital-accident` | somme assurée par défaut | 1-65 |
| Capital : décès à la suite d'un accident (`PUTS`) | `sanitas-capital-accident` | somme assurée par défaut | 1-65 |

Précisions sur la colonne `option` :

- **Vital Smart** : la ligne à `option` vide est l'option que le calculateur présélectionne, et elle dépend de l'âge : médecine alternative CHF 5000 et promotion de la santé CHF 600 jusqu'à 18 ans, CHF 2500 et CHF 400 dès 19 ans (`default_option: …` dans `notes`). À Lausanne, les trois autres combinaisons ont une ligne à `option` explicite. Les montants sont ceux de l'API (`amValue`, `gfValue`).
- **Easy** : seul produit dont le prix dépend de la durée ; le calculateur présélectionne 3 ans. Les deux durées sont relevées avec une `option` explicite, aucune ligne à `option` vide. La prime avant rabais pluriannuel est la ligne « durée contractuelle 1 an ».
- **Capitaux** : la somme assurée présélectionnée dépend de l'âge (CHF 10 000 de 1 à 3 ans, 20 000 de 4 à 14 ans, 100 000 dès 15 ans ; décès maladie : 20 000 dès 4 ans). Elle figure toujours dans `option` ; les autres sommes (10 000 à 500 000) ne sont pas relevées.

Régions tarifaires : par rapport à Lausanne, les prix changent ailleurs pour Hospital Extra Liberty, Hospital Top Liberty, les deux Hospital Upgrade et Medical Private. Les 15 autres lignes de produits ont le même prix dans les six localités pour tous les profils (constat sur les prix relevés, voir « Écarts régionaux »).

## Limites d'âge constatées

Messages de l'API pour un début au 01.01.2027 (âge = 2027 − année de naissance) :

| Produit | Dernier âge avec prix | Message au-delà |
| --- | --- | --- |
| Tous | 79 | `AGE_ABOVE_79` : à 80 ans (né en 1947), plus aucun produit LCA n'a de prix |
| Hospital Standard Liberty, Accident Extra et Top Liberty, Dental Basic, Medical Private, Easy, capitaux accident | 65 | `AGE_ABOVE_65` |
| Hospital Upgrade (les deux) | 60 | `AGE_ABOVE_60` |
| Dental | 59 | `AGE_ABOVE_59` |
| Capitaux maladie | 55 | `AGE_ABOVE_55` |
| Désir d'enfant | femmes de 19 à 35 ans | produit absent de la réponse en dehors |

Tranches tarifaires vues à Lausanne : le plus souvent 5 ans (1-15 ou 1-18, 16-20 ou 19-25, puis 26-30, 31-35, … 76-79), identiques ou non selon le sexe d'un produit à l'autre. Chaque année a quand même été relevée.

## Produits du calculateur absents du relevé

- **Assurance de base (LAMal)** : hors périmètre.
- **`WF`, `WB`, `G04`, `C04`** : présents dans la réponse avec `PRODUCT_IS_NOT_AVAILABLE` pour tous les profils, sans libellé dans l'interface ; anciens produits non souscriptibles.
- **Sommes assurées des capitaux** autres que celle par défaut, et **durée 3 ans** des produits autres qu'Easy (même prix qu'à 1 an) : non relevées.
- **Franchises hospitalières, variantes sans accident et options Vital Smart hors Lausanne** : non relevées (coût : chaque calcul hospitalier prend plusieurs secondes côté serveur).
- **Salary (indemnités journalières)** et **Protection juridique des patients** : pas dans le calculateur.

Produits relevés mais à lire avec leurs réserves :

- **Easy** : masqué dans l'interface (`hidden: true`) et l'API répond `EASY_CONDITIONS_UNFULFILLED` quel que soit le panier essayé (seul, avec Dental Basic, avec une assurance de base). Le prix est renvoyé par l'API mais n'a pas pu être vu à l'écran ; `notes` porte `hidden_in_calculator_ui; api_messages=EASY_CONDITIONS_UNFULFILLED`.
- **Accident Extra et Top Liberty, capitaux** : groupes masqués dans l'interface publique (`hidden_in_calculator_ui`), mais sélection valide côté API.
- **Medical Private** : exige une autre complémentaire hospitalière ou ambulatoire Sanitas ; prix relevé avec Vital Basic au panier (identique au prix seul, que l'API renvoie avec un message d'erreur). **Capitaux maladie** : exigent un autre produit ; même traitement.
- **Hospital Upgrade** : n'existe qu'avec son produit parent. Son prix dépend du contexte (17.50 avec le parent, 7.95 seul et invalide pour une femme née en 1987) ; seul le prix avec parent est relevé. `basketSimulate` laisse le message `REQUIRED_PARENT_PRODUCT_COMBINATION` même avec le parent ; la page Panier, elle, propose bien « Hospital Upgrade … CHF 17.50 ».

## Vérifications à l'écran

- **Page Panier** (interface, personne seule) : femme née le 15.06.1987, 1003 Lausanne, Hospital Extra Liberty ajoutée : « Accident inclus, Franchise hospitalière CHF 0.00, 133.95 CHF, Total par mois 133.95 CHF, Début du contrat de l'assurance complémentaire 01.01.2027 », Hospital Upgrade proposé à CHF 17.50. CSV : 133.95 et 17.50.
- **Fenêtres « Détails »** (interface, une personne par session, prix lu après l'animation du compteur), 27 prix comparés au CSV, 27 identiques :
  - femme 15.06.1987 : Hospital Standard Liberty 9.95, Extra 133.95, Top 145.50, Day Comfort 6.60, Vital Basic 16.05, Smart 57.60, Premium 86.45, Dental Basic 35.00, Dental 54.65, Medical Private 9.35 ;
  - homme 15.06.2015 : 5.85, 28.45, 31.00, 3.95, 16.05, 26.40, 54.90, 9.80, 39.05, 3.85 ;
  - femme 15.06.1955 (accident désactivé par défaut à cet âge) : Extra 466.90, Top 578.60, Day Comfort 21.90, Vital Basic 29.85, Smart 61.15, Premium 87.55, égaux aux lignes `accident=false` ; Hospital Standard Liberty sans prix, conforme à la limite de 65 ans.
  - (relevé des autres localités en cours)
- Ces vérifications sont faites en personne seule ; elles confirment aussi que les paniers à plusieurs personnes du relevé donnent les mêmes prix (essai direct : 10 personnes ensemble puis une par une, prix identiques).

## Écarts régionaux

(relevé des autres localités en cours)

## Anomalies

- **Prix des tuiles différent du prix de l'offre.** Sur la page Offre, la tuile d'un produit non sélectionné affiche parfois un autre prix que la fenêtre « Détails » et le panier, à options identiques. Femme née en 1987, Hospital Extra Liberty : tuile 120.85, détail et panier 133.95 (accident inclus dans les deux cas ; sans accident 121.75). À Lausanne, l'écart touche Hospital Extra Liberty ((relevé des autres localités en cours) profils sur 158, tuile environ 10 % plus basse), Hospital Top Liberty ((relevé des autres localités en cours)) et Medical Private ((relevé des autres localités en cours), tuile plus basse ou plus haute : homme de 41 à 45 ans, 17.10 contre 11.30). Les autres produits ont une tuile égale au prix sélectionné. Le relevé ne contient que des prix sélectionnés ; un lecteur qui compare avec la première page du calculateur verra ces différences.
- **Rabais enfants lié au panier** : avec trois mineurs dans le même panier, Hospital Standard Liberty (et son Upgrade) du plus jeune passe à 0.00 (`Kind3`). Évité par construction, jamais présent dans le CSV.
- **Rabais combiné Dental** : pour un enfant, Dental passe de 39.05 à 25.20 (`Z04ProduktDiscount` −13.87) dès qu'un Vital est aussi sélectionné. Le relevé donne le prix sans combinaison, 39.05.
- **Âge 80** : aucun prix LCA pour une personne née en 1947 ; aucune ligne.
- **Titre « 2026 »** : voir « Calculateur ».
- **Début au 01.12.2026** (contre-épreuve) : l'API accepte cette date et ne propose alors qu'un modèle LAMal ; sans incidence sur le relevé.

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `calculator.sanitas.com` | page du calculateur | utilisé |
| `static.sanitas.tech` | scripts et libellés de l'application (`dvp`, `chat-ui`) | utilisé |
| `api3.sanitas.com` | API des prix, localités, configuration | utilisé |
| `www.sanitas.com` | chargeur de l'assistant de conversation | chargé par la page, non sollicité autrement |
| `cdn.cookielaw.org` | bannière de cookies OneTrust | refusé par le proxy (`ERR_TUNNEL_CONNECTION_FAILED`), sans importance |
| `assets.adobedtm.com` | traceur Adobe Launch | refusé par le proxy, sans importance |

## Relancer

```bash
NODE_PATH=$(npm root -g) node premiums/collectors/sanitas.mjs
```

Environ 50 minutes pour Lausanne (toutes options) et 15 à 20 minutes par autre localité. Le script garde un fichier JSON par panier dans `--raw` (défaut : dossier temporaire du système) et reprend là où il s'est arrêté ; supprimer ce dossier pour un relevé neuf. `--csv-only` reconstruit le CSV depuis ces fichiers sans appel réseau.
