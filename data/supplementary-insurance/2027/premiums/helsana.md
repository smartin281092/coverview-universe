# Helsana — relevé des primes LCA 2027 dans le calculateur officiel

**État au 2026-11-18 : relevé complet.** `helsana.csv` contient 35 016 lignes : 18 produits LCA, 61 combinaisons produit / variante / option, années de naissance 1947 à 2026, femmes et hommes, six localités. Tous les prix sont ceux que le calculateur affiche pour un début d'assurance au 01.01.2027. Aucun prix n'est estimé ni interpolé.

## Calculateur

- URL : https://portal.helsana.ch/offer/#/personal-details/persons?locale=fr (application « easySales » R26.3.0.2-8.0.870, modèle tarifaire PROMOS 17.1.3).
- Parcours : personne (prénom, date de naissance, sexe) → localité (NPA, commune si le NPA en couvre plusieurs, début d'assurance, durée de contrat, contrat collectif facultatif) → besoins → choix des produits, avec une page de comparaison par catégorie.
- Les prix ne viennent pas d'une API. Le navigateur charge un modèle tarifaire (`/offer/model/Offer_Helsana.prt`) et douze fichiers `/offer/stammdaten/*.csv`, puis calcule tout en local avec le moteur PROMOS (WebAssembly, objet `window.PMSRT`).
- Les fichiers `stammdaten` ne contiennent pas le barème : ce sont des tables de référence (NPA et régions de prime, réseaux de médecins, contrats collectifs). Le barème est dans le fichier binaire `.prt` et ne se lit qu'à travers le moteur.

## Année tarifaire : les prix sont bien ceux de 2027

La page d'entrée https://www.helsana.ch/fr/prives/assurances/calculateur-primes.html s'intitule encore « Calculateur de primes 2026 - Helsana » et parle des primes « pour 2026 » (lue le 2026-11-18). Le calculateur, lui, est déjà en 2027 :

- le début d'assurance proposé par défaut est le 01.01.2027 (dates acceptées : 01.05.2026 à 01.08.2028) ; le relevé le laisse tel quel et le script s'arrête si le moteur indique autre chose ;
- le moteur donne les tarifs comme approuvés jusqu'au 31.12.2027 (`F_PRM_TarifGenehmigtBis`), et l'application n'affiche l'avertissement « sous réserve de l'autorisation par l'autorité de surveillance » que pour un début postérieur à cette date ;
- contre-épreuve à l'écran et dans le moteur, même personne (femme née le 15.06.1990, Lausanne, même tranche 36-40) avec un début au 01.12.2026 : SANA 37.00 au lieu de 38.65, HOSPITAL FLEX 2 avec module 67.30 au lieu de 59.45, CURA 22.35 au lieu de 20.75, assurance de base BASIS 525.65 au lieu de 551.15. Le modèle distingue donc les tarifs 2026 et 2027. TOP, COMPLETA, Demi-Privée, Privée, DENTAplus Bronze et PRIMEO sont identiques aux deux dates.

## Méthode

1. Playwright (`chromium.launch()` sans option, `locale: 'fr-CH'`) parcourt une fois le formulaire : prénom « Test », née le 15.06.1990, femme, 1003 Lausanne, début 01.01.2027 et durée 1 an laissés tels que proposés, pas de contrat collectif.
2. Sur la page suivante, le script interroge le moteur du navigateur avec les expressions que l'interface emploie elle-même (relevées en espionnant `PMSRT.compute` pendant un parcours manuel de toutes les catégories), en changeant pour chaque profil la date de naissance, le sexe et la localité de la personne déjà saisie.
3. Aucune requête de prix ne part vers Helsana : la règle d'une seconde entre deux requêtes n'a pas d'objet ici. Le relevé complet tient dans une seule session du calculateur et dure environ deux minutes.
4. Deux exécutions complètes ont donné exactement les mêmes 35 016 prix.

Expressions utiles (personne d'indice 0) :

| Rôle | Expression PROMOS |
| --- | --- |
| Personne | `A_PER_GebDat[0]` (JJ.MM.AAAA), `A_PER_Geschlecht[0]` (`w` / `m`) |
| Localité | `A_GLB_PLZ`, `A_GLB_PLZ_Zusatz`, `A_GLB_Gemeindenummer` (numéro OFS de la commune) |
| Début, durée | `A_GLB_Vertragsbeginn`, `A_PER_VertragsbeginnVVG[0]`, `A_GLB_Vertragsdauer` |
| Produits proposés | `S_VPF_AlleProdukteImMix(0)`, `F_PRM_IstProduktAuswaehlbar(0;"<produit>")`, `F_PRM_IstGeschlossenesProdukt("<produit>")` |
| Paramètres d'un produit | `S_VPF_Produkteparameter`, `S_VPF_Attribute`, `S_VPF_ParameterHasChoice`, puis `<attribut>.default`, `<attribut>.vVisible` et `PMSRT.choices` |
| Tranche d'âge tarifaire | `F_PRM_AltersgruppeInternalName(0;"<produit>")` |
| **Prix affiché** | `P_VPF_ExtrahiereNettoPraemie(0;"<produit>";"<param>⇥<valeur>⇥…")` |
| Prix brut, rabais, suppléments | `P_VPF_ExtrahiereBruttoPraemie(…)`, `P_VPF_ExtrahiereRabattprodukt("LIST"; …)`, `P_VPF_Praemienzuschlagprodukt("LIST";0;"<produit>")` |

API du serveur observées, sans rapport avec les prix : `GET /offer/api/ping`, `GET /offer/api/maintenance-service`, `POST /offer/api/v1/session` puis `PUT /offer/api/v1/session/<id>` (sauvegarde du brouillon à chaque étape), `POST /offer/api/v1/log/*` (journal de l'application).

## Profil réellement appliqué

- Début d'assurance 01.01.2027, durée de contrat 1 an (« aucun rabais »), une seule personne, pas de contrat collectif, nouveau client, aucune assurance de base choisie.
- Dates de naissance : 15.06 de chaque année de 1947 à 2026, soit `age` = 1 à 80 (2027 − année de naissance ; l'âge 0 n'existe pas avec ces années).
- Localités : 1003 Lausanne (commune OFS 5586), 1204 Genève (6621), 1950 Sion (6266), 2000 Neuchâtel (6458), 1700 Fribourg (2196), 2800 Delémont (6711). Les NPA 1950, 2000, 1700 et 2800 couvrent plusieurs communes ; le relevé prend la commune du même nom.
- Couverture accident incluse partout où l'option existe (TOP, SANA, COMPLETA, PRIMEO, HOSPITAL ECO, FLEX, Demi-Privée, Privée) : c'est aussi le défaut du calculateur. SALARIA fait exception : le calculateur l'exclut par défaut, les deux valeurs sont relevées (`accident` = `false` et `true`).
- `monthly_chf` est la « Prime nette CHF / mois » affichée. Avec ce profil il n'y a ni rabais de famille, ni rabais pluriannuel, ni rabais collectif ; ce que le prix affiché contient d'autre est détaillé ci-dessous et dans `notes`.

## Produits, variantes et options relevés

`product_name` reprend le nom du produit dans l'application (fichier `locales/fr.json`), `product_key` la clé de `../insurers/helsana.json`. `option` est vide pour la configuration proposée par défaut.

| Produit (code PROMOS) | `variant` | `option` |
| --- | --- | --- |
| TOP (`PRO_Z1TOP__HEL_IG`), SANA (`Z1SANA`), COMPLETA (`Z1COMP`), PRIMEO (`Z1PRIM`), HOSPITAL ECO (`Z2ECO_`) | — | — |
| COMPLETA PLUS (`Z1COPL`) | — | — ; prime du complément seul, conclu uniquement avec COMPLETA |
| WORLD (`Z1WORL`) | — | — ; conclu uniquement avec l'assurance de base du Groupe Helsana, prime de WORLD seule |
| Helsana Advocare PLUS (`Z9ADPL`), Advocare EXTRA (`Z9ADEX`) | — | — |
| DENTAplus (`Z8DEPL`) | Light, Bronze, Argent, Or, Combi | — |
| HOSPITAL FLEX (`Z2FLEX`) | FLEX 1, FLEX 2 | défaut : module complémentaire inclus ; `module complémentaire exclu` |
| HOSPITAL Demi-Privée (`Z2HHP_`), HOSPITAL Privée (`Z2HPR_`) | Demi-Privée, Privée | défaut : franchise hospitalière CHF 0, maternité incluse (femmes) ; `maternité exclue` (femmes, toutes localités) ; franchises CHF 1000, 2000, 3000, 5000, 7000 (Lausanne seulement) |
| HOSPITAL EXTRA (`Z2EXTR`) | indemnité journalière CHF 50, 100, 150, 200, 300 | — |
| VIVANTE (`Z7VIVA`) | indemnité journalière CHF 40, 60, 80, 100, 140, 180 | — |
| CURA (`Z7CURA`) | indemnité journalière CHF 60 (proposée par défaut) | défaut : délai d'attente 720 jours ; 180, 360, 1080 jours |
| PREVEA Accident (`Z4PRUN`), PREVEA Maladie (`Z4PRKR`) | capital décès CHF 10 000 et invalidité CHF 100 000 (proposés par défaut) | — |
| SALARIA (`Z5SALA`) | variante LCA, CHF 50 par jour, délai 90 jours, durée 730 jours (proposés par défaut) | — ; `accident` `false` et `true` |

Lignes par localité : Lausanne 7 836 (61 combinaisons), les cinq autres 5 436 chacune (41 combinaisons, sans les franchises hospitalières supérieures à CHF 0).

## Ce que contient le prix affiché

Pour 31 416 lignes, le prix net affiché est égal au prix brut du moteur et ne porte aucun poste de rabais ni supplément. Cas particuliers, tous signalés dans `notes` :

- **Advocare PLUS / EXTRA** (1 920 lignes) : le prix affiché ajoute au tarif de base du moteur (9.80 / 18.80) un supplément de 6.50 (`kombizuschlag`, code `COT_Gesundheit-Auslandrechtschutz_HEL`). Dès 26 ans : 16.30 / 25.30. Le calculateur déduit en plus un rabais enfants et jeunes : 4.05 / 6.30 jusqu'à 18 ans (75 %), 8.15 / 12.65 de 19 à 25 ans (50 %). Aucun prix avant ce rabais n'est affiché.
- **HOSPITAL FLEX**, configuration par défaut (1 680 lignes) : le prix affiché inclut le module complémentaire ; « prime brute du moteur » dans `notes` est le prix sans module, égal à la ligne `module complémentaire exclu`. 70 de ces lignes (tranche 00-05) portent en plus un poste `ueberrabattierung` de 0.05.
- **CURA** (3 360 lignes, comptées dans les 31 416) : le calculateur présente un « rabais sur les primes 5 % » comme déjà déduit du prix affiché, sans poste de rabais dans le moteur. Modifier ce paramètre ne change pas le prix : le montant avant rabais n'est pas observable.

Supposé, non vérifié : le supplément Advocare de 6.50 correspondrait à la protection juridique santé et étranger, facturée quand elle n'est pas déjà acquise par TOP ou COMPLETA. Si c'est faux, seule l'interprétation change, pas les prix relevés ; le prix en combinaison avec TOP ou COMPLETA n'a pas été relevé.

## Tranches d'âge et limites constatées

`notes` commence par la tranche tarifaire du moteur (`tranche=36-40`). Le prix est constant dans chaque tranche (6 708 combinaisons tranche × produit × variante × option × sexe × localité contrôlées, aucune avec deux prix). Chaque année de naissance a été calculée, rien n'est dérivé d'une tranche.

- Tranches de 5 ans (00-05, 06-10, … 76-80), âge = année du début d'assurance − année de naissance. Advocare : 00-18, 19-25, 26 et plus.
- Proposés pour toutes les années 1947 à 2026 : TOP, SANA, COMPLETA, COMPLETA PLUS, PRIMEO, WORLD, Advocare PLUS et EXTRA, HOSPITAL ECO, Demi-Privée, Privée, HOSPITAL EXTRA.
- HOSPITAL FLEX, CURA, PREVEA Accident : années 1957 à 2026 (jusqu'à 70 ans).
- PREVEA Maladie : 1972 à 2026 (jusqu'à 55 ans). DENTAplus : 1977 à 2026 (jusqu'à 50 ans).
- VIVANTE : 1957 à 2010 (17 à 70 ans). SALARIA : femmes 1963 à 2011 (16 à 64 ans), hommes 1962 à 2011 (16 à 65 ans).
- Hors de ces années le calculateur ne propose pas le produit : pas de ligne.

Dans les six localités, le sexe ne change pas le prix de COMPLETA PLUS, PRIMEO, WORLD, Advocare, HOSPITAL ECO et HOSPITAL EXTRA. SANA, COMPLETA PLUS, PRIMEO, WORLD, Advocare, HOSPITAL EXTRA, VIVANTE et PREVEA ont les mêmes prix dans les six localités ; CURA ne diffère qu'à Delémont, DENTAplus qu'à Genève et Delémont, HOSPITAL ECO a les mêmes prix à Lausanne et Genève.

## Produits du calculateur absents du relevé

- Assurance de base LAMal (BASIS, BeneFit PLUS Télémédecine / Médecin de famille / Flexmed, PREMED-24, BASIS à l'étranger) et SALARIA selon la LAMal (`PRO_H5SALA_HEL_IG`) : hors périmètre LCA.
- Produits fermés, présents dans le modèle mais jamais proposés à un nouveau client (aucun prix affiché) : COMPLETA EXTRA, HOSPITAL PLUS, HOSPITAL COMFORT, HOSPITAL PLUS BONUS, HOSPITAL COMFORT BONUS, HOSPITAL PLUS CLASSICA, HOSPITAL COMFORT CLASSICA.
- Options non relevées : couverture accident exclue (sauf SALARIA) ; franchises hospitalières supérieures à CHF 0 hors de Lausanne ; contrat de 3 ans ; CURA avec une autre indemnité que CHF 60 (18 montants de CHF 10 à 300) ; PREVEA avec d'autres capitaux (CHF 10 000 à 300 000, jusqu'à 500 000 pour Maladie) ; SALARIA avec d'autres montants (CHF 10 à 600), délais d'attente (3 à 360 jours), durée 365 jours ou variante accident.

## Vérifications à l'écran

`node collectors/helsana.mjs --verify` ressaisit six profils dans l'interface, un par localité, dans six sessions neuves, et lit la « Prime nette CHF / mois » de chaque carte des pages de comparaison. Résultat du 2026-11-18 : **113 prix affichés sur 113 identiques au relevé.**

| Profil saisi | Cartes comparées | Exemples lus à l'écran |
| --- | --- | --- |
| Femme 1990, 1003 Lausanne | 23 / 23 | TOP 23.05, COMPLETA 80.60, Demi-Privée 123.50, DENTAplus Or 69.40 |
| Homme 2015, 1204 Genève | 21 / 21 | TOP 14.75, COMPLETA 33.85, Advocare PLUS 4.05, FLEX 2 20.95 |
| Femme 1950, 1950 Sion | 12 / 12 | COMPLETA 112.40, Demi-Privée 274.40, Privée 430.10 |
| Femme 2001, 2000 Neuchâtel | 23 / 23 | SANA 38.65, FLEX 2 37.85, SALARIA 26.20 (accident exclu) |
| Homme 1972, 1700 Fribourg | 18 / 18 | COMPLETA 72.35, PREVEA Maladie 90.40, Privée 147.50 |
| Homme 1960, 2800 Delémont | 16 / 16 | TOP 27.15, FLEX 2 79.40, VIVANTE 99.00 |

Pour ces six profils, toutes les lignes du relevé (obtenues en modifiant la personne dans le moteur) sont identiques à celles que donne le moteur après une vraie saisie du profil, et le numéro de commune fixé par le script est celui que l'interface retient. L'écran ne montre que la configuration par défaut : les franchises, la maternité exclue, le module FLEX exclu, les variantes non présélectionnées (FLEX 1, VIVANTE, HOSPITAL EXTRA, délais CURA) et SALARIA avec accident ne sont vérifiés que par cette comparaison de moteur à moteur, pas à l'écran.

## Anomalies et points d'attention

- Aucun prix nul, manquant ou non numérique ; aucun produit LCA proposé par le calculateur qui soit inconnu du script.
- Chaque ouverture du formulaire crée côté Helsana un brouillon de session anonyme (prénom « Test », date de naissance, NPA) : une par relevé, six de plus avec `--verify`, une vingtaine pendant la mise au point. Aucune offre demandée, aucune coordonnée, aucun questionnaire de santé.
- Premier essai de `--verify` interrompu au profil de Sion : le champ « Commune » obligatoire n'était pas géré. Corrigé, puis relevé et vérification relancés en entier.
- Une expression inventée pendant l'exploration a fait planter l'onglet (moteur WebAssembly). Le script n'emploie que des expressions utilisées par l'application.
- `helsana.csv` pèse 8,4 Mo.

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `portal.helsana.ch` | calculateur, modèle tarifaire, fichiers de référence, session | 200 |
| `www.helsana.ch` | page d'entrée, script de balisage chargé par le calculateur | 200 |
| `fonts.googleapis.com` | icônes | 200 |
| `cdn.cookielaw.org`, `consent.cookiefirst.com` | bannière de cookies | refusé par le proxy, sans effet |
| `assets.adobedtm.com`, `www.googletagmanager.com` | balises de mesure | refusé par le proxy, sans effet |
| `westeurope-0.in.applicationinsights.azure.com`, `switzerlandnorth-0.in.applicationinsights.azure.com` | télémétrie | refusé par le proxy, sans effet |
| `oc-cdn-public-eur.azureedge.net` | fenêtre de chat | refusé par le proxy, sans effet |

Aucun captcha, aucun blocage.

## Relancer

```bash
node premiums/collectors/helsana.mjs            # réécrit premiums/helsana.csv
node premiums/collectors/helsana.mjs --verify   # idem, puis vérification à l'écran de six profils
node premiums/collectors/helsana.mjs --out /tmp/essai --years 1990,1950 --npa 1003,1204
```

Le résumé (versions, limites d'âge, détail des vérifications) sort en JSON sur la sortie standard. Le script s'arrête si le début d'assurance, la durée de contrat, la localité ou la personne lus dans le moteur ne sont pas ceux attendus.
