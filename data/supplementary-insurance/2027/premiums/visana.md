# Visana : relevé des primes LCA 2027 dans le calculateur officiel

- Calculateur : https://dap.visana.ch/offer/ (« Calculateur des primes », étapes Personnes → Assurance de base → Assurance complémentaire → Vérifier l'offre)
- Relevé du 2026-11-18, `premiums/visana.csv` : **71 754 lignes**, script `premiums/collectors/visana.mjs`
- Année de prime confirmée par le calculateur : 2027 (`premium-years`), début d'assurance 01.01.2027 (proposé par défaut)

## Méthode : API rejouée

Le calculateur obtient tous les prix complémentaires d'une personne par un seul appel JSON. Le script ouvre la page avec Playwright (le site impose un contrôle de cookies avant toute réponse), puis rejoue cet appel avec `fetch` dans la page : une requête par profil, 1,2 s de pause, une seule session. 960 profils (80 années × 2 sexes × 6 localités), aucune erreur, aucun captcha, aucun blocage.

Points d'API (tous sous `https://dap.visana.ch/offer/api/public/`, en lecture) :

| Appel | Rôle |
| --- | --- |
| `GET address-suggestions?query=<NPA>&search_date=2027-01-01` | NPA → `bfs_number` (commune) |
| `GET sale-offer-begins`, `GET premium-years?sale_offer_begin=…` | dates de début proposées, année de prime |
| `GET basic-insurances?…` | modèles d'assurance de base de la localité (utilisé seulement pour savoir si le plan VIVA y existe) |
| `GET supplementary-insurances?sale_offer_begin=2027-01-01&date_of_birth=AAAA-06-15&gender_or_prenatal=FEMALE\|MALE&zip_code=…&bfs_number=…&has_basic_insurance=false&has_any_other_person_before_with_legal_protection=false&contract_duration=ONE_YEAR` | **tous les prix** du profil, toutes variantes et options |
| `POST offer-calculations` | prix du panier avec la liste des rabais appliqués (utilisé pour contrôle, voir plus bas ; ce n'est pas une demande d'offre) |

Aucune coordonnée, aucun questionnaire, aucune demande d'offre n'a été envoyée.

## Profil réellement appliqué

- Naissance le 15.06 de chaque année de 1947 à 2026, femme et homme. `age` = 2027 − année de naissance, soit 1 à 80 dans le CSV (la personne née en 2026 a 0 an révolu au 01.01.2027).
- Lausanne 1003 (commune OFS 5586), puis Genève 1204 (6621), Sion 1950 (6266), Neuchâtel 2000 (6458), Fribourg 1700 (2196), Delémont 2800 (6711). Quand un NPA couvre plusieurs communes, la commune du même nom a été retenue.
- **Sans assurance de base chez Visana** (`has_basic_insurance=false`). Effet mesuré de ce paramètre sur un profil (F 1987 Lausanne) : seule la Protection juridique change (16.50 sans base, 15.65 avec).
- **Contrat d'un an** (`contract_duration=ONE_YEAR`). Le calculateur présélectionne « 3 ans » : ses prix affichés par défaut incluent donc un rabais pluriannuel (environ −2 % sur 3 ans, −3 % sur 5 ans) sur Traitements ambulatoires, Médecine complémentaire, Hôpital, Basic, Capital Hôpital et Indemnités journalières d'hospitalisation. Le CSV contient le prix « 1 an », pour lequel `offer-calculations` renvoie une liste de rabais vide (contrôlé sur 5 profils). Une personne seule, donc ni rabais famille ni rabais 3e enfant ; pas de contrat-cadre.
- Participation aux coûts hospitalière : option par défaut du calculateur = CHF 0. Les autres participations (1'000 à 10'000) et la région « Monde entier » de la division privée sont aussi relevées, puisqu'elles viennent dans la même réponse.
- Accident : le calculateur n'offre un choix « Couverture accidents Avec/Sans » que pour le Capital Hôpital et les Indemnités journalières ; les deux valeurs sont relevées (`accident` = `true`/`false`, défaut = Avec). Pour tous les autres produits la colonne `accident` est vide : aucune option d'exclusion n'est proposée.

## Lecture du CSV

