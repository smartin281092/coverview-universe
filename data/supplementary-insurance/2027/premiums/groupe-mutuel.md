# Groupe Mutuel — primes LCA 2027 relevées dans le calculateur officiel

- Calculateur : <https://www.groupemutuel.ch/poelGM/> (« Calculez votre prime 2027 », version 5.126.2 de l'application).
- Relevé : 18 novembre 2026, `source_type = official_calculator`.
- Fichiers : `groupe-mutuel.csv` (37 368 lignes : 6 228 par localité, 6 localités, 960 profils), `collectors/groupe-mutuel.mjs` (script relançable).
- Assureurs porteurs indiqués par le calculateur : Groupe Mutuel Assurances GMA SA pour tous les produits, sauf PrimaCapital (Groupe Mutuel Vie GMV SA).

## Méthode

API rejouée. Le navigateur (Playwright, Chromium, `locale: 'fr-CH'`) ouvre le calculateur une fois ; les appels JSON de l'application sont ensuite rejoués depuis la page avec `fetch` (mêmes cookies, même en-tête `X-CSRF-TOKEN` à usage unique que l'application). Une seule session, 1,1 s de pause après chaque réponse (environ 2,5 s entre deux requêtes), arrêt prévu au premier blocage ou après 3 erreurs consécutives. Aucun captcha ni blocage. Un arrêt sur erreurs répétées a eu lieu et venait du script, pas du calculateur : voir « Anomalies ».

Le service est sans état : chaque appel renvoie l'état complet du formulaire, qui est reposté à l'étape suivante.

| Étape | Appel (`https://offres-sante.groupemutuel.ch/poel-bff`) | Rôle |
| --- | --- | --- |
| Localité | `GET /localities?search=<NPA>` | Objet localité (commune, canton) à placer dans le profil |
| « Mes besoins » | `POST /poel-forms/steps/submit?to=ETAPE2` | Besoins LCA proposés au profil et prix « Dès CHF » (`suggestions.etape2.profiles[0].lcaGammes`) |
| « Ma sélection » | `POST /poel-forms/steps/submit?to=ETAPE3` | Tous les tarifs LCA du profil, par variante (`suggestions.etape3.profiles[0].lca[]` : `codeProduit`, `codeVariante`, `codeRisque`, `codeCritereSupplementaire1/2`, `franchise`, `montant`) |
| Indemnité BH | `POST /poel-forms/steps/step3/recalculate?action=UPDATE&eventTargetName=forms.etape3.produits[0].lca.selection[i].dailyAmount&value=100` | Prime de l'indemnité journalière BH pour le montant journalier saisi |
| Libellés | `GET https://www.groupemutuel.ch/poelGM/locales/products/FR.json` | Noms des produits, variantes et critères tels qu'affichés |

