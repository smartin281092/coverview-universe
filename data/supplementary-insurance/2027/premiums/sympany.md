# Sympany — relevé des primes LCA 2027

**État au 2026-11-18 : aucun prix 2027 relevé, aucun prix pour Lausanne.** Le calculateur public existe (`calculator.sympany.ch`, API `api-public.sympany.ch`), mais ces deux hôtes sont refusés par le proxy de la session (403 au `CONNECT`) et ne figurent pas dans la liste autorisée. Rien n'a été contourné.

`sympany.csv` contient à la place la transcription du **seul barème de primes LCA publié** trouvé sur `www.sympany.ch` : 328 lignes, **état 2024, région de primes « Allemagne, France » (frontaliers)**, produits « premium » et « supplément privé ». Ce ne sont ni des primes 2027, ni des primes pour un domicile suisse : à exclure de tout comparatif Lausanne 2027 (filtrer sur `year` = 2027 ou sur `postal_code`).

Pour reprendre le relevé du calculateur : ouvrir `calculator.sympany.ch` et `api-public.sympany.ch` à la session.

## Calculateur

- URL : `https://calculator.sympany.ch/#/fr` (allemand : `https://calculator.sympany.ch/#/de`, étape de configuration `#/de/produkte-konfiguration`). Application à routage par fragment, jamais chargée ici.
- Où le site y renvoie, et seulement là :
  - `https://www.sympany.ch/fr/particuliers/assurance-de-base/euroline.html`, carte « Offre » (« établir mon offre personnelle sans engagement dans le calculateur de primes »), lien `https://calculator.sympany.ch/#/fr#&country=de#` ;
  - `https://www.sympany.ch/fr/landingpages/recommandation-euroline.html`, formulaire « Calculer la prime maintenant! » (sexe, date de naissance, pays, NPA/localité, bouton « Calculez votre prime »), `action="https://calculator.sympany.ch/#/fr"`, champs `gender`, `dob`, `country`, `areaId`. Le seul pays proposé est l'Allemagne ;
  - `https://www.sympany.ch/de/privatkunden/grundversicherung/euroline.html`, composant `<product-offer productid="BA" variationid="EBA" country="de" calculatorpageurl="https://calculator.sympany.ch/#/de/produkte-konfiguration" soaserviceuri="https://api-public.sympany.ch">`.
- Les pages des complémentaires (`/fr/particuliers/assurances-complementaires/…` : plus, premium, hospita générale, demi-privée, privée, globale, flex, accident privé, dentaire, protection juridique) et la page d'accueil n'ont **aucun** bouton de calcul : elles ne mènent qu'à « Demander un conseil ou une offre » (`/fr/contact/conseil-a-la-vente.html`, formulaire de contact).
- Non vérifié, faute d'accès : que le calculateur accepte un domicile suisse et qu'il propose les complémentaires LCA. Indice favorable, lu dans le code du site : le composant d'offre prévoit le pays `ch` (début d'assurance au 1er janvier de l'année suivante pour `ch`, au 1er du mois suivant sinon).

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `www.sympany.ch` | site public, documents `dam/jcr:…`, scripts des composants | atteint |
| `hello.sympany.ch` | formulaires de contact et de concours (`/public/e/l/<nom>`), intégrés en iframe ; 404 à la racine | atteint, aucun calculateur |
| `sales.sympany.ch` | « Login intermédiaire » (application KLICK.app pour courtiers) | page de connexion atteinte, pas public, aucune tentative de connexion |
| `cdn.sympany.ch` | feuilles de style, recherche de thérapeutes | référencé, sans rapport avec les primes |
| **`calculator.sympany.ch`** | **calculateur de primes public** | **refusé par le proxy (403)** |
| **`api-public.sympany.ch`** | **API du calculateur et des composants d'offre (localités, produits, prix)** | **refusé par le proxy (403)** |
| `rum.sympany.ch`, `chatbot.sympany.ch`, `my.sympany.ch`, `tourist.sympany.ch` | télémétrie, chatbot, portail client, assurance voyage | non sollicités |

Chaque hôte refusé a été sollicité une seule fois (`HEAD /`), sans nouvelle tentative.

## Points d'API

Lus dans les scripts de `www.sympany.ch` (`/.resources/sympany/webresources/…body.js`, `…head.js`, `webcomponents/…product-offer.js`). **Aucun n'a été émis ni observé.** Base : `https://api-public.sympany.ch`.

