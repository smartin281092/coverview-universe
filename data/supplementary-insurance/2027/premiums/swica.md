# SWICA : relevé des primes LCA 2027 dans le calculateur officiel

Relevé du 18.11.2026. Fichier : `swica.csv` (35 928 lignes). Script : `collectors/swica.mjs`.

## Calculateur

- Entrée fournie : <https://calculate.swica.ch/?ID=prm-allg&LANGUAGES=2&SWICAKDN=0>, qui répond 302 vers `/de?…` (allemand). Le relevé ouvre la version française : <https://calculate.swica.ch/fr?ID=prm-allg&LANGUAGES=2&SWICAKDN=0> (valeur de `source_url`).
- Étapes à l'écran : « Saisir une personne » (sexe, prénom, date de naissance, pays, NPA, début souhaité du contrat) → « Assurances » (onglets Assurance de base, Assurances complémentaires, Assurance hospitalisation) → « Résumé » → « Conclusion ». Seules les deux premières ont été parcourues.
- Les libellés français viennent de `rms.swica.ch` (`…/namespaces/<id>/translations`), les prix de `calculate.swica.ch/backend/offer/v1`.

## Méthode : API rejouée dans le navigateur

1. Playwright ouvre le calculateur (`chromium.launch()`, `locale: 'fr-CH'`), un seul navigateur.
2. Le script reprend les en-têtes que l'application envoie elle-même à son backend (`Authorization: APIKEY …` lu dans la configuration publique de la page, `X-ADC-ACCOUNT-ID: EXTERNAL`, `client-page`, plus `X-ADC-PASSPHRASE: <NPA>`), puis rejoue les appels par `fetch` dans la page, 1,1 s entre deux requêtes. Aucune clé n'est écrite dans le script.
3. Chaque réponse est mise en cache (`--raw-dir`, reprise possible), puis le CSV est reconstruit en entier.

