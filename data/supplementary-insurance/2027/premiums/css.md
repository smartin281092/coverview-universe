# CSS : relevé des primes LCA 2027 dans le calculateur officiel

Relevé du 18.11.2026. Fichier : `css.csv` (30 324 lignes). Script : `collectors/css.mjs`.

## Calculateur

- Entrée : <https://calculator.css.ch/start?lang=fr>, qui redirige vers `https://calculator.css.ch/fr/personen`.
- Étapes à l'écran : Personnes (sexe, date de naissance, prénom facultatif, NPA) → Assurances (base et complémentaires) → Offre (durée de contrat, début) → Demande → Conclusion. Le relevé s'arrête à « Offre » ; aucune demande n'a été envoyée, aucune coordonnée saisie.

## Méthode : API rejouée dans le navigateur

1. Playwright ouvre le calculateur (`chromium.launch()`, `locale: 'fr-CH'`), une seule session, un seul navigateur par exécution.
2. Le script rejoue les appels de l'application par `fetch` dans la page (mêmes cookies). Pause de 1,1 s après chaque réponse de prix ; environ 13 s par profil à Lausanne (5 appels de prix) et 5 s ailleurs (2 appels).
3. Chaque profil est mis en cache (reprise possible), puis le CSV est reconstruit en entier.

Points d'API (base `https://api.css.ch/css/angebot/v2/kv/web/rechner`, lue dans `https://calculator.css.ch/assets/config/config.json`) :

| Appel | Rôle |
| --- | --- |
| `POST /rechner` (sans corps) | Crée une offre, renvoie son `uuid` (durée 3 ans par défaut) |
| `PUT /rechner/{offre}` `{nis:false, valuta:"2027-01-01", vertragsdauer:1}` | Début d'assurance et durée de contrat des complémentaires (1, 3 ou 5 ans) |
| `POST /rechner/{offre}/personen?sprache=fr` `{vorname, geburtsdatum, geschlecht: FRAU\|MANN, plz:{…}, sprache}` | Ajoute une personne ; la réponse porte `okpProdukte` (base, ignorée) et `vvgProdukte` : chaque complémentaire avec toutes ses variantes, leur prime (`praemie`), leurs options (`optionen`, avec l'écart de prix `differenz`) |
| `PUT /rechner/{offre}/personen/{personne}/produkte/vvg?sprache=fr` `{gewaehlteVvgVkp:[…]}` | Sélection, variante et options d'un produit ; renvoie la liste des produits recalculée |
| `DELETE /rechner/{offre}/personen/{personne}` | Retire la personne (réponse 200 ou 209) |
| `GET https://api.css.ch/css/anzu/v1/stammdaten/plz/all` | NPA → objet localité attendu par l'API (`onrp`, commune, canton) |
| `GET https://calculator.css.ch/api/translations/fr` | Libellés français (variantes dentaires, capitaux, options) |
| `GET /rechner/valuta/all` | Dates de début proposées : le 1er de chaque mois de 2027 |

Comportements de l'API à connaître :

- Le `PUT …/produkte/vvg` n'applique qu'**un changement de produit par appel** (essai avec trois produits modifiés : seul le premier a été pris en compte). Le script modifie donc un produit à la fois, placé en dernier dans la liste comme le fait l'interface, et vérifie dans la réponse que l'option demandée est bien active avant d'écrire un prix.
- Une option n'a d'effet que si le produit est sélectionné ; elle s'applique alors à toutes les variantes renvoyées.
- La médecine alternative n'apparaît dans la liste qu'une fois l'ambulatoire ou l'hospitalisation myFlex sélectionnée. Son prix est le même avec l'un ou l'autre prérequis (essai du 18.11.2026, F 1990).
- Après un `PUT`, la valeur d'option affichée pour un produit **non modifié** peut ne pas correspondre au prix renvoyé (soins dentaires enfant : variante « 75%, max. CHF 2'000 » renvoyée à 19.70 avec « attestation : avec », alors que 19.70 est le prix « sans » et 11.20 le prix « avec »). Le CSV ne reprend donc, après un `PUT`, que le produit modifié et la médecine alternative.

## Profil réellement appliqué