- `GET /maintenance/features` : état des fonctions (`PRODUCT-INFORMATION`, `PRODUCT-OFFER`…) ; le site masque le formulaire de calcul si elles sont hors ligne.
- `GET /products/areas?searchZip=<npa>&country=<ch|de>` : localités (`id`, `zip`, `subZip`, `name`, `countryId`).
- `GET /products/areas/<areaId>`.
- `GET /products/<productId>?language=fr` et `GET /products/<productId>/variations/<variationId>?language=fr`.
- `GET /products/<productId>/variations/<variationId>/offer?sex=<f|m>&dateOfBirth=<AAAA-MM-JJ>&country=<ch|de>&zip=<npa>&subZip=<n>&language=fr&isPolicyOwner=true&insuranceStartDate=<AAAA-MM-JJ>` : offre chiffrée d'une variante. C'est l'appel à rejouer en priorité quand l'hôte sera ouvert.
- `GET /products/BA/variations/<variationId>/comparison?language=fr` : tableau comparatif de l'assurance de base.
- Seuls identifiants vus : produit `BA` (assurance de base), variante `EBA` (euroline). Les identifiants des complémentaires sont inconnus.

`robots.txt` de `www.sympany.ch` interdit `/.premiumCalculator/` : chemin non sollicité.

## Recherche menée sur les hôtes autorisés

- Pages lues sur `www.sympany.ch` : 390 (page d'accueil FR, plan du site FR hors communiqués, actualités, conseils santé et clientèle entreprises, plus 112 pages DE : complémentaires, assurance de base, téléchargements, pages d'atterrissage, information sur les primes). Une requête par seconde, aucune erreur.
- Recherché dans chaque page : `calculator.sympany.ch`, `api-public.sympany.ch`, formulaire `health-insurance-calculator`, `premiumCalculator`, liens `hello.sympany.ch/…`, documents `dam/jcr:…` (269 PDF distincts).
- Aucun barème de primes parmi les 269 PDF liés : conditions (CGA, CP), brochures, aperçus des prestations 2026 et 2027, comparaisons de prestations, notices sur les classes d'âge, rapports annuels, formulaires.
- Le document « Primes-2024-supplement-prive-DE-FR-Sympany.pdf » (piste de `source-leads.md`) n'est plus lié depuis aucune page lue, mais reste servi. Aucune édition 2025, 2026 ou 2027 trouvée, ni de pendant « supplément général / plus ».

## Barème transcrit dans `sympany.csv`

- Source : `https://www.sympany.ch/dam/jcr:7fc28e5a-95f5-4223-b16c-d5f9ad0f28a8/Primes-2024-supplement-prive-DE-FR-Sympany.pdf` (une page, « Evolution des primes, Etat 2024 », modifié le 17.07.2024).
- Contenu : « Région de primes: Allemagne, France », « Produit actuel: supplément privé », « Produit comparable: premium », « Prime mensuelle hommes et femmes », primes brutes 2024, rabais non pris en compte. Le document précise que seule l'offre personnelle fait foi.
- **Le document n'imprime aucun montant** : c'est un histogramme vectoriel. Les montants sont recalculés à partir de la hauteur des barres et de l'échelle de l'axe (graduations 0 à 70 CHF, 2.731 points par franc). Les huit hauteurs distinctes tombent chacune à moins de 0.002 CHF d'un multiple de 0.10 CHF, et l'ordre de grandeur a été contrôlé à l'œil sur le rendu de la page. Le script refuse d'écrire si une barre s'écarte de plus de 0.02 CHF d'un multiple de 0.05 CHF.

| Tranche publiée | 0–18 | –25 | –30 | –35 | –40 | –45 | –50 | –55 | –60 | –70 | –80 | 81– |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| premium (CHF/mois) | 38.00 | 38.00 | 42.20 | 42.20 | 48.20 | 48.20 | 50.30 | 50.30 | 50.30 | 50.30 | 50.30 | 50.30 |
| supplément privé (CHF/mois) | 39.20 | 39.20 | 49.00 | 49.00 | 58.80 | 58.80 | 61.30 | 61.30 | 61.30 | 61.30 | 61.30 | 61.30 |

Conventions du CSV, différentes du profil standard :

