# Assura — relevé des primes LCA 2027 dans le calculateur officiel

**État au 2026-11-18 : aucun prix relevé, `assura.csv` n'existe pas.** Le calculateur prend ses localités et ses prix sur `public-api.assura.ch`, hôte refusé par le proxy de la session (`net::ERR_TUNNEL_CONNECTION_FAILED`) et absent de la liste autorisée. Le formulaire ne peut pas être validé sans localité, donc aucun prix n'a été affiché ni lu. Rien n'a été contourné ni estimé.

Pour reprendre : ouvrir `public-api.assura.ch` à la session, puis `node premiums/collectors/assura.mjs`.

## Calculateur

- URL : https://calculator.assura.ch/fr (« Assura - Configurateur de produits », application Next.js).
- Formulaire d'entrée : sexe (homme / femme / enfant à naître), prénom, date de naissance, code postal et localité, puis « Sauvegarder ».
- `www.assura.ch` renvoie vers ce même calculateur ; aucun autre calculateur n'a été vu sur les hôtes autorisés.

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `calculator.assura.ch` | page, scripts | atteint |
| `cms-blue.assura.ch` | CMS : catalogue de produits, textes, FAQ (aucun prix) | atteint |
| `www.assura.ch` | site public, fiches produit ouvertes depuis le calculateur | atteint |
| `static.assura.ch` | documents | non sollicité par le calculateur |
| **`public-api.assura.ch`** | **API du calculateur : localités et prix** | **refusé par le proxy** |
| `web.cmp.usercentrics.eu`, `io.fusedeck.net`, `www.googletagmanager.com`, `westeurope-0.in.applicationinsights.azure.com` | consentement, traceurs, télémétrie | refusés, sans importance |

## Points d'API

Observés (requêtes réellement émises par la page) :

- `POST https://cms-blue.assura.ch/api/collections/get/productsConfigurations` avec `{"filter":{"identifier":"Default_Calc"},"simple":true,"populate":7,"lang":"fr"}` : groupes, produits (`insurance_id`, `title`, `variants`), sans prix.
- `POST https://cms-blue.assura.ch/api/collections/get/journeys` avec `{"filter":{"identifier":"Default"},"simple":true}` : parcours « Default ».
- `GET https://public-api.assura.ch/api/Localities/1003` : émise à la saisie du code postal, refusée par le proxy ; la page affiche alors une erreur de chargement des localités.

Lus dans le code de l'application (bundle `_app`), **jamais émis ni observés** :

