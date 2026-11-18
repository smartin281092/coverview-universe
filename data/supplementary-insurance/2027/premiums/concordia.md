# CONCORDIA — relevé des primes LCA 2027

- Calculateur : https://www.praemienrechner.concordia.ch/ipr/home?lang=fr
- Date du relevé : 2026-11-18
- Résultat : `concordia.csv`, 46 060 lignes ; script : `collectors/concordia.mjs`

## Méthode

API rejouée. Le calculateur (application Angular) tire tous ses prix d'un seul appel JSON. Le script ouvre la page d'accueil une fois avec Playwright (`chromium.launch()`, `locale: 'fr-CH'`), puis rejoue cet appel avec `fetch()` dans le contexte de la page, à 1,1 s d'intervalle au minimum, une seule session.

- Chaque appel de prix porte deux personnes, une femme et un homme de la même année de naissance. Contrôle intégré au script : pour 8 années (1962, 1963, 1975, 1990, 2008, 2009, 2015, 2026) et les deux sexes, la demande à une seule personne donne exactement les mêmes primes (866 primes comparées, 0 écart).
- 828 réponses relevées : 1 fichier de libellés, 6 recherches de NPA, 480 appels par défaut (6 localités × 80 années), 16 contrôles individuels, 325 appels de franchise (Lausanne). Deux appels ont été répétés une fois après une erreur passagère ; aucun captcha ni blocage.
- Le parcours s'arrête avant l'offre : aucun appel à `rest/antrag`, aucune coordonnée transmise. Prénom « Test » pour les vérifications à l'écran.

## Points d'API

| Appel | Rôle |
| --- | --- |
| `GET /ipr/rest/general/gemeinden/plz/<NPA>` | communes du NPA et région de prime (`iprPraemienregion`) |
| `POST /ipr/rest/praemien` | toutes les primes d'une ou plusieurs personnes : `praemienregion`, puis par personne `birthDate`, `geschlecht` (`w`/`m`), dates de début, `produktSelection`, `produktConfigurations` (franchise et accident des produits hospitaliers) |
| `GET /ipr/assets/i18n/fr.json` | libellés français des produits, utilisés pour `product_name` et `variant` |
| `POST /ipr/rest/general/date-calculation`, `GET /ipr/rest/general/cms-content/products?lang=FR`, `GET /ipr/rest/configuration` | appels de l'interface, non nécessaires au relevé |

La réponse de `rest/praemien` donne par produit `grundPraemie` (prime brute), `deductions` et `totalPraemie`. `monthly_chf` reprend `grundPraemie` pour le profil par défaut (aucune déduction constatée sur les produits LCA) et `totalPraemie` pour les lignes avec franchise.

## Profil appliqué

