# Sympany — relevé des primes LCA 2027 dans le calculateur officiel

**État au 2026-11-18 : relevé complet.** `sympany.csv` contient 11 784 lignes : 9 produits (15 combinaisons produit / variante / option), 6 localités, naissances 1957 à 2026 selon le produit, femme et homme. Tous les prix viennent de l'API du calculateur officiel ; 7 profils ont été ressaisis dans l'interface et leurs 49 prix affichés concordent avec le relevé.

À savoir avant d'utiliser les données : le site `www.sympany.ch` ne lie ce calculateur que pour les frontaliers (`country=de`). Le parcours pour un domicile suisse s'ouvre en remplaçant ce paramètre par `country=ch`, valeur que l'application prévoit et accepte ; aucun lien public n'y mène.

## Calculateur

- URL utilisée : `https://calculator.sympany.ch/#/fr?country=ch` (l'application réécrit l'adresse en `https://calculator.sympany.ch/?country=ch`). Titre « Calculateur de primes », application React.
- Sans paramètre `country`, l'application renvoie vers `https://www.sympany.ch/fr/contact/conseil-a-la-vente.html` : sa configuration ne propose aucun pays par défaut (`offerableCountries: []`) et elle prend alors le pays dans l'URL. Valeurs acceptées par le code : `ch` et `de`.
- Étapes : Personnes (sexe, prénom facultatif, date de naissance, pays « Suisse », NPA) → Assurance de base → Assurance complémentaire (hospitalisation, ambulatoire, dentaire) → Vérifier → Confirmation. Le relevé s'arrête à l'étape dentaire : aucune coordonnée, aucun questionnaire, aucune demande d'offre.
- Le calculateur accepte 1003 Lausanne et chiffre les complémentaires sans qu'un modèle d'assurance de base soit choisi.

## Méthode

API rejouée. L'application obtient tous les prix d'une personne par un seul appel, sans jeton ni cookie :

`GET https://api-public.sympany.ch/products/offer?sex=<f|m>&dateOfBirth=<AAAA-MM-JJ>&country=ch&zip=<npa>&subZip=<n>&language=fr&isPolicyOwner=true&insuranceStartDate=2027-01-01`

- Réponse : `products[] { id, title, isBasicInsurance, productDependencies, variations[] { id, title, descriptiveTitle, configurations[] { id, label, coverageOptions[] { accident, price, preselected } } } }`, plus `discounts[]` (toujours vide ici).
- Autres points utiles : `GET /products/areas?searchZip=<npa>&country=ch` (localités : `id`, `zip`, `subZip`, `name`) et `GET /maintenance/features` (état des fonctions).
- Le script saisit d'abord un profil pilote dans l'interface (femme, 15.06.1987, 1003 Lausanne, prénom « Test »), capte l'appel réellement émis, vérifie ses paramètres et la date de début, compare les prix affichés à la réponse, puis rejoue l'appel dans la page pour chaque profil : une personne par requête, 1,1 s de pause, arrêt sur 403/429 ou trois erreurs de suite.
- Volume : 1 864 appels de prix rejoués (960 profils, puis 904 demandes de complément, voir « Anomalies »), tous en HTTP 200, environ 4 s par appel. S'y ajoutent une vingtaine de sessions d'interface (exploration et contrôles) et 24 appels directs de contrôle pour l'année 1967. Aucun captcha, aucun blocage.

## Profil réellement appliqué

- Début d'assurance : 01.01.2027, proposé d'office par le calculateur pour la Suisse.
- Localités : 1003 Lausanne, 1204 Genève, 1950 Sion, 2000 Neuchâtel, 1700 Fribourg, 2800 Delémont.
- Naissances : 15.06 de chaque année de 1947 à 2026, femme et homme, soit 960 profils. `age` = 2027 − année de naissance.
- Personne seule, preneuse d'assurance (`isPolicyOwner=true`), nouvelle souscription, sans assurance de base.
- Accident : inclus quand l'option existe (gamme hospita) ; le prix sans accident est dans `notes` (`sans_accident=…`). Les produits plus, premium, dental et hospita accident privée n'ont pas d'option accident dans le calculateur : colonne `accident` vide.
- Prime brute mensuelle : la réponse ne contient aucun rabais (`discounts` vide pour les 960 profils).

## Produits relevés