- `year` = 2024 ; `age` = 2024 − année de naissance (et non 2027 − année de naissance), parce que la classe d'âge suit l'âge atteint dans l'année du barème.
- Une ligne par année de naissance et par sexe pour les âges 0 à 80 (naissances 1944 à 2024), plus l'âge 81 (naissance 1943) comme seule borne de la tranche ouverte « 81– ». Tarif unisexe : lignes `f` et `m` identiques.
- `postal_code` vide, `locality` = « Région de primes Allemagne, France » ; `accident` vide (non précisé) ; `variant` vide (le document ne dit pas si « premium » s'entend avec ou sans natura).
- `product_key` = `sympany-premium` pour premium ; vide pour « supplément privé », produit fermé à la vente et absent de `../insurers/sympany.json`.
- `source_type` = `official_published` ; `notes` commence par `derived_from_band <tranche>` et répète les réserves ci-dessus.

Ces montants ne valent pas pour 2027 : la page « Informations sur les primes 2027 » (`/fr/portrait/news-medias/news/informations-primes/primes-suisse.html`, assurés domiciliés en Suisse) annonce pour 2027 une hausse de plus (sans natura), premium (sans natura) et praevention, une baisse de supplément général, supplément privé et kombi général, et des primes inchangées pour les autres complémentaires, sans aucun montant.

## Classes d'âge publiées (utile à la reprise)

Notice « Merkblatt Altersklassen », 09/2022 (`/dam/jcr:4a3f32c9-e874-442e-871b-4d6c3216e842/…`), changement de classe au 1er janvier de l'année où l'âge est atteint :

- plus, premium, supplément général, supplément privé, hospita générale : 0–18, 19–25, 26–30, 31–35, 36–40, 41–45, 46–50, 51–55, 56–60, 61–70, 71–80, 81+.
- hospita demi-privée, privée, accident privé, globale, flex, confort : 0–18, 19–25, puis par 5 ans jusqu'à 76–80, 81+.
- dental : 0–3, 4–5, 6–10, 11–15, 16–18, 19–25, puis par 5 ans jusqu'à 56–60, 61–70, 71–80, 81+.
- capita accident : 0–3, 4–15, 16–20, 21–65, 66+ ; capita maladie : 0–3, 4–15, 16–20, 21–25, puis par 5 ans jusqu'à 61–65 ; compensa : 15–18, 19–25, puis par 5 ans jusqu'à 56–60, 61–70 ; mondial : 0–18, 19–25, puis par 5 ans jusqu'à 56–60, 61–70, 71+ ; salto : 19–27, 28–32 ; tourist et protect : sans classe d'âge.

## Profil

Prévu : début 01.01.2027, 1003 Lausanne, naissances au 15.06 de 1947 à 2026, femme et homme, accident inclus, sans franchise, nouvelle souscription sans assurance de base. Réellement appliqué : aucun, le calculateur n'ayant pas été ouvert. Limites d'âge du calculateur : non constatées.

## Produits absents du relevé

Tous les produits du calculateur, pour la raison ci-dessus : plus, premium (avec et sans natura), hospita (générale, demi-privée, privée, globale, flex, accident privé, confort), dental, mondial, salto, capita, compensa, tourist, protect. La liste même des produits que le calculateur propose n'a pas pu être lue.

## Vérifications

- Contrôle à l'écran de 3 profils : impossible, aucun prix de calculateur affiché.
- Barème 2024 : relecture du CSV (328 lignes, en-tête exact, bornes de tranches aux âges 18/19, 25/26, 45/46, 80/81) et comparaison visuelle des montants avec le rendu de la page.

## Script

`collectors/sympany.py` (Python, dépendance `pdfplumber`) : télécharge le PDF (une requête sur `www.sympany.ch`), relit le graphique et réécrit `sympany.csv`. `--print` affiche le barème sans écrire, `--pdf` relit un fichier local. Il ne contient aucun relevé du calculateur : cette partie reste à écrire quand les deux hôtes seront ouverts.

## Anomalies

- Le formulaire de calcul du site ne propose que l'Allemagne comme pays de résidence, et n'apparaît que sur des pages euroline (frontaliers) : le site suisse oriente les complémentaires vers le conseil, pas vers le calculateur.
- Dans le barème 2024, les tranches 0–18 et 19–25 ont le même montant, et le tarif est plat dès 46 ans, alors que la notice sur les classes d'âge annonce une prime qui évolue à chaque classe. Rien n'indique que le tarif des assurés domiciliés en Suisse ait cette forme.