- Début d'assurance : 01.01.2027.
- Localités : 1003 Lausanne, 1204 Genève, 1950 Sion, 2000 Neuchâtel, 1700 Fribourg, 2800 Delémont. Quand le NPA couvre plusieurs communes, la commune du même nom a été retenue (Sion, Neuchâtel, « Freiburg », Delémont).
- Naissance le 15.06 de chaque année de 1947 à 2026, femme et homme : 960 profils interrogés. `age` = 2027 − année de naissance, soit 1 à 80 (le calculateur affiche l'âge révolu, 36 ans pour 1990).
- Prénom « Test », nationalité CH par défaut, « Nouveau en Suisse : non ». Une seule personne à la fois dans l'offre, retirée après lecture.
- **Sans assurance de base** : aucune base n'est sélectionnée par l'API. À l'écran, où une base est toujours cochée, les primes des complémentaires sont les mêmes (voir vérifications).
- **Durée de contrat 1 an**, donc sans rabais pluriannuel. Le calculateur présélectionne 3 ans ; son infobulle annonce 2 % de rabais pour trois ans et 4 % pour cinq ans sur les assurances myFlex ambulatoire, hospitalisation et médecine alternative. Constaté pour F 1990 Lausanne, ambulatoire Economy : 12.40 (1 an), 12.10 (3 ans), 11.90 (5 ans). Les autres produits ne changent pas avec la durée.
- Couverture accident incluse (`accident` = `true`) pour l'ambulatoire et l'hospitalisation myFlex, seuls produits à proposer l'option. Colonne vide pour les autres.
- Rabais famille : aucun. Le calculateur l'affiche à 0.00 pour un enfant seul.

### Colonne `option`

| Produit | Valeurs | Remarque |
| --- | --- | --- |
| Hospitalisation myFlex | `Votre participation aux coûts: elevée` (défaut du calculateur) et `… basse` | Il n'existe pas de variante sans participation : le produit laisse choisir la division à chaque séjour, avec une participation en demi-privé et en privé. L'option n'est donc jamais vide pour ce produit |
| Soins dentaires, variante « 75%, max. CHF 2'000 (excl. corrections de la position des dents) » | `Attestation dentaire: avec` (défaut) et `… sans` | « sans » relevé à Lausanne seulement |
| Ambulatoire et hospitalisation myFlex, Economy et Balance | `Option Upgrade: avec` | Lausanne seulement ; pour l'hospitalisation, avec participation « elevée » |
| Autres | vide | |

`notes` porte `calculator_default_options` quand toutes les options sont à leur valeur par défaut, `contract_1y_no_multiyear_discount` pour les produits myFlex, `requires_ambulatory_or_hospital_myflex` pour la médecine alternative, et `api=<type>/<numéro de variante>`.

## Produits relevés

`product_key` vient de `../insurers/css.json`.

| Produit (libellé du calculateur) | Variantes | Dépend de | Années de naissance offertes |
| --- | --- | --- | --- |
| Assurance ambulatoire myFlex | Economy, Balance, Premium | âge | 1947–2026 |
| Assurance d’hospitalisation myFlex | Economy, Balance, Premium | âge, sexe, canton | 1957–2026 |
| Assurance pour médecine alternative myFlex | Economy, Balance, Premium | âge, sexe | 1947–2026 |
| Assurance des frais de guérison en cas d'accident | une seule | âge | 1957–2026 |
| Assurance pour soins dentaires | 4 niveaux de prise en charge | âge | 1957–2026 |
| Assurance en cas de décès ou d’invalidité par accident | 14 combinaisons de capitaux | âge, sexe | 1962–2026 |
| Assurance pour décès ou invalidité par maladie | 14 combinaisons de capitaux | âge, sexe | 1972–2026 |

Les soins dentaires n'ont pas de niveaux Economy / Balance / Premium dans le calculateur : les variantes sont « 50%, max. CHF 1'000 », « 75%, max. CHF 2'000 (excl. corrections de la position des dents) », « 75%, max. CHF 3'000 » et « 75%, max. CHF 5'000 (franchise CHF 500) ».

### Limites d'âge constatées

- Hospitalisation, frais de guérison, soins dentaires : non proposés aux personnes nées en 1956 ou avant (dernier âge offert : 70 ans dans l'année 2027).
- Option Upgrade : proposée de 1959 à 2026.
- Capital accident : 1962–2026. Capital maladie : 1972–2026.
- Nombre de combinaisons de capitaux selon l'année de naissance. Accident : 5 pour 1962–1966, 13 pour 1967–2001, 7 pour 2002–2026. Maladie : 13 pour 1972–2001, 7 pour 2002–2026. « Décès: 5'000 / Invalidité: 100'000 » n'est proposée que pour 2009–2026, où elle remplace « Décès: 10'000 / Invalidité: 100'000 ».
- Ambulatoire et médecine alternative : proposées jusqu'à 80 ans, âge le plus élevé testé.

### Tarification observée

- Les primes sont constantes par tranche d'âge, l'âge tarifaire étant 2027 − année de naissance. Ambulatoire myFlex : jusqu'à 15, 16–27, 28–35, 36–45, 46–50, 51–55, 56–60, 61–65, 66–70, 71–80. Chaque année a été interrogée ; aucune ligne `derived_from_band`.
- Localités : Lausanne, Genève, Fribourg et Neuchâtel donnent des primes identiques pour tous les produits (4 940 lignes comparées par localité). Sion et Delémont, identiques entre elles, ne diffèrent que pour l'hospitalisation myFlex, moins chère : F 1957 Economy « basse » 55.50 contre 64.80 à Lausanne.

## Produits du calculateur absents du relevé

- **Compte «santé»** et **Bonus du compte «santé»** : ajoutés d'office et gratuitement avec l'hospitalisation myFlex (« inclus » à l'écran, prime 0 dans l'API), non sélectionnables seuls.
- **Private Assistance** : libellé présent dans les traductions du calculateur, jamais renvoyé par l'API pour les profils interrogés.
- Options non relevées : « Couverture accidents : sans », « Exclusion des prestations de maternité : oui », Option Upgrade combinée à la participation « basse », Option Upgrade et attestation dentaire « sans » hors de Lausanne, durées de 3 et 5 ans. L'API donne l'écart de prix de chacune (`differenz`) ; rien n'en a été déduit dans le CSV.
- Profil « enfant à naître » : non interrogé.
- Les autres complémentaires CSS listées dans `../insurers/css.json` (Livo, Standard, cas d'urgence, cure et soins, indemnités journalières, frais de ménage, voyages, protection juridique) ne sont pas proposées par ce calculateur.

## Vérifications à l'écran

Parcours complet de l'interface, puis page « Offre » réglée sur « 1 an », pour quatre situations à Lausanne. Tous les montants affichés sont ceux du CSV.

| Profil | Affiché à l'écran |
| --- | --- |
| F 1990 | ambulatoire Economy 12.40 ; hospitalisation Economy « elevée » 18.30 ; médecine alternative Economy 25.20 ; frais de guérison 11.70 ; dentaire 75 % max. 2'000 avec attestation 58.70 ; capital accident 10'000/20'000 1.60 ; capital maladie 10'000/20'000 5.50 |
| M 2015 | 8.60 ; 4.90 ; 7.40 ; 5.60 ; dentaire 50 % max. 1'000 21.80 ; capital accident 5'000/100'000 1.90 ; capital maladie 5'000/100'000 5.70 ; rabais familial 0.00 |
| F 1960 | 20.30 ; 32.40 ; 25.10 ; 19.70 ; dentaire 75 % max. 2'000 avec attestation 89.00 ; pas de capitaux proposés |
| F 1990, options | ambulatoire Economy avec Option Upgrade 14.90 ; hospitalisation Economy « basse » 36.70 ; dentaire 75 % max. 2'000 sans attestation 102.60 |

Dans ces parcours la base « modèle standard » était cochée (l'interface en impose une) : le total affiché est la somme exacte de la base et des complémentaires, sans rabais de combinaison (F 1990 : 704.95).

Contrôle interne du script : pour chaque prix relevé avec une seule option modifiée, comparaison avec « prix par défaut + écart annoncé par l'API ». Aucun écart sur les 960 profils.

## Anomalies et remarques

- Aucune erreur HTTP, aucun captcha, aucun blocage pendant le relevé (2 332 appels de prix en 1 h 40).
- Incohérence d'affichage de l'API sur les options des produits non modifiés, décrite plus haut ; sans effet sur le CSV.
- Hôtes bloqués par le proxy, sans effet sur les prix : `js.monitor.azure.com` et `switzerlandnorth-0.in.applicationinsights.azure.com` (télémétrie Application Insights), `assets.adobedtm.com` (gestionnaire de balises Adobe).
- Les primes de la médecine alternative baissent aux âges élevés (F Economy : 26.80 de 41 à 55 ans, 25.10 de 56 à 75 ans, 21.00 ensuite) et celles de l'hospitalisation femme baissent légèrement de 41 à 45 ans. Ce sont les valeurs renvoyées par le calculateur.

## Relancer

```bash
node collectors/css.mjs                      # 6 localités, 1947-2026, écrit ../css.csv
node collectors/css.mjs --localities 1003 --years 1990-1992 --raw /chemin/cache.jsonl --out /chemin/essai.csv
node collectors/css.mjs --csv-only --raw /chemin/cache.jsonl   # reconstruit le CSV depuis le cache
```

Le cache (`--raw`, par défaut dans le dossier temporaire du système) évite de réinterroger un profil déjà relevé : le supprimer pour un relevé neuf.