| Produit affiché | Identifiant | `product_key` | `variant` | `option` | Âges obtenus |
| --- | --- | --- | --- | --- | --- |
| hospita générale | `KO-1` | `sympany-hospita` | Division commune | | 1 à 69 |
| hospita demi-privée | `KO-2` | `sympany-hospita` | Division demi-privée | | 1 à 69 |
| hospita privée | `KO-3` | `sympany-hospita` | Division privée | | 1 à 69 |
| hospita globale | `KO-4` | `sympany-hospita` | Division privée dans le monde entier | | 1 à 69 |
| hospita flex | `KOF3` | `sympany-hospita-flex` | Choix flexible de la division | 3 participations aux coûts | 1 à 59 |
| hospita accident privée | `KOU-3` | `sympany-hospita-accident-prive` | | | 1 à 69 |
| plus | `PL` | `sympany-plus` | Sans natura, Avec natura | | 1 à 70 |
| premium | `PR` | `sympany-premium` | Sans natura, Avec natura | | 1 à 70 |
| dental | `DE` | `sympany-dental` | 3 niveaux : 50 % max. 1’000.-, 75 % max. 1’500.-, 75 % max. 5’000.- | | 1 à 60 |

- hospita flex : l'option par défaut de l'interface (« Demi-privée: sans participation aux coûts | Privée: 20% participation aux coûts, max. 3’000.- ») a la colonne `option` vide et la mention `default_option` dans `notes` ; les deux autres participations portent leur libellé dans `option`.
- `notes` commence par `id=<produit>/<variation>/<configuration>` (par exemple `id=DE/DE/C` pour dental C).
- dental exige un autre produit Sympany : la réponse indique `productDependencies` = ambulatoire, hospitalisation ou assurance de base. Le prix relevé est celui de dental seul.

## Limites d'âge constatées

Identiques dans les six localités et pour les deux sexes :

- plus, premium : jusqu'aux naissances 1957 (70 ans en 2027).
- hospita générale, demi-privée, privée, globale et accident privée : jusqu'aux naissances 1958 (69 ans).
- dental : jusqu'aux naissances 1967 (60 ans).
- hospita flex : jusqu'aux naissances 1968 (59 ans) ; absent des 24 réponses demandées pour 1967.
- Naissances 1947 à 1956 : le calculateur ne propose que l'assurance de base, donc aucune ligne.
- L'âge 0 (naissance en 2027) est hors du profil ; l'option « bébé à naître » n'a pas été utilisée.

## Ce que montrent les prix

- Région : Lausanne, Genève, Sion, Neuchâtel et Delémont ont exactement les mêmes primes pour tous les produits. Fribourg diffère pour la gamme hospita, hospita accident privée et premium ; plus et dental sont identiques partout.
- Sexe : hospita demi-privée, privée, globale et flex ont un tarif par sexe ; les autres produits sont unisexes.
- Classes d'âge observées à Lausanne (CHF par mois, avec accident pour hospita) :
  - plus sans natura : 1–25 : 23.70 ; 26–35 : 24.90 ; 36–45 : 28.40 ; 46–70 : 29.70.
  - premium sans natura : 1–25 : 46.40 ; 26–35 : 51.50 ; 36–45 : 58.80 ; 46–70 : 61.30.
  - hospita générale : 1–18 : 2.90 ; 19–25 : 4.10 ; 26–30 : 5.80 ; 31–35 : 6.70 ; 36–40 : 7.30 ; 41–45 : 7.70 ; 46–50 : 8.30 ; 51–55 : 9.30 ; 56–60 : 11.60 ; 61–69 : 16.30.
  - hospita demi-privée, femme : 1–18 : 43.50 ; 19–25 : 89.30 ; 26–30 : 175.50 ; 31–55 : 221.30 ; 56–60 : 288.50 ; 61–69 : 373.90. Homme : 36.70 ; 52.70 ; 76.30 ; puis 84.00 (31–35), 99.20, 125.90, 160.30, 217.50 (51–55), 288.50, 373.90.
  - dental 50 % : 1–3 : 0.00 ; 4–5 : 4.50 ; 6–10 : 7.00 ; 11–18 : 17.00 ; 19–25 : 15.50 ; 26–30 : 22.00 ; puis par 5 ans jusqu'à 56–60 : 35.00.

## Vérifications à l'écran

Sept profils ressaisis dans l'interface, prix des cartes lus aux étapes hospitalisation, ambulatoire et dentaire, comparés au relevé : 49 prix, 49 concordances.