| Appel (`https://calculate.swica.ch/backend/offer/v1`) | Rôle |
| --- | --- |
| `GET /postcode?q=1003` | NPA → `[{id, postcode, city}]` ; `id` sert de `postcodeId` |
| `POST /` | Ouvre une session avec la première personne : `{name, country: "CH", postcodeId, postCode: null, dateOfBirth, working8HoursPerWeek, unborn: false, female, offerAnalytics}` → `{pin, personId}` |
| `PUT /session/{pin}/kvg` et `/vvg` | Début d'assurance : `{pin, personId, insuranceBegin: "2027-01-01"}` |
| `POST /session/{pin}/insurableperson` | Ajoute une personne à la session → `{personId}` |
| `GET /session/{pin}/insurableperson` | Personnes de la session, avec `insuranceBegin` |
| `GET /session/{pin}/insurableperson/{personId}/productgroup` | **Tous les prix d'une personne** : par groupe (`group.base.insurance`, `group.additional.insurance`, `group.hospital.insurance`), par modèle de produit, la liste `cartesianProduct` de toutes les combinaisons d'options (`ACCIDENT`, `DEDUCTIBLE`, `FRANCHISE`, `PLUS_OPTION`, `INSURED_SUM`, `YEARLY_FRANCHISE`) avec leur prix, et `defaultCartesianProducts` (ce que l'écran affiche) |
| `GET …/{personId}/insuranceneeds/productproposal` | Proposition du calculateur : met une assurance de base dans le panier et active le bonus BENEVITA ; renvoie `calculationYear` |
| `PUT …/{personId}/productgroup` | Panier : `[{productId, cartesianProductId}]` (utilisé par l'écran, pas par le relevé) |
| `PUT …/{personId}/bonusprogram` | `{bonusProgram: false}` désactive BENEVITA (appel de l'écran « Résumé », utilisé pour le contrôle à l'écran) |
| `GET …/{personId}/products` | Panier chiffré, avec la liste `discounts` (`sante`, `benevita`, `collective`, `envtax`) |

Tous les prix d'une personne arrivent dans une seule réponse : chaque année de naissance a été interrogée, aucun prix n'est interpolé ni déduit d'une tranche. 2 727 requêtes pour le relevé principal (12 profils venaient d'un essai fait juste avant, 61 requêtes), plus 396 pour reprendre Fribourg (voir Anomalies).

## Prix relevé : brut, sans assurance de base

Le calculateur n'affiche par défaut qu'un prix net, et l'écran impose une assurance de base (« Au moins un produit doit être sélectionné » si on retire la base). L'API permet de lire le prix brut :

- **`monthly_chf` = prix brut** : `productgroup` lu avant toute proposition, donc sans assurance de base dans le panier et sans bonus BENEVITA. `notes` porte `gross_no_base`.
- **`calc_default_net=` (notes, Lausanne seulement)** : prix de la même ligne tel que le calculateur l'affiche à l'arrivée sur l'étape « Assurances », après `productproposal`. `calc_default_base=` nomme la base que le calculateur propose alors (`favorit.sante` de 26 à 70 ans, `favorit.multichoice` de 1 à 25 ans). Ce net inclut BENEVITA et, quand la base proposée est Favorit Sante, le « Tarif SANTE ».

Rabais constatés dans le net par défaut (rapport net / brut sur toutes les lignes de Lausanne) : Completa Top et Completa Forte −5 % ; Hospita Demi-Privée, Privée, Privée Monde et les deux Flex −10 % avec Favorit Multichoice, −25 % avec Favorit Sante ; Hospita Commune sans rabais avec Multichoice, 5 à 16 % avec Favorit Sante ; aucun rabais sur Praevita, Supplementa, Optima, Vivia, Denta, Infortuna, protection juridique et capitaux.

Essais faits pour comprendre ces états (femme née le 15.06.1987, 1003 Lausanne, accident inclus) :

| État du calculateur | Hospita Demi-Privée | Completa Top |
| --- | --- | --- |
| Aucune base, avant proposition (= `monthly_chf`) | 186.20 | 42.60 |
| Base Standard, Favorit Casa, Favorit Telmed ou Favorit Multichoice, BENEVITA désactivé | 186.20 | 42.60 |
| Base Standard, BENEVITA actif | 167.60 | 40.50 |
| Base Favorit Sante, BENEVITA désactivé | 158.30 | 42.60 |
| Base Favorit Sante, BENEVITA actif (= `calc_default_net`) | 139.60 | 40.50 |

Pour le panier « Favorit Sante + Hospita Demi-Privée », `products` détaille : `sante` 27.90 et `benevita` 18.70 déduits, soit 186.20 − 27.90 − 18.70 = 139.60. Le calculateur décrit le Tarif SANTE ainsi : « Les personnes assurées qui optent pour l'assurance de base Favorit Sante économisent 15 % sur les primes de l'assurance d'hospitalisation Hospita ». Le prix brut ne dépend donc pas de la présence d'une base SWICA ; seul Favorit Sante ouvre un rabais de combinaison, et BENEVITA est un programme de bonus que le calculateur applique d'office.

Aucun rabais famille n'entre en jeu : le prix brut d'une personne ajoutée à une session de plusieurs personnes est identique à celui de la même personne seule (contrôle automatique du script sur trois profils, et Fribourg relevé deux fois).

## Profil réellement appliqué

- Début d'assurance : 01.01.2027, valeur que le formulaire présélectionne ; `calculationYear` = 2027 dans les 160 réponses de proposition de Lausanne.
- Localités : 1003 Lausanne, 1204 Genève, 1700 Fribourg, 1950 Sion, 2000 Neuchâtel, 2800 Delémont. Le calculateur nomme Lausanne « Lausanne (Lausanne) » ; `locality` garde le nom sans la parenthèse.
- Naissance le 15.06 de chaque année de 1947 à 2026, femme et homme : 960 profils interrogés. `age` = 2027 − année de naissance, soit 1 à 80 (une personne née en 2026 a `age` 1, pas 0).
- Prénom « Test », pays Suisse, nouvelle souscription. `working8HoursPerWeek` n'est pas demandé à l'écran : l'application le déduit de l'âge (non avant 16 ans, oui jusqu'à 64 ans pour une femme et 65 ans pour un homme) ; le script applique la même règle. Ce champ ne fixe que la couverture accident présélectionnée.
- Accident : prix « Couverture accidents : Avec » quand l'option existe (`accident` = `true`). Le prix sans accident de la même ligne est dans `notes` (`no_accident=`), pas sur une ligne à part. Vivia et Denta n'existent qu'avec accident ; Praevita, Infortuna, protection juridique et capitaux n'ont pas l'option (`accident` vide).
- Franchise : `option` vide = sans franchise (CHF 0). Les autres franchises proposées sont relevées avec leur libellé (`Franchise annuelle CHF 1'000`, `2'000`, `5'000` pour Hospita ; `CHF 600` pour Completa Top et Forte). Attention : pour certains âges l'écran présélectionne la franchise CHF 1'000 sur Hospita ; le relevé ne suit pas cette présélection.
- Hospita Flex : la participation fait partie du produit (`franchise=CHF 300 / max. CHF 6'000` pour Flex Demi-Privée, `CHF 400 / max. CHF 8'000` pour Flex Privée, dans `notes`) ; `option` reste vide.
- Sessions : une personne par session à Lausanne (brut, puis proposition, puis net) ; huit personnes par session dans les cinq autres localités (brut seulement).

## Produits et limites d'âge constatées

Colonne « âges » : valeurs de `age` présentes dans le CSV, identiques dans les six localités. Aucun prix ne dépend du sexe. Seuls les produits Hospita dépendent de la localité.

| Produit affiché (`product_name`) | `product_key` | `variant` | `option` | Âges |
| --- | --- | --- | --- | --- |
| Completa Top | `swica-completa-top` | | vide ; `Franchise annuelle CHF 600` (19 à 70 ans) | 1–70 |
| Completa Forte | `swica-completa-forte` | | vide ; `Franchise annuelle CHF 600` (19 à 70 ans) | 1–70 |
| Praevita | `swica-praevita` | | | 1–70 |
| Supplementa | `swica-supplementa` | | | 1–60 |
| Optima | `swica-optima` | | | 1–70 |
| Vivia | `swica-vivia` | | | 19–60 |
| Denta | `swica-denta` | `Contribution CHF 500`, `1'000`, `1'500`, `2'000` | | 1–60 |
| Assurance de protection juridique santé | `swica-protection-juridique-sante` | | | 1–70 |
| Assurance de capital en cas d'accident | `swica-infortuna` | `Capital d’invalidité CHF 10'000` à `300'000` (8 sommes) ; `Capital en cas de décès CHF 10'000` à `300'000` (8 sommes) | | 1–65 ; décès au-delà de CHF 20'000 dès 13 ans |
| Infortuna Frais Guerison | `swica-infortuna` | | | 1–70 |
| Hospita Commune | `swica-hospita` | `PLUS Option sans` (1–50 et 61–70), `PLUS Option Demi-privée` et `PLUS Option privée` (1–40) ; vide de 51 à 60 ans | de 51 à 60 ans : vide, `Franchise annuelle CHF 1'000`, `2'000`, `5'000` | 1–70 |
| Hospita Demi-Privée | `swica-hospita` | | vide, `Franchise annuelle CHF 1'000`, `2'000`, `5'000` | 1–70 |
| Hospita Flex Demi-Privée | `swica-hospita` | | | 1–70 |
| Hospita Privée | `swica-hospita` | | vide, `Franchise annuelle CHF 1'000`, `2'000`, `5'000` | 1–70 |
| Hospita Flex Privée | `swica-hospita` | | | 1–70 |
| Hospita Privée Monde | `swica-hospita` | | vide, `Franchise annuelle CHF 1'000`, `2'000`, `5'000` | 1–70 |

- **71 à 80 ans (nés de 1947 à 1956) : aucune complémentaire.** Pour ces 120 profils le calculateur ne renvoie que l'assurance de base ; ils n'ont aucune ligne dans le CSV.
- Hospita, jusqu'à 50 ans : identifiants `prod.hospita.*.age` (tarif selon l'âge effectif). Dès 51 ans : `prod.hospita.*.contract_age` (tarif selon l'âge de conclusion), seul modèle proposé à un nouveau client, d'où le saut de prix entre 50 et 51 ans (Demi-Privée à Lausanne : 274.80 puis 421.10). Hospita Commune repasse à `prod.hospita.general.age` de 61 à 70 ans. L'identifiant est dans `notes` (`id=`).
- Tranches de prix constatées à Lausanne, ligne standard : Completa Top 1–18, 19–25, puis tranches de cinq ans jusqu'à 56–60 et 61–70 ; Hospita Demi-Privée 1–18, 19–25, 26–30, 31–40, 41–45, 46–50, 51–55, 56–60, 61–70 ; Praevita par tranches de dix ans dès 26 ans ; Supplementa 1–18, 19–25, 26–60.
- Écart régional, Hospita Demi-Privée, 40 ans : Genève 231.30, Lausanne 186.20, Delémont 128.60, Sion 125.70, Fribourg et Neuchâtel 105.90.
- Optima : l'API décline le produit selon une « franchise » qui reprend celle de l'assurance de base (6 valeurs pour un adulte, 4 pour un enfant). Elle ne change aucun prix dans tout le relevé : une seule ligne est écrite, avec `base_franchise_no_effect` dans `notes`.

## Produits du calculateur absents du relevé

- Assurance de base (LAMal) : Favorit Sante, Medpharm, Multichoice, Casa, Medica, Telmed, BestCare et Standard. Hors périmètre.
- « Assurances de capital en cas de maladie » (capital risque MDI, `swica-capital-risque-mdi`) : le libellé existe dans les traductions du calculateur, mais le produit n'est renvoyé pour aucun des 960 profils avec l'entrée `prm-allg`.
- Hospita Demi-Privée (liste), Hospita Privée (liste) et Hospita Comforta, variantes de `insurers/swica.json` : non proposées par le calculateur.
- Option « Enfant à naître » du formulaire : non utilisée.

## Vérifications à l'écran

Le script contrôle lui-même, en fin de relevé, trois profils à Lausanne (femme 1987, garçon 2015, homme 1962). Il remplit le formulaire, passe à l'étape « Assurances », désactive BENEVITA par l'appel de l'écran « Résumé », choisit la base Standard à l'écran, puis lit le prix de chaque carte des onglets « Assurance hospitalisation » et « Assurances complémentaires », d'abord avec la couverture accident présélectionnée, puis après avoir ajouté un produit et choisi « Couverture accidents : Avec ». Dans cet état l'écran affiche les prix bruts du relevé.

Résultat des deux exécutions : **88 prix affichés identiques aux prix relevés, 0 différent** (32 pour la femme de 1987, 30 pour le garçon de 2015, 26 pour l'homme de 1962). Exemples avec accident inclus : 1987/f Hospita Demi-Privée 186.20, Hospita Privée 250.80, Completa Top 42.60 ; 2015/m Hospita Demi-Privée 48.80, Completa Forte 50.50 ; 1962/m Hospita Demi-Privée 470.90 (franchise CHF 1'000 présélectionnée), Completa Top 49.00.

Le net par défaut a été contrôlé à la main pendant l'exploration, sans rien modifier : pour 1987/f l'écran affiche à l'arrivée Hospita Commune 4.40, Demi-Privée 126.90, Flex Demi-Privée 51.30, Privée 171.00 (accident « Sans ») puis, accident « Avec », 4.80, 139.60, 56.40 et 188.10, qui sont les `calc_default_net` du CSV.

## Anomalies

- Un `PUT …/vvg` a répondu 502 pendant le relevé de Fribourg, et le script d'alors poursuivait la session. Fribourg a été relevé une seconde fois en entier avec le script corrigé (une session dont le début d'assurance n'est pas confirmé est abandonnée) : les 160 réponses sont identiques à la première passe.
- L'écran « Résumé » n'a pas été atteint : le bouton « Non, suivant » du dialogue « Souhaitez-vous conclure des assurances complémentaires ? » reste sans effet dans cet environnement. Cause non recherchée ; la configuration de la page déclare Cloudflare Turnstile activé, aucun captcha n'a été affiché ni rencontré sur les appels de prix.
- Pendant l'exploration, un `PUT …/productgroup` avec un panier vide a renvoyé une page 500 « Wartungsarbeiten » : le backend n'accepte pas de vider le panier, le script ne le fait pas.
- Hôte refusé par le proxy : `www.googletagmanager.com` (traceur, sans effet).
- Chaque session ouverte crée côté SWICA un devis anonyme identifié par un PIN (prénom « Test », date de naissance, NPA) : environ 290 pour le relevé, sa reprise et les contrôles, une vingtaine pour l'exploration. Aucune coordonnée, aucun envoi d'offre, aucune étape de conclusion.
- `insurers/swica.json` indique que Hospita Plus se conclut jusqu'à 18 ans ; le calculateur propose les PLUS Options jusqu'à 40 ans.
- Libellés repris tels qu'affichés : « Infortuna Frais Guerison » (sans accent), apostrophe typographique dans « Capital d’invalidité ».

## Relancer

```bash
node collectors/swica.mjs                      # six localités, 1947 à 2026, environ 75 minutes
node collectors/swica.mjs --localities=1003 --years=1987,2015,1962
node collectors/swica.mjs --raw-dir=/chemin/du/cache   # reprend un relevé interrompu
```

`--net-localities` choisit les localités relevées une personne par session avec le net par défaut (défaut : la première). Codes de sortie en tête du script.