- `product_name` = titre de la carte du produit dans la liste ; `variant` = degré, classe ou division tel qu'affiché dans la fenêtre du produit.
- `option` vide = option présélectionnée par le calculateur ; dans ce cas `notes` la décrit (« option par défaut du calculateur : … »). Les défauts ont été lus à l'écran sur un profil adulte (F 1987) : participation CHF 0, région Europe, Capital Hôpital CHF 4'000 avec accident, capital-décès accident CHF 10'000, capital-invalidité accident CHF 100'000, capital maladie 10'000 / 100'000, indemnités journalières avec accident / 30 jours / CHF 50, indemnités d'hospitalisation 30 jours / délai 3 jours / CHF 200.
- `product_key` : clé de `insurers/visana.json`. Laissée vide pour « Protection juridique » : le calculateur vend une protection privée + circulation + santé, la fiche ne décrit que la « Protection juridique de la santé ».
- Produits à capital ou à indemnité (Capital Hôpital, capitaux accident, capital maladie, indemnités journalières, indemnités d'hospitalisation) : écrits pour **Lausanne seulement**. Ils ont bien été relevés dans les six localités et le script n'écrit une ligne ailleurs que si le prix diffère de Lausanne : il n'y en a aucune (0 écart sur les 960 profils). Les autres produits sont écrits pour chaque localité.
- **Indemnités journalières** : la réponse contient 798 combinaisons (19 montants × 21 délais d'attente × accident avec/sans). Le CSV en garde 78 par profil : tous les délais au montant par défaut (CHF 50) et tous les montants au délai par défaut (30 jours), avec et sans accident. `node visana.mjs --daily-cash=all` écrit les 798.

## Produits et variantes couverts

| Produit (carte) | Variantes | Années de naissance avec prix |
| --- | --- | --- |
| Traitements ambulatoires | I, II, III | 1957–2026 |
| Médecine complémentaire | I, II, III | 1957–2026 |
| Hôpital | Hôpital général ; Flex (4/8) ; Flex (2/4) ; Flex Plus ; division mi-privée (5 participations) ; privé (5 participations × Europe / Monde entier) | 1957–2026 |
| Assurance complémentaire combinée Basic | Division commune ; Basic Flex 4/8 ; Basic Flex 2/4 ; mi-privée (5 participations) ; privée (5 participations × 2 régions) | 1957–2026 |
| Traitement dentaires | Classes 3 à 10 | 1957–2026 |
| Indemnités journalières d'hospitalisation | 60 combinaisons (durée 30/60/90 j × délai 1/3 j × CHF 50 à 500) | 1957–2026 |
| Assurance sous forme de capital Hôpital | 13 capitaux (CHF 500 à 15'000) × accident avec/sans | 1957–2008 |
| Capital-décès en cas d'accident | 30 capitaux (CHF 10'000 à 300'000) | 1962–2008 |
| Capital-invalidité en cas d'accident | 30 capitaux | 1962–2026 |
| Assurance d'un capital en cas de maladie | 5 modèles (2 seulement pour 2009–2026) | 1972–2026 |
| Indemnités journalières | 78 combinaisons retenues (voir ci-dessus) | 1962–2011 |
| Assistance d'urgence | prix unique | 1962–2008 |
| Protection juridique | prix unique | 1947–2026 |
| Complément Frais de guérison en cas d'accident | prix unique | 1947–2026 |
| Ambulatoire VIVA, Médecine complémentaire VIVA, Hôpital VIVA | mêmes variantes (sans Flex Plus) | 1957–2026, Neuchâtel et Delémont seulement |

Limites identiques pour les deux sexes et dans les six localités. Nés de 1947 à 1956 (71 ans et plus) : seuls la Protection juridique et le Complément accident sont proposés. Options hospitalières restreintes chez les jeunes : participations CHF 2'000 / 5'000 / 10'000 seulement pour 1957–2001 (CHF 0 et 1'000 pour tous) ; région « Monde entier » absente pour la naissance 2026.

Régions tarifaires constatées : seuls Hôpital et Basic (et Hôpital VIVA) dépendent du domicile. Lausanne, Genève, Neuchâtel et Fribourg ont exactement les mêmes prix ; Sion est moins cher sur toutes les lignes (rapport 0,68 à 0,875 selon la variante) ; Delémont ne diffère de Lausanne que pour Hôpital Flex Plus. Les prix dépendent du sexe et changent d'une année de naissance à l'autre : chaque année a été relevée, rien n'est dérivé d'une tranche.

## Produits du calculateur absents du relevé

- **Formule santé S, M, L** (affichée pour 17 à 27 ans) : ce n'est pas un tarif propre. Le calculateur additionne trois produits et les met dans le panier séparément, sans rabais : S = Traitements ambulatoires I + Médecine complémentaire I + Hôpital général ; M = degrés II + Hôpital Flex (2/4) ; L = degrés III + un Hôpital Flex. Constaté pour F 2003 Lausanne au tarif 3 ans : S 12.90 = 7.05 + 4.70 + 1.15 ; M ajouté au panier = trois lignes distinctes, total 83.05. Les composants sont dans le CSV. **Réserve sur L** : la fenêtre annonce « Flex 4/8 », mais le prix affiché (194.60) est la somme des degrés III et de Hôpital Flex (2/4) ; avec Flex (4/8) la somme serait 175.50. L n'a pas été mis au panier, sa composition hospitalière reste donc à confirmer.
- **Confort ambulatoire** (`outpatient_comfort`) : libellé présent dans le calculateur, mais prix `null` pour les 960 profils ; jamais proposé.
- **Enfant à naître** : troisième choix du formulaire, hors du profil demandé.
- **Assurance de base** (étape 2) : hors périmètre.
- **Variantes VIVA à Lausanne, Genève, Sion, Fribourg** : l'API renvoie leurs prix partout, mais le plan de base VIVA n'existe que dans deux des six localités (voir anomalies) ; non écrites ailleurs. `--viva=all` les ajoute.

## Vérifications à l'écran

`node visana.mjs --verify` parcourt l'interface (sexe, date, NPA, « Voir les prix », sans assurance de base), met un produit au panier, choisit « Contrat pluriannuel : 1 an » à l'étape 4, revient à l'étape 3 et lit les prix affichés dans les fenêtres des produits. Résultat du 2026-11-18 : **97 prix affichés sur 97 identiques au relevé.**

| Profil | Prix comparés |
| --- | --- |
| F 1987, 1003 Lausanne | 25 / 25 |
| H 1962, 1003 Lausanne | 25 / 25 |
| F 2015, 1003 Lausanne | 22 / 22 |
| H 1990, 1950 Sion | 25 / 25 |

Prix lus : les trois degrés ambulatoires et de médecine complémentaire, Hôpital et Basic (division commune, « à partir de » des groupes flexible / mi-privée / privée, puis mi-privée et privée avec l'option par défaut), dentaire classe 3, Protection juridique, Assistance d'urgence, Complément accident, Capital Hôpital et Indemnités journalières par défaut, et une ligne du récapitulatif en contrat d'un an. Exemple F 1987 Lausanne : Traitements ambulatoires II 30.00, Médecine complémentaire II 42.50, Hôpital division mi-privée 167.35, Basic division commune 87.40.

Non vérifié à l'écran : les options autres que le défaut (participations, Monde entier, autres capitaux et délais) et les variantes VIVA.

## Anomalies et réserves

- **VIVA (9 552 − 6 646 = 2 906 lignes par localité concernée, 5 812 au total)** : le plan de base « Soins intégrés / VIVA » est proposé à Neuchâtel et à Delémont ; les complémentaires VIVA (environ 5 % moins chères en ambulatoire et en médecine complémentaire, tarif hospitalier distinct) exigent ce plan chez Visana, donc sortent du profil « sans assurance de base ». Elles sont écrites pour ces deux localités avec une note explicite dans chaque ligne. Leur prix vient de l'API et n'a pas pu être lu à l'écran : le calculateur ne les affiche qu'après le choix du plan VIVA, qui demande de choisir un médecin (étape non franchie). Leurs noms de variantes viennent de la table de traduction du calculateur ; « Hôpital VIVA » comme nom de produit est un libellé du relevé. Sur un profil, le paramètre `has_basic_insurance` ne change pas ces prix.
- Les libellés reprennent l'orthographe du calculateur (« Traitement dentaires », « Hôpital Flex (2/4) » dans la fenêtre contre « Hôpital Flex 2/4 » dans le panier).
- Le texte du récapitulatif mentionne « y compris remboursement de la taxe environnementale et de la contribution à la promotion de la santé » : mention générale du calculateur, sans effet visible sur les prix complémentaires.
- Indemnités journalières : sur le profil F 1987, le prix est proportionnel au montant journalier (à l'arrondi de 5 centimes près) pour chaque délai d'attente ; simple constat, aucune ligne n'en est déduite.
- Le CSV final a été reconstruit à partir des réponses brutes enregistrées pendant le relevé (même jour, 13 h 45 – 14 h 21 UTC), sans nouvel appel de prix.

## Hôtes

Utilisé : `dap.visana.ch` uniquement. Bloqués par le proxy (403), sans importance pour les prix : `consent.cookiefirst.com` (bannière de cookies) et `www.googletagmanager.com` (traceur).