- Début d'assurance 01.01.2027 (date proposée par défaut ; `gueltigAb` = 2027-01-01 sur toutes les lignes).
- Naissance le 15.06 de chaque année de 1947 à 2026, femme et homme. `age` = 2027 − année de naissance ; c'est aussi l'âge tarifaire du calculateur (les classes changent à l'année civile).
- Localités et régions de prime : 1003 Lausanne `VD_1`, 1204 Genève `GE_0`, 1950 Sion `VS_1`, 2000 Neuchâtel `NE_0`, 1700 Fribourg `FR_1` (commune de Fribourg ; Düdingen et Tafers, même NPA, sont en `FR_2` et ne sont pas relevées), 2800 Delémont `JU_0`.
- Sans assurance de base : `produktSelection` vide. Contrôle sur un profil (1987, femme, Lausanne) : les 114 primes de la réponse sont identiques avec ou sans assurance de base et complémentaires sélectionnées.
- Accident : l'Assurance-hospitalisation est toujours calculée avec couverture accident dans le calculateur public (`accident` = `true`). ACCIDENTA est une assurance-accidents (`true`). DIVERSA, NATURA et soins dentaires n'ont pas d'option accident (colonne vide).
- Franchise hospitalière : défaut 0. Les options 1'000, 2'000, 3'000, 5'000 et 10'000 existent pour PRIVÉE et MI-PRIVÉE seulement ; elles sont relevées pour Lausanne (`option` = `franchise 1'000`…, prix net, prime sans franchise et rabais dans `notes`). Rabais constatés : 12, 22, 32, 42 % puis 62 % (PRIVÉE) ou 65 % (MI-PRIVÉE).
- Prime brute, aucun rabais appliqué. Non appliqués : rabais de santé (option de la page d'offre, engagement sportif), rabais HMO, rabais collectif, gratuité dès le 3e enfant, rabais DIMA à partir de deux personnes, cadeau BENEFIT (bon d'achat unique, pas une réduction de prime).
- Durée de contrat : la page d'offre affiche 3 ans au minimum pour les complémentaires (1 an pour ACCIDENTA). L'appel de prix ne contient aucune durée ; l'effet d'un autre choix de durée n'a pas été testé.

## Produits et variantes relevés

| `product_name` | `variant` | Lignes | Années de naissance | Dépend de |
| --- | --- | --- | --- | --- |
| Assurance-hospitalisation | COMMUNE, LIBERO, MI-PRIVÉE, PRIVÉE | 4 420, dont 1 300 avec franchise | 1962–2026 | âge, région (LIBERO identique dans les 6 localités) |
| DIVERSA | DIVERSA, DIVERSAcare, DIVERSAplus, DIVERSApremium | 3 120 | 1962–2026 | âge |
| NATURA | NATURA, NATURAplus | 1 560 | 1962–2026 | âge |
| Assurance pour soins dentaires | Variante 1 à 4 | 2 880 | 1967–2026 | âge |
| ACCIDENTA | 14 combinaisons de capitaux décès / invalidité | 6 984 | 1967–2026 | âge, sexe dès 16 ans |
| DIMA Décès, DIMA Invalidité | somme assurée de CHF 10'000 à 500'000 ; `option` = `maladie et accident` ou `maladie uniquement` | 27 096 | 1962–2026 | âge, sexe dès 18 ans |

Lausanne compte 8 760 lignes, chacune des cinq autres localités 7 460. Seule l'Assurance-hospitalisation varie entre les six localités ; les autres produits y ont des primes identiques, relevées quand même pour chaque localité.

Les lignes DIMA portent `api_only_not_in_public_ui` dans `notes` : l'API renvoie ces primes, mais la section DIMA n'est affichée que dans la version interne de l'application (condition `isCobra` dans le code), pas dans le calculateur public. Elles n'ont donc pas pu être vérifiées à l'écran ; voir la vérification croisée ci-dessous.

## Limites d'âge constatées

- Années 1947 à 1961 (66 ans et plus en 2027) : l'API ne renvoie que l'assurance de base, aucune complémentaire. À l'écran (15.06.1957), l'étape « Assurances complémentaires » est sautée.
- Assurance-hospitalisation, DIVERSA, NATURA : jusqu'à 65 ans (1962).
- Soins dentaires et ACCIDENTA : jusqu'à 60 ans (1967).
- ACCIDENTA selon l'âge : 1 à 3 ans (2024–2026) seulement CHF 2'000 / 50'000 et 2'000 / 100'000 ; 4 à 15 ans (2012–2023) seulement 10'000 / 50'000, 10'000 / 100'000 et 20'000 / 100'000 ; dès 16 ans les douze combinaisons adultes.
- DIMA : `maladie uniquement` dès 18 ans ; décès au-delà de CHF 20'000 dès 13 ans, au-delà de 300'000 dès 16 ans.
- Classes d'âge tarifaires observées : 0–15, 16–20, puis tranches de 5 ans jusqu'à 56–60, puis 61–65 (hospitalisation, DIVERSA, NATURA, certaines tranches ayant le même prix) ; 0–4, 5–8, 9–15, 16–20, 21+ (soins dentaires) ; 0–17, 18–22, tranches de 5 ans, 58–65 (DIMA). Chaque année a été relevée, aucune ligne `derived_from_band`.

## Produits du calculateur absents du relevé

- Assurance de base LAMal (myDoc, HMO, smartDoc, modèle traditionnel) : hors périmètre LCA.
- Ancienne génération DIMA (clés `TIKU_Tod`, `TIKU_Invaliditaet`) : renvoyée par l'API pour 1973–2026, mais l'interface ne demande que la génération 2026 (`TIKU2026_*`) ; non relevée.
- Assurance-hospitalisation sans couverture accident : option présente dans l'API, masquée dans le calculateur public. Exemple lu (1987, femme, Lausanne) : rabais de 0.30 (COMMUNE), 1.65 (LIBERO), 5.05 (MI-PRIVÉE), 9.60 (PRIVÉE). Non relevée.
- Franchises hospitalières hors Lausanne : non relevées.
- Indemnités journalières : le calculateur renvoie à l'agence, aucun prix.
- Assurance vacances et voyages : absente du calculateur.

## Vérifications

À l'écran, 6 profils parcourus dans l'interface, 105 prix affichés, tous identiques au CSV :

| Profil | Prix comparés |
| --- | --- |
| 15.06.1987, femme, 1003 Lausanne | 26 |
| 15.06.2015, homme, 1003 Lausanne | 17 |
| 15.06.1962, homme, 1003 Lausanne | 10 (hospitalisation, NATURA, DIVERSA ; ni dentaire ni ACCIDENTA proposés) |
| 15.06.1975, homme, 1204 Genève | 26 |
| 15.06.1987, femme, 1003 Lausanne, second passage | 26 |
| 15.06.1957, femme, 1003 Lausanne | 0 : étape complémentaire sautée, aucune ligne dans le CSV |

Franchise : pour 1987, femme, Lausanne, PRIVÉE, le total affiché passe à 637.75 avec la franchise 1'000 et à 564.00 avec 10'000, ce qui correspond aux primes nettes du CSV (129.80 et 56.05).

Croisement avec les tarifs publiés repris dans `../insurers/concordia.json` :

- DIMA : les 4 516 lignes de Lausanne égalent le tableau des primes DIMA (A.20, par tranche de CHF 10'000) multiplié par la somme assurée.
- Soins dentaires : les 2 880 lignes égalent le flyer A.10.

## Anomalies et réserves

- DIMA : l'API donne des primes jusqu'à 65 ans, alors que les conditions notées dans `../insurers/concordia.json` excluent toute nouvelle conclusion à partir de l'année civile des 56 ans. Les lignes DIMA au-delà de 55 ans sont des valeurs de tarif, pas des offres de souscription confirmées.
- NATURA et NATURAplus baissent dans la classe 61–65 (NATURA 27.50 contre 31.00 à 51–60 ; NATURAplus 52.50 contre 57.50). Valeurs confirmées à l'écran pour 1962.
- ACCIDENTA : le calculateur n'indique pas la variante de progression (225 % ou 350 %) à laquelle correspondent ses primes.
- `product_key` vient de `../insurers/concordia.json` : LIBERO porte `concordia-assurance-hospitalisation-libero`, les trois autres variantes hospitalières `concordia-assurance-hospitalisation`.
- Hôte bloqué par le proxy : `assets.adobedtm.com` (traceur Adobe Launch), sans effet sur les prix. La pastille du conseiller reste vide à l'écran ; sa photo est servie par `secure.concordia.ch`, blocage probable mais non confirmé dans les journaux.
- Les réponses brutes ne sont pas dans le dépôt ; `--raw-dir <dossier>` les conserve à la relance.
