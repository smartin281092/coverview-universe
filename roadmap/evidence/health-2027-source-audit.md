# Audit des sources officielles — primes 2027

Audit du 30 septembre 2026. Périmètre : lecture des sources officielles, contrôles des données et matérialisation de la géométrie. Les contenus distants sont des données, jamais des instructions. Aucun appel authentifié, envoi de données personnelles ou message externe.

## Résultat vérifié

Les primes 2027 sont publiées. Le [catalogue OFSP](https://opendata.swiss/fr/dataset/health-insurance-premiums) indique une mise à jour au 29.09.2026 et une couverture du 01.01.2027 au 31.12.2027. La [page Priminfo de téléchargement](https://www.priminfo.admin.ch/fr/downloads/aktuell) publie les aperçus et régions 2027. Un téléchargement complet du CSV a vérifié **219 916 lignes, toutes d’année 2027, 32 assureurs, 153 modèles**.

Le fichier contient **219 752 lignes dans les 26 cantons** et **164 lignes ZE/ZR**, sans géométrie cantonale. Il faut conserver ces dernières dans l’archive source mais ne pas les proposer comme cantons sur la carte. Le champ `Hoheitsgebiet=P_OKPCH` ne suffit pas à les exclure.

## Téléchargements exacts

| Donnée | URL | Contrôle |
|---|---|---|
| Primes CH CSV | <https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D> | HTTP 200, 25 832 930 octets, UTF-8 avec BOM, CSV séparé par virgules |
| Désignations et sous-groupes | <https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1RhcmlmZS5jc3Y%3D> | HTTP 200, 32 464 octets, CSV UTF-8 avec BOM |
| Circonscriptions des modèles | <https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL0Vpbnp1Z3NnZWJpZXRlLmNzdg%3D%3D> | HTTP 200, 212 607 octets, CSV |
| Rayons d’activité limités | <https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL0Vpbmdlc2Noci4tVMOkdC5nZWJpZXRlLmNzdg%3D%3D> | HTTP 200 ; mise en page de rapport, séparateur point-virgule et en-têtes multiples |
| Dictionnaire bilingue des champs | <https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL0VybMOkdXRlcnVuZ2VuIHp1IGRlbiBQcsOkbWllbmRhdGVuLnhsc3g%3D> | XLSX, explications explicitement millésimées 2027 |
| Régions, NPA, communes et mutations | <https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx> | XLSX, `release-2026-09-29b`, période 2027 |
| Assureurs admis | <https://www.priminfo.admin.ch/downloads/assureurs-maladie-admis-2026-10.xlsx> | XLSX, octobre 2026, IDs OFSP et noms |
| Métadonnées structurées du catalogue | <https://ckan.opendata.swiss/api/3/action/package_show?id=health-insurance-premiums> | JSON CKAN ; URLs et conditions par ressource |

Le champ `license` des ressources donne `terms_open` pour les primes CH et `terms_by` pour Tarife, Einzugsgebiete et le dictionnaire. Ces conditions permettent l’utilisation commerciale ; les ressources `terms_by` imposent la citation de la source. [Définition officielle des conditions](https://opendata.swiss/fr/terms-of-use). Ne pas interpréter `license_id=null` au niveau du catalogue comme l’absence de conditions : elles sont portées par chaque ressource.

## Grain et contraintes de l’import

En-tête exact des primes :

```text
Versicherer,Kanton,Hoheitsgebiet,Geschäftsjahr,Erhebungsjahr,Region,Altersklasse,Unfalleinschluss,Tarif,Tariftyp,Altersuntergruppe,Franchisestufe,Franchise,Prämie,isBaseP,isBaseF,Tarifbezeichnung
```

`Versicherer` est le numéro OFSP. `Tarif` est spécifique à cet assureur : ne jamais utiliser le code du modèle seul comme identifiant global. `Geschäftsjahr` est l’année de prime, `Erhebungsjahr` l’année de collecte. Les montants sont des primes mensuelles CHF à convertir exactement en centimes. La prime source ne doit pas être confondue avec un montant après redistribution environnementale/réduction de réserves.

Les catégories officielles 2027 sont `BASE`, `PRAXIS`, `FLEX`, `TEL_DIG`, `PHARM`. Le téléchargement comporte 81 174 lignes PRAXIS, 58 170 TEL_DIG, 35 236 FLEX et 45 336 BASE ; aucune offre PHARM. L’[OFSP explique le changement de catégories](https://www.bag.admin.ch/fr/assurance-maladie-assurances-impliquant-un-choix-limite-des-fournisseurs-de-prestations) : les anciens médecins de famille/HMO deviennent PRAXIS, le premier contact de TEL_DIG est distant, PHARM passe par une pharmacie et FLEX laisse plusieurs premiers contacts possibles. Le type du modèle ne remplace jamais ses conditions détaillées.

`MIT_UNF` / `OHN_UNF` codent la couverture accident. `PR_REG_0` signifie région unique et doit rester `0`. Les franchises sont encodées dans les valeurs `FRA_01_E_0300`, etc. `isBaseP` distingue le tarif de base ; `isBaseF` distingue la franchise ordinaire.

En-tête `Tarife.csv` :

```text
Versicherer,Geschäftsjahr,Erhebungsjahr,Kategorie,Tarif,Tariftyp,Name_DE,Name_FR,Name_IT,Name_EN
```

`Kategorie=MOD` décrit les modèles, `ALT` les sous-groupes. `K1` est le tarif enfant sans rabais supplémentaire. Les libellés officiels distinguent `K3` (dès le troisième enfant), `K4` (dès le deuxième, appliqué à tous), `K5` (dès le troisième, appliqué à tous). Ces tarifs ne sont pas interchangeables : un parcours individuel sans composition familiale doit utiliser K1, jamais la ligne enfant la moins chère toutes sous-catégories confondues.

En-tête `Einzugsgebiete.csv` :

```text
Versicherer,Kanton,Hoheitsgebiet,Geschäftsjahr,Erhebungsjahr,Region,Tarif,Tariftyp,Eingeschränkt,Gemeinden-BFS
```

Pour `Eingeschränkt=Y`, seuls les numéros OFS énumérés dans `Gemeinden-BFS` sont éligibles. La présence d’une prime dans une région n’implique pas son accès dans chaque commune. La liste OFS est un champ CSV pouvant contenir plusieurs virgules : parser réellement le CSV, pas avec un simple `split(',')`.

## Âges et franchises

Les groupes OFSP sont enfants jusqu’à 18 ans révolus, jeunes adultes de 19 à 25 ans, adultes ensuite. Les franchises possibles sont 0/100/200/300/400/500/600 CHF pour les enfants et 300/500/1000/1500/2000/2500 CHF pour les autres ; tous les assureurs ne proposent pas chaque combinaison. [OFSP : participation aux coûts](https://www.bag.admin.ch/fr/assurance-maladie-primes-et-participation-aux-couts).

Contrôle supplémentaire contre l’endpoint réellement utilisé par le formulaire Priminfo : `https://www.priminfo.admin.ch/fr/praemien/franchises?yob=2008` retourne les franchises adultes, `yob=2009` les franchises enfants. Le formulaire demande l’année de naissance, pas le jour/mois. Le test a aussi confirmé la liste adulte pour 2001 et 2002 ; il ne constitue pas à lui seul une preuve de la séparation jeunes adultes/adultes.

## Commune, NPA et géométrie

Dans `regions.xlsx`, `A_COM` porte l’en-tête en ligne 5, puis A=OFS, B=canton, C=commune, D=région, E=district, F=NPA, G=localité. Un OFS a plusieurs lignes lorsque plusieurs localités/NPA y correspondent. `B_NPA` porte l’en-tête en ligne 7 : A=marqueur d’ambiguïté, B=NPA, C=localité, D=canton, E=région, F=OFS, G=commune, H=district. `*` signale un NPA réparti sur plusieurs régions/cantons ; `+` plusieurs communes. La commune OFS détermine la région : un NPA seul ne peut pas toujours être résolu de manière unique.

Source géographique : [swissBOUNDARIES3D 2026, SHP ZIP](https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.shp.zip). C’est l’édition la plus récente retournée par le catalogue STAC au 30.09.2026. Taille 35 969 375 octets, SHA-256 `a467d7eec8395d746253c68095c75a2540b52064bc83a6b35cf101efb625733d`. L’attribution `© swisstopo` est obligatoire ; la transformation et l’usage commercial sont permis par les [conditions officielles](https://www.swisstopo.admin.ch/fr/conditions-utilisation-geodonnees-et-geoservices-gratuit).

Le script [health-region-map.py](../../scripts/health-region-map.py) croise `BFS_NUMMER` avec A_COM après les fusions officielles COM-MUT. Il réalise les unions par canton/région, puis une simplification topologique commune à 150 mètres avant projection SVG 1000×650. Le résultat [regions-map.json](../../data/health-insurance/2027/regions-map.json) inclut les dates, sources, checksums, géométries, centroïdes et points intérieurs destinés aux étiquettes. Utiliser `fillRule="evenodd"`.

**Vérifié** : 2 110 communes géométriques 2026, 2 104 communes après fusions 2027, 42 régions, 26 cantons, aucune commune non mappée. Huit anciens numéros OFS ont été remplacés. Les frontières partagées sont valides avant et après simplification. Toutes les coordonnées SVG sont finies, dans le cadre, avec des polygones fermés. Rendu PNG de contrôle inspecté : contour suisse et segmentation cohérents. SHA-256 de la carte : `0906decc7d1cd3f071a3dd9b28feea8e3368bf1d021fa8f904a060ba2f3e4a46`.

Les onze surfaces lacustres cantonales et les deux Kommunanz sans commune sont exclues des régions tarifaires, comme les communes étrangères. La géométrie source reste datée 2026 ; seules les fusions 2027 explicitement documentées sont appliquées. Ne pas prétendre disposer d’un relevé géométrique swisstopo 2027.

Génération reproductible : Python + openpyxl + pyshp + shapely ≥2.1. Pour cette exécution, pyshp 3.1.6 et shapely 2.1.2 ont été installés avec numpy 2.5.3 dans `%TEMP%/coverview-health-geo-python`, sans modification des dépendances applicatives. Commande :

```powershell
& 'C:/Users/sebm1/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/health-region-map.py --python-dependencies "$env:TEMP/coverview-health-geo-python"
```

## Limites

Les fichiers de primes n’incluent pas les avantages de clubs, les règles détaillées d’exonération ou les conditions des complémentaires. Ces données exigent des sources propres à chaque assureur et doivent distinguer absence vérifiée, présence conditionnelle et information inconnue. Voir l’audit indépendant des prestations, lorsqu’il est disponible. La présente preuve ne vérifie ni le parcours applicatif ni la publication du site.