- `POST https://public-api.assura.ch/api/DisplayRules/GetDisplayProductRulesSyrius` : requête de prix. Corps construit par l'application : `common { localityId, policyNumber: null, lang }`, `productIdsFilter` (identifiants des produits non obsolètes), `partners[] { id, gender, birthDate, nationality, affiliationReason, selectedProducts }`, `journeyIdentifier: "Default"`.
- Champs que l'application lit dans la réponse : `partners[].products[] { id, basicInsurance, selectable, contractStartDate, accident { selectable, selected }, variants[] { id, franchise, insuredCapital, annualAmount, premium { gross, net, netWithAccident } } }`.
- Autres routes du même hôte : `Localities/byid/<id>`, `Offers/Draft`, `Offers/SubmitOffer` (envoi d'offre, à ne jamais appeler).
- `calculator.assura.ch/api/client/display-rules` existe pour le parcours des clients connectés (session requise) : non essayé.

## Méthode prévue et état du script

`collectors/assura.mjs` : ouvre le calculateur, lit le catalogue du CMS, saisit un profil pilote (femme, 15.06.1987, 1003 Lausanne, prénom « Test »), capture la requête de prix que l'application émet, puis la rejoue depuis la page pour chaque année de naissance et chaque sexe, une personne par requête, 1,1 s entre deux requêtes, arrêt sur blocage ou trois erreurs de suite.

- Exécuté : lecture du catalogue et saisie du formulaire jusqu'au champ localité. Le script s'arrête là avec le code 2 et n'écrit rien.
- Non exécuté : capture de la requête de prix, rejeu, lecture de la réponse, contrôle à l'écran. Cette partie est écrite d'après le code de l'application ; `rowsFromResponse` est à relire contre la première réponse réelle (enregistrée dans `--raw-dir`).
- Garde-fou : le script n'écrit le CSV que si au moins 3 prix du profil pilote se retrouvent dans le texte de la page. Selon le code, la carte d'un produit affiche le prix net de sa dernière variante et les autres variantes en écart : le contrôle peut donc échouer à tort et demander un ajustement.
- Choix non vérifiés dans le script : `monthly_chf` = `premium.gross`, ou `premium.netWithAccident` quand l'option accident est proposée (les autres montants vont dans `notes`) ; `option` = franchise, sinon capital assuré.

## Profil

Prévu : début 01.01.2027, 1003 Lausanne puis 1204 Genève, 1950 Sion, 2000 Neuchâtel, 1700 Fribourg, 2800 Delémont, naissances au 15.06 de 1947 à 2026, femme et homme, sans assurance de base, nouvelle souscription. Réellement appliqué : aucun. La date de début proposée par le calculateur n'a pas été vue.

## Produits du calculateur

Catalogue lu dans le CMS (13 produits complémentaires, tous absents du relevé pour la raison ci-dessus) :

| Groupe affiché | Sous-groupe | Produits (`insurance_id`) |
| --- | --- | --- |
| Votre couverture santé | Complément à l'assurance de base | Complementa Extra (`PRD_Complementa_Extra`) |
| | Médecine alternative | Natura (`PRD_Natura`), Medna (`PRD_Medna`) |
| | Assurance voyage | Mondia (`PRD_Mondia`), Mondia Plus (`PRD_Mondia_Plus`) |
| | Soins dentaires | Denta Sana (`PRD_Denta_Reparo`), Denta Ortho (`PRD_Denta_Ortho`) |
| | Assurance accident | Previsia Extra (`PRD_Previsia_Extra`) |
| Votre couverture hospitalisation | Assurance hospitalisation | Optima Flex Varia (`PRD_Optima_Flex_Varia`), Optima Varia (`PRD_Optima_Varia`), Optima Plus Varia (`PRD_Optima_Plus_Varia`), Ultra Varia (`PRD_Ultra_Varia_2022`) |
| | Capital en cas d'hospitalisation | Hospita (`PRD_Hospita`) |

Hors périmètre, exclus par le script : « Assurance de base » (9 modèles LAMal) et « Votre protection juridique » (Lexa, 4 variantes, pas une assurance santé).

Le CMS ne décrit de variantes que pour Lexa. Les variantes des autres produits (franchises hospitalières, capitaux Hospita, montants Denta Ortho) viennent de la réponse de prix et restent inconnues.

## Limites d'âge

Aucune limite constatée. À titre d'indice seulement, le code de l'application contient une table d'âges d'admission, **non confrontée au calculateur** : Complementa Extra, Denta Sana, Denta Ortho, Mondia, Mondia Plus et Medna 0 à 99 ans ; Natura 0 à 60 ; Optima Varia, Optima Plus Varia, Optima Flex Varia, Ultra Varia et Previsia Extra 0 à 75 ; Hospita 500 et 1000 de 0 à 50, Hospita 1500 à 3000 de 19 à 50.

## Vérifications à l'écran

Aucune : aucun prix n'a été affiché.

## Anomalies

- La liste d'hôtes fournie ne contenait pas l'hôte qui porte les prix ; `cms-blue.assura.ch` ne sert que des contenus.
- La configuration de la page cite aussi `iassuraassets01.blob.core.windows.net` (images du CMS) et `assura.enterprisebot.co` (chat) : inutiles pour les prix.
- L'application embarque une clé de site reCAPTCHA ; son usage n'a pas été observé. Le script s'arrête si une réponse évoque un captcha.
- `../insurers/assura.json` n'existe pas : `product_key` restera vide tant que ce fichier manque.