| Profil | Prix contrôlés | Exemples affichés |
| --- | --- | --- |
| Lausanne, femme, 1987 | 8 | hospita demi-privée 221.30, hospita flex 238.00, plus 28.40, dental 26.00 |
| Genève, homme, 1962 | 6 | hospita générale 16.30, hospita privée 533.20, premium 61.30 |
| Sion, femme, 2015 | 7 | hospita demi-privée 43.50, plus 23.70, dental 17.00 |
| Neuchâtel, homme, 1999 | 7 | hospita demi-privée 76.30, premium 51.50, dental 22.00 |
| Fribourg, femme, 1975 | 7 | hospita demi-privée 148.50, premium 54.30, dental 33.50 |
| Delémont, homme, 1990 | 7 | hospita privée 141.50, plus 28.40, dental 26.00 |
| Lausanne, homme, 2026 | 7 | hospita demi-privée 36.70, plus 23.70, dental 0.00 |

Pour le profil pilote, les écarts affichés par l'interface ont aussi été recoupés à la main : hospita demi-privée sans accident (−20.10, soit 201.20) et les deux autres participations d'hospita flex (−100.70 et −151.10, soit 137.30 et 86.90).

## Produits absents du relevé

- Assurance de base (six modèles, franchises 300 à 2500) : chiffrée par le calculateur, mais hors LCA, donc non relevée.
- Le calculateur ne propose pas les autres complémentaires de Sympany (mondial, salto, capita accident, capita maladie, compensa, tourist, tourist subito, protect) : aucun prix.

## Anomalies

- **hospita flex absent par intermittence.** Pour un même profil, l'API renvoie ou non la variation `KOF3` d'un appel à l'autre (présente dans environ une réponse sur deux), et l'interface affiche ou non la carte correspondante. Le script redemande donc les profils où elle manque alors qu'elle a été vue au même âge ailleurs, puis fusionne les réponses : 367 profils complétés ainsi, jusqu'à 17 demandes pour un même profil, aucun écart de prix entre deux réponses d'un même profil. Les 708 profils éligibles (naissances 1968 à 2026) sont tous couverts.
- Le site public ne mène pas au calculateur pour un domicile suisse (voir plus haut). Les prix sont ceux que l'API officielle renvoie pour 2027, mais Sympany oriente ces clients vers le conseil.
- hospita flex, femme : la prime baisse à 41 ans (238.00 de 31 à 40 ans, 213.40 de 41 à 45 ans à Lausanne). dental : la prime baisse à 19 ans (17.00 de 11 à 18 ans, 15.50 de 19 à 25 ans). Relevé tel quel.
- dental est à 0.00 pour les naissances 2024 à 2026, à l'écran comme dans l'API.

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `calculator.sympany.ch` | calculateur | atteint |
| `api-public.sympany.ch` | API : localités, offre chiffrée, état des fonctions | atteint |
| `www.sympany.ch`, `cdn.sympany.ch` | site public, feuilles de style | atteints |
| `hello.sympany.ch` | formulaires de contact, aucun calculateur | atteint |
| `sales.sympany.ch` | « Login intermédiaire » pour courtiers | page de connexion vue, aucune tentative |
| `api-auth.sympany.ch` | étapes de souscription après « Vérifier » | jamais sollicité |
| `rum.sympany.ch`, `app.usercentrics.eu`, `www.googletagmanager.com` | télémétrie, consentement, traceur | refusés par le proxy, sans importance |

`robots.txt` : `calculator.sympany.ch` n'en publie pas (404) ; celui de `www.sympany.ch` interdit `/.premiumCalculator/` et `/chat/`, chemins jamais sollicités.

## Script

`collectors/sympany.mjs` (Node, Playwright) : `node sympany.mjs` refait tout le relevé ; `--localities=1003 --years=1990-1992` le restreint ; `--verify=1003:1987:f,…` ressaisit des profils dans l'interface ; `--build-only` reconstruit le CSV depuis le cache des réponses (`--raw-dir`, par défaut dans le dossier temporaire du système). Le relevé complet prend environ deux heures à cause de la lenteur de l'API et des demandes de complément.

## Barème 2024 écarté

Le seul barème publié trouvé sur `www.sympany.ch` est le graphique « Evolution des primes, Etat 2024 » (`/dam/jcr:7fc28e5a-95f5-4223-b16c-d5f9ad0f28a8/Primes-2024-supplement-prive-DE-FR-Sympany.pdf`) : région de primes Allemagne/France (frontaliers), produits « supplément privé » et « premium », sans aucun montant imprimé. Il n'est pas repris dans le CSV : année 2024, hors domicile suisse, valeurs lisibles seulement en mesurant les barres.