Autres points observés, non utilisés : `POST /state?canal=` (état initial), `POST /poel-forms/steps/preload-pricing` et `/poel-forms/steps/validate` (appelés par l'interface avant `submit`, sans effet sur les prix), `…/feature-flags/api/frontend` (drapeaux Unleash).

Par profil, le script appelle ETAPE2, coche **tous** les besoins LCA proposés, appelle ETAPE3, puis `recalculate` pour BH : 3 requêtes par profil. L'interface, elle, empêche de cocher ensemble des produits qui se recouvrent (par exemple Global smart et une hospitalisation) ; l'API accepte la sélection complète et renvoie les mêmes montants que produit par produit (contrôlé sur 3 profils et 5 produits : 53 montants identiques).

## Profil appliqué

- Entrée en vigueur : 01.01.2027 (date proposée par défaut pour chaque produit, constatée dans toutes les réponses).
- Naissance : 15.06 de chaque année de 1947 à 2026, femme et homme. Colonne `age` = 2027 − année de naissance, soit 1 à 80.
- Localités : 1003 Lausanne (VD), 1204 Genève (GE), 1950 Sion (VS), 2000 Neuchâtel (NE), 1700 Fribourg (FR), 2800 Delémont (JU). Quand un NPA couvre plusieurs communes, le calculateur propose plusieurs entrées (« 1950 Sion », « 1950 Sion (Savièse) », « 1950 Sion (Grimisuat) ») ; le relevé prend toujours l'entrée de la commune du même nom : Sion (commune 6266), Neuchâtel (6458, et non Milvignes), Fribourg (2196, et non Tafers ou Düdingen), Delémont (6711, et non Courrendlin ou Develier). Lausanne (5586) et Genève (6621) n'ont qu'une entrée.
- Une seule personne, prénom « Test », nouvelle souscription, **sans assurance de base** (aucun modèle LAMal sélectionné ; le calculateur le permet).
- Accident : toutes les complémentaires de soins et d'hospitalisation ne sont proposées qu'en « maladie et accident » (`accident = true`). PrimaCapital existe avec ou sans accident : les deux sont relevés (`accident = true` par défaut, `accident = false` avec `option = Couverture Maladie (sans accident)`). ActiVita, ProVista et Acrobat sont des assurances accident seules (`accident = true`). Legis et CyberProtect n'ont pas de notion de risque (`accident` vide).
- Franchise : le calculateur ne propose aucune option de franchise pour les complémentaires ; tous les tarifs renvoyés sont sans franchise (`franchise = 0`), y compris l'hospitalisation, Hôpital senior, Optimum et Global smart.
- Prime brute mensuelle d'une personne seule, sans rabais famille. Exceptions notées ligne par ligne dans `notes` :
  - **H-Bonus** : seul l'« Echelon de primes 0 (80% de la prime) » est proposé, c'est-à-dire une prime qui inclut déjà le bonus de 20 % accordé dès la conclusion. Aucun prix à 100 % n'est affiché.
  - **Mundo** : deux tarifs. Ligne sans option = « Sans rabais », affiché quand Mundo est pris seul ou avec Start, Dentaire plus, H-Capital, BH, PrimaCapital, ActiVita ou Legis. `option = Avec rabais` = tarif affiché quand Mundo est combiné à Global smart, à l'Assurance complémentaire d'hospitalisation ou à Optimum (chacun testé seul avec Mundo) ; à l'écran, il apparaît aussi dans des sélections contenant H-Bonus et Premium, ou Hôpital senior. La règle exacte n'est pas publiée par le calculateur. L'étape « Mes besoins » annonce « Dès CHF » avec le tarif réduit.

## Lecture du CSV

- `insurer` = `groupe-mutuel`. `product_key` : clé de `../insurers/groupe-mutuel.json`, rattachée par le code produit du calculateur (table `PRODUCT_KEYS` du script) pour 16 produits. Legis (Legisstrada, Legispriva, Legisduo) et CyberProtect n'ont pas d'entrée dans ce fichier : `product_key` vide.
- `product_name` et `variant` : libellés du calculateur, balises HTML retirées (« Legis<sup>strada</sup> » devient « Legisstrada »).
- `option` vide = ce que le calculateur affiche à une personne seule. Les lignes avec option sont des tarifs renvoyés par le calculateur pour le même profil :
  - `Couverture Maladie (sans accident)` (PrimaCapital) et `Avec rabais` (Mundo) : affichables à l'écran, vérifiés.
  - `Membre famille` (Legis adulte), `Enfant gratuit` (Legis enfant, 0.00), `avec Rabais familial` (Optimum enfant), `avec rabais familial` (Premium enfant) : renvoyés par l'API mais **non affichés** pour une personne seule (marqués `api_only_not_displayed_single_person`). Ce sont des tarifs famille ; à exclure d'un comparatif individuel. À noter : pour un enfant, le prix « Dès CHF » de l'étape « Mes besoins » est ce tarif famille (par ex. Optimum 15.50), alors que l'étape « Ma sélection » affiche le tarif sans rabais (19.20).
- `notes` : `calculator_preselected` = variante présélectionnée (« Recommandé ») ; `codes=` = `codeProduit|codeVariante|codeFranchise|codeRisque|critère1|critère2` de l'API, utile pour relier les lignes entre elles.
- CyberProtect : la couverture « Personne seule » ou « Famille » est une variante de contrat (choisie dans une boîte de dialogue), rangée dans `variant`.
- Indemnité journalière BH : prime « sur mesure » pour un montant journalier libre de 1 à 200 CHF. Relevée pour **100 CHF/jour** uniquement. À l'écran, pour F 1987 à Lausanne : 1 CHF/jour → 0.10, 37 → 2.95, 50 → 4.00, 100 → 8.00, 200 → 16.00 (proportionnel, arrondi à 5 centimes) ; les autres montants ne sont pas écrits dans le CSV.

## Produits et limites d'âge constatées

Âge = 2027 − année de naissance. Limites identiques pour les deux sexes et dans les six localités (mêmes produits, mêmes variantes, mêmes âges partout).

| Produit (code) | Variantes relevées | Âges proposés |
| --- | --- | --- |
| Global smart (GOGA03) | Niveau 1, Niveau 2 | 1–80 |
| | Niveau 3 - Confort mi-privée, Niveau 3 - Confort privée | 1–70 (nés dès 1957) |
| Assurance complémentaire d'hospitalisation (HCGA02) | Niveaux 1 à 4 | 1–54 (nés dès 1973) |
| Hôpital senior (HSGA01) | Division mi-privée, Division privée | 55–80 (nés jusqu'en 1972) |
| H-Bonus (HBGA01) | une seule (échelon 0) | 1–59 (nés dès 1968) |
| H-Capital (KHGA02) | Capital 500, 1'500, 2'000, 2'500, 3'000, 3'500 | 1–80 |
| Indemnité journalière BH (BHGA01) | 100 CHF/jour | 1–59 |
| Start (STGA01) | une seule | 1–80 |
| Optimum (SOGA01) | une seule | 1–80 (tarif famille : 1–18) |
| Premium (SDGA02) | une seule | 1–59 (tarif famille : 1–18) |
| Assurance Dentaire plus (DPGA03) | Niveaux 1 à 3 | 1–59 |
| Mundo (MUGA01) | sans rabais / avec rabais | 1–80 |
| ActiVita (AJGA01) | une seule | 19–59 (nés 1968–2008) |
| ProVista (IDGA02) | 30'000/10'000, 100'000/50'000, 250'000/150'000 | 19–59 |
| Acrobat (ABGA02) | Acrobatlight, Acrobatstandard | 1–18 (nés dès 2009) |
| PrimaCapital (ICGM03) | Capital 10'000, 25'000, 50'000 | 1–54 |
| | Capital 75'000, 100'000 | 18–54 (nés 1973–2009) |
| Legis (LJGA15) | Legisstrada, Legispriva, Legisduo | 1–80 (tarif « Enfant seul » jusqu'à 18 ans, « Personne seule » dès 19 ans) |
| Legissana+ (LSGA01) | une seule | 1–80 |
| CyberProtect (CYGA01) | Personne seule, Famille | 19–80 |

Le calculateur classe les profils en `ENFANT` (nés dès 2011), `ADO` (2009–2010) et `MAJEUR` (jusqu'en 2008).

## Différences entre localités

Seuls quatre produits changent de prix d'une localité à l'autre ; tous les autres sont identiques dans les six localités, à tous les âges.

| Produit | Groupes de prix constatés | Exemple F 40 ans (Lausanne / Genève / Sion / Neuchâtel / Fribourg / Delémont) |
| --- | --- | --- |
| Assurance complémentaire d'hospitalisation, niveaux 2 à 4 (niveau 1 identique partout) | Lausanne ; Genève ; Sion = Neuchâtel = Fribourg = Delémont | Niveau 2 : 158.60 / 218.10 / 97.60 / 97.60 / 97.60 / 97.60 |
| Global smart, niveaux 3 (niveaux 1 et 2 identiques partout) | Lausanne ; Genève ; Sion = Neuchâtel = Fribourg = Delémont | Niveau 3 mi-privée : 290.00 / 352.40 / 206.80 / 206.80 / 206.80 / 206.80 |
| H-Bonus | Lausanne = Genève ; Sion ; Neuchâtel ; Fribourg = Delémont (Neuchâtel rejoint Fribourg et Delémont pour 18 des 118 profils) | 99.50 / 99.50 / 54.10 / 64.70 / 55.20 / 55.20 |
| Premium | Lausanne = Genève = Neuchâtel = Fribourg ; Sion ; Delémont | 151.30 / 151.30 / 134.80 / 151.30 / 151.30 / 121.30 |

## Produits du calculateur absents du relevé

- Assurance obligatoire des soins (PrimaFlex, SanaTel, OptiMed, PrimaCare, Standard) : hors périmètre LCA.
- Indemnité journalière BH pour d'autres montants que 100 CHF/jour (voir plus haut).
- Profil « Enfant à naître » (case du formulaire) : non relevé ; le relevé porte sur des personnes nées.
- Variantes présentes dans le fichier de libellés de l'application mais jamais proposées par le calculateur pour ces profils, donc sans prix : autres capitaux ProVista (une quarantaine de combinaisons) et H-Capital (300, 600, 900, 1'000, 1'200), Hôpital senior en division commune (1 ou 2 lits), H-Bonus à l'« Echelon de prime 1 (100% de la prime) ». Le texte de présentation de Global smart parle de « trois franchises », mais aucune option de franchise n'est proposée.
- Produits présents dans les libellés mais jamais proposés : ProVista Light, Sekunda, SafeCapital, Assurance Dentaire plus-Kids, Global, Global Confort, Global Famille, Global mi-privée, Global privée, Global flex, Global Solution, SanaVista, KidsProtect, Alterna, Vitalis, Assurance pour les soins complémentaires (avec ou sans bonus), Capital invalidité & décès, Legis juridique 8 ans. Vraisemblablement d'anciens produits ou des produits d'autres canaux ; non vérifié.
- Tarifs famille des adultes (Global smart « Rabais familial 25% », Optimum/Premium avec rabais) : non renvoyés pour une personne seule ; il faudrait saisir plusieurs personnes.
- Produits de `../insurers/groupe-mutuel.json` que le calculateur ne propose à aucun des 960 profils, donc sans prime : ProVista light, KidsProtect, Sekunda, indemnité journalière individuelle (PI), packages KidSafe et StarterSafe (le calculateur renvoie une liste de packs vide).

## Vérifications à l'écran

Neuf profils parcourus dans l'interface réelle après le relevé, dont un dans chacune des cinq autres localités : **202 valeurs contrôlées, 202 identiques au CSV**.

Quatre profils à Lausanne (formulaire, « Choisir mon assurance », cases des besoins, « Continuer vers l'offre »), prix lus dans la page « Ma sélection » et comparés au CSV : **102 valeurs contrôlées, 102 identiques** (54 prix de variantes, 2 primes BH à 100 CHF/jour, 46 prix « Dès CHF » de l'étape « Mes besoins »).

| Profil | Produits contrôlés à l'écran |
| --- | --- |
| H 15.06.1962 | Global smart (4 niveaux : 14.80 / 29.90 / 347.60 / 364.30), Legis (3 variantes), CyberProtect Famille (9.70) |
| F 15.06.2015 | Hospitalisation (4 niveaux), H-Capital (6), Optimum (19.20), Dentaire plus (3), Acrobat (2), Mundo avec rabais (1.50), PrimaCapital maladie+accident et maladie seule (3 + 3), BH 100 CHF/jour (8.00) |
| F 15.06.1950 | Hôpital senior (308.60 / 416.10), Start (24.90), CyberProtect Personne seule (7.10), Mundo avec rabais (3.50), Legissana+ (2.50) |
| H 15.06.1998 | H-Bonus (26.90), Premium (76.30), ActiVita (7.00), ProVista (3), PrimaCapital (5 + 5), BH 100 CHF/jour (8.00), Mundo avec rabais (3.50) |

Cinq profils dans les autres localités, en choisissant à l'écran l'entrée de la commune du même nom : **100 valeurs contrôlées, 100 identiques** (32 prix de variantes, 1 prime BH, 67 prix « Dès CHF »).

| Profil | Produits contrôlés à l'écran |
| --- | --- |
| Genève, H 15.06.1980 | H-Bonus (59.20), Premium (92.40), Mundo avec rabais (3.50) |
| Delémont, F 15.06.1975 | Global smart (17.20 / 39.90 / 174.00 / 184.10), Legis (3 variantes) |
| Neuchâtel, F 15.06.2010 | Hospitalisation (2.00 / 21.70 / 24.20 / 26.60), Optimum (26.10), BH 100 CHF/jour (8.00) |
| Sion, H 15.06.1955 | Hôpital senior (266.10 / 358.70), H-Capital (6 capitaux), Start (20.20) |
| Fribourg, F 15.06.1995 | Hospitalisation (3.50 / 124.20 / 150.30 / 165.30), Dentaire plus (28.00 / 35.00 / 42.00), Premium (142.50) |

S'y ajoutent les parcours d'observation initiaux (F 15.06.1987, Lausanne) : mêmes montants à l'écran et dans l'API, dont Mundo seul à 5.00 (« Sans rabais »).

## Anomalies et remarques

- **Arrêt sur erreurs répétées, cause corrigée.** La première version du script prenait la première entrée renvoyée pour un NPA. Pour 2000 Neuchâtel, c'était l'entrée de la commune de Milvignes : les tarifs étaient renvoyés, mais le recalcul de BH répondait HTTP 500 (« Internal Server Error ») ; le script s'est arrêté après 3 profils en erreur, puis 15 autres appels de diagnostic ont échoué de la même façon avant que la cause soit trouvée. Dans l'interface, « 2000 Neuchâtel » fonctionne normalement. Le script exige désormais la commune du même nom, et un échec BH ne fait plus perdre les autres tarifs du profil. Aucune ligne du CSV ne vient de l'entrée Milvignes.
- **Sion relevé deux fois.** Pour la même raison, Sion avait d'abord été relevé sur l'entrée « Sion (Savièse) ». Ces 160 profils ont été écartés et Sion relevé à nouveau sur la commune de Sion. Les deux relevés sont identiques sur les 6 346 montants : à Sion, la commune choisie pour un même NPA ne change pas le prix. Non vérifié pour Neuchâtel, Fribourg et Delémont.
- La colonne `age` vaut 1 pour les enfants nés en 2026 (formule du brief), alors qu'ils ont 0 an au 01.01.2027.
- Dans les six localités, dix produits ne dépendent pas du sexe (Dentaire plus, Hôpital senior, ActiVita, ProVista, Acrobat, BH, Mundo, Legis, Legissana+, CyberProtect) ; les autres oui. Chaque année et chaque sexe ont été demandés : aucune ligne `derived_from_band`.
- Optimum à Lausanne : prime femme constante à 71.70 de 31 à 80 ans, prime homme plus basse (45.10 à 31 ans, 55.10 dès 76 ans) ; ce sont les montants renvoyés et affichés (« Dès CHF 71.70 » vérifié à l'écran pour F 1950, 38.60 pour H 1998).
- BH à 100 CHF/jour : 8.00 jusqu'à 40 ans, 9.00 de 41 à 50 ans, 10.00 de 51 à 59 ans, dans les six localités.
- Hôtes tiers refusés par le proxy pendant le chargement de la page, sans effet sur le calcul : `cdn.cookielaw.org` (bannière de cookies OneTrust), `www.googletagmanager.com` et `stapecdn.com` (balises de mesure), `zn4i4viinb0qrmt4b-groupemutuelsondage.siteintercept.qualtrics.com` (enquête Qualtrics).
- `page.request` de Playwright ne passe pas par le proxy de la session (`ENOTFOUND`) ; tous les appels sont donc faits avec `fetch` dans la page.

## Relancer

```bash
NODE_PATH=<node_modules contenant playwright> node collectors/groupe-mutuel.mjs \
  --raw <fichier.jsonl> [--localities 1003,1204,1950,2000,1700,2800] [--years 1947-2026] [--bh 100]
```

`--raw` conserve les réponses brutes (JSONL) et permet de reprendre un relevé interrompu ; le CSV est réécrit à partir de ce fichier. Compter environ 20 minutes par localité (480 requêtes, soit 2 880 pour les six). Le fichier brut de ce relevé n'est pas dans le dépôt.
