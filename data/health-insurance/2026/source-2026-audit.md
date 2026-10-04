# Audit des sources officielles Priminfo 2026

Vérifié le 2 octobre 2026. Périmètre : lecture des normaliseurs et sources officielles, téléchargement et profilage uniquement. Aucun script applicatif, API ou base modifié par cet audit. Les fichiers 2027 ont seulement été lus pour décrire les différences de format et d’identifiants. Aucune prestation ni condition 2026 n’est déduite de 2027.

## Résultat utilisable

Le dossier contient les sources 2026 intégrales : 217 472 lignes de primes CH, dont 217 308 pour les 26 cantons et 164 pour les codes ZE/ZR ; 156 modèles auprès de 34 assureurs ; 3 939 couvertures de modèles ; 5 483 lignes de localités, 2 114 numéros OFS et 42 régions suisses. Le fichier UE/AELE/UK contient 2 230 lignes pour 14 assureurs et 30 pays. Les années internes sont partout 2026 (primes) et 2025 (enquête).

Les fichiers convenus sont premiums.csv.gz, tariffs.csv.gz, coverage.csv.gz, insurers.xlsx, regions.xlsx, premiums-eu.csv et sources.json. Les gzip encapsulent exactement les octets CSV extraits du ZIP, sans conversion de séparateur, de code, de valeur ou de nom. Les SHA256 de sources.json portent sur les octets CSV décompressés. Le ZIP complet reste conservé dans archive-2026.zip.

insurers-brands.json contient 34 objets {id, name, brand, aliases, year, groupName, groupRelationship, registryEffectiveDate, absentFrom2027Premiums, sources}. source-2026-profile.json contient les champs, quantités, contrôles, 156 modèles nommés et différences entre années. archive-manifest.json décrit les 15 membres ZIP avec empreintes et dates ZIP sans fuseau. download-provenance.json décrit les téléchargements directs et leurs dates UTC.

## Chaîne de sources et dates

- [Archives Priminfo](https://www.priminfo.admin.ch/fr/downloads/archiv) : liens explicites vers les régions et PDF 2026, et renvoi vers le catalogue OFSP opendata.swiss.
- [Ressource officielle Archiv_Praemien_2026.zip](https://opendata.swiss/fr/dataset/health-insurance-premiums/resource/2dc39d7d-6c55-4a57-82f9-60237467127e) : publiée et modifiée le 11 septembre 2026. [ZIP direct](https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL0FyY2hpdl9QcmFlbWllbl8yMDI2LnppcA%3D%3D). Les membres portent des dates de septembre 2025 ; ces dates de création ne remplacent pas les colonnes année de primes/enquête.
- [Régions de primes 2026](https://www.priminfo.admin.ch/downloads/praemienregionen_2026.xlsx) : Informations!A1 certifie 01.01.2026–31.12.2026, release-2026-08-17. Sources de A_COM/B_NPA indiquées au 16.08.2025, modifications annoncées au 01.08.2025. Le Last-Modified HTTP du 02.10.2026 correspond à la publication serveur ; il ne prouve pas une mise à jour de la géographie à cette date.
- [Registre OFSP des assureurs autorisés](https://www.bag.admin.ch/de/verzeichnisse-der-zugelassenen-kranken-und-rueckversicherer) : [XLSX au 01.01.2026](https://www.bag.admin.ch/dam/de/sd-web/wKeV97535ICf/Zugelassene%20Krankenversicherer_1.1.2026.xlsx), publication affichée au 08.01.2026. Le classeur confirme 01.01.2026 en page de garde. Ne pas remplacer ses identités historiques par le registre au 01.10.2026.
- [PDF Suisse 2026](https://www.priminfo.admin.ch/downloads/praemien_2026.pdf) : 884 pages, release-2026-08-17 sur les tableaux ; [PDF UE/AELE/UK 2026](https://www.priminfo.admin.ch/downloads/praemien_eu_2026.pdf) : 70 pages.
- [Métadonnées CKAN officielles](https://ckan.opendata.swiss/api/3/action/package_show?id=health-insurance-premiums) conservées dans opendata-metadata.json. La couverture temporelle générale du dataset est désormais 2027 : elle ne remplace pas l’année spécifique du ZIP historique. La ressource ZIP déclare terms_open ; les ressources individuelles courantes ont des conditions différentes, souvent terms_by. Conserver l’attribution Office fédéral de la santé publique (OFSP), Priminfo. usage-conditions.pdf est le nom local de la notice « to whom it may concern.pdf » : c’est une note sur les formats et fusions, pas un texte de licence.

La taille annoncée par CKAN pour le ZIP (31 176 octets) est erronée : téléchargement réel 31 923 906 octets. Le contenu et le SHA256 locaux font foi pour l’intégrité.

## Empreintes SHA256

Pour les gzip ci-dessous, octets/empreinte = contenu original décompressé.

| Fichier | Octets d’origine | SHA256 |
|---|---:|---|
| premiums.csv.gz | 22545492 | `1c6022adc79cff55e67562840e32754e434edebce419cc7c257cbba77e142ce5` |
| tariffs.csv.gz | 20552 | `d1a24efef70e3324aede09f3c809f6357b6bb9d4debf3929227bd5e98a31c1d7` |
| coverage.csv.gz | 209347 | `d8d492f2821d321f380fb92066c17f367090aea139f6ca58a083fb2659488e54` |
| premiums-eu.csv | 204515 | `7c5439fef6f1c342e2d664457fc855b1891ca16282f0b5ee06497f7ec481c4d9` |
| restricted-territories.csv | 4504 | `7cd27c305d78776b4a580c572612f27b6780d68fe7de9dcf950d304071a305ce` |
| data-dictionary.xlsx | 21629 | `06489c476ee24d82e1d71376f99c8934feccf28936e70c528aad21c6566a09e7` |
| usage-conditions.pdf | 77830 | `6105652bb0d4f2262178a983c6461c0c458975eceaf8d2b67b6f61b8cb0a5aa4` |
| regions.xlsx | 693312 | `a74639530b9ead5da8e38ff7d3cff3896b8ee3dc7de06a9f60a688d2d98b1a21` |
| insurers.xlsx | 49567 | `c0da8ef4e173bb81954ba1f4d3d014184b5972c0a7bbc20dac7c815be901c27f` |
| archive-2026.zip | 31923906 | `01ef32ab0bd8e25ee01ebd3d1d601487ca21f1569b55da3edcf9f9170f99dc78` |
| premiums-official.pdf | 6550708 | `6914ccc22c68f83ec7098daf623b5058bfcb29f750dcf357920d6f303f51634b` |
| premiums-eu-official.pdf | 564305 | `4857b7f66f7263168bc4e33bc24dc358c522ea1d4f8ca8338d9fe03b3ce0e5f4` |
| opendata-metadata.json | 53992 | `c12d930769b34018054cf4b5d6e5950dbe0bd0bf71f8d9b9f83ef99ace7edecd` |

## Formats exacts et adaptations

| Domaine | 2026 observé | Effet sur le normaliseur 2027 lu en début d’audit |
|---|---|---|
| Années | Geschäftsjahr=2026 ; Erhebungsjahr=2025 | Retirer les constantes 2027/2026 au profit d’un jeu de règles par année. |
| Séparateur | Primes CH/UE : virgule ; Tarife/Einzugsgebiete : point-virgule, UTF-8 BOM | DictReader par défaut échoue sur tarifs/couvertures. Le dictionnaire XLSX dit « virgules » pour tout : les octets réels contredisent cette description. |
| Type de tarif | Tarife MOD : BASE/HAM/HMO/DIV ; primes/couverture : TAR-BASE/TAR-HAM/TAR-HMO/TAR-DIV | Valider le préfixe TAR- et garder la taxonomie historique. Le test d’égalité brut et l’enum 2027 échouent. |
| Âge | AKL-KIN / AKL-JUG / AKL-ERW | Correspondent à enfant / jeune adulte / adulte. 2027 utilise AKA_01_KIN / AKA_02_JUG / AKA_03_ERW. |
| Sous-groupe âge | Adultes et jeunes : chaîne vide ; enfants K1/K3/K4/K5 | Ne pas filtrer les adultes 2026 sur E1/J1. ALT décrit E1/J1 mais les primes n’utilisent pas ces valeurs en 2026. |
| Accident | MIT-UNF / OHN-UNF | La comparaison avec MIT_UNF transforme sinon tous les contrats 2026 en sans accident. Valider l’enum. |
| Franchise | FRA-0, FRA-100…FRA-2500 | split underscore échoue ; parser le suffixe après tiret dans le format 2026. |
| Région | PR-REG CH0/CH1/CH2/CH3 | Dernier chiffre compatible, mais ne jamais transformer CH0 en 1. |
| Territoire | CH pour Suisse ; EU pour UE/AELE/UK | L’assertion P_OKPEU échoue en 2026. |
| Pays | EU AT, EU DE… EU GB | Extraire le code ISO après le préfixe EU documenté. GB reste Royaume-Uni ; le préfixe EU ne signifie pas adhésion à l’UE. |
| Source de download | URL ZIP + archiveMember | Télécharger une URL de sources.json puis l’enregistrer en CSV ferait un faux CSV : extraire le membre nommé. Les URLs courantes sans archive retournent 2027. |

Les quatre CSV ont des en-têtes conservés dans source-2026-profile.json. Les principaux sont :

- Primes CH : Versicherer, Kanton, Hoheitsgebiet, Geschäftsjahr, Erhebungsjahr, Region, Altersklasse, Unfalleinschluss, Tarif, Tariftyp, Altersuntergruppe, Franchisestufe, Franchise, Prämie, isBaseP, isBaseF, Tarifbezeichnung.
- Primes UE : même structure, Land remplace Kanton.
- Tarifs : Versicherer, Geschäftsjahr, Erhebungsjahr, Kategorie, Tarif, Tariftyp, Sort.-Nr., Name_DE, Name_FR, Name_IT.
- Couverture : Versicherer, Kanton, Hoheitsgebiet, Geschäftsjahr, Erhebungsjahr, Region, Tarif, Tariftyp, HMO-ID, Eingeschränkt, Gemeinden-BFS. HMO-ID est vide selon le dictionnaire ; Gemeinden-BFS reste une liste séparée par virgules à l’intérieur du CSV point-virgule.

Les catégories 2026 sont conservées telles quelles : 34 BASE, 53 HAM, 20 HMO, 49 DIV. Aucune classification 2027 n’est appliquée. Un DIV n’est pas nécessairement exclusivement télémédecine, et HAM/HMO incluent aussi des modèles hybrides : Sanitas MultiAccess est HMO ; Assura Qualimed/Hausspital et SWICA MULTICHOICE/PHARMA sont HAM. Le nom officiel 2026 peut être affiché sans tag de catégorie 2027.

Références du code lu initialement : health-normalize.py lignes 20–26 (dossier/URLs), 56–60 (CSV/années), 62 (index assureurs), 69–70 (catégories), 76–83 (régions), 94–109 (âge/franchise/accident), 113–117 (année sortie) ; health-foreign-normalize.py lignes 4–25 (mêmes constantes, territoire EU, pays et sous-groupes). Ce constat décrit le code avant la paramétrisation en cours par l’agent propriétaire. Le normaliseur Suisse inclut déjà son hash dans l’identité dataset ; le normaliseur étranger lu utilisait le seul hash du CSV.

## Identités et correspondances interannuelles

Le classeur insurers.xlsx a quatre onglets. worksheets[1], nommé « Index   Indice   Index », contient l’ID en colonne B et le nom court en D : la lecture row[1]/row[3] existante convient. worksheets[2], « Zugelassene Krankenversicherer », a ID en A, UID en B, noms légaux en C, groupe en F ; les cellules et lignes de continuation sont nécessaires pour Avenir, Mutuel, Philos et AMB. Les 34 IDs des primes sont tous présents. Les IDs à zéros initiaux dans Tarife/Einzugsgebiete doivent devenir des entiers, pas des chaînes comparées à « 8 ». Les caisses d’indemnités journalières marquées x ne sont pas à importer si absentes des primes.

| ID OFSP 2026 | Identité / marque vérifiée | Modèles 2026 | Particularité |
|---:|---|---|---|
| 1113 | Caisse-maladie de la vallée d’Entremont société coopérative ; CMVEO | BASE, SanaTel | Présent 2026, absent des primes 2027 ; groupe OFSP = coopération avec Groupe Mutuel, ne pas assimiler automatiquement à une filiale ni inventer l’assureur successeur. |
| 1507 | AMB Assurances SA ; AMB | BASE, PrimaCare, SanaTel | Présent 2026, absent des primes 2027 ; groupe Groupe Mutuel. |
| 820 | curaulta ; alias historique LUMNEZIANA | BASE, casamed | Le registre « Anpassungen » documente le changement de nom et l’intégration sanavals 901 au 01.01.2026. |

Le registre documente également la fusion vivacare 1570 dans Galenos 1386 au 01.01.2026 et le retrait KLuG 829 au 31.12.2025. Ces anciens IDs n’ont pas de primes 2026 dans ce jeu. Ne pas les créer comme offres 2026.

133 couples (ID assureur, Tarif) persistent entre les deux fichiers ; 23 couples existent seulement en 2026 et 20 seulement en 2027 ; 53 noms FR changent parmi les couples persistants. Un couple stable ne prouve pas des conditions de soins identiques. La plupart des codes SWICA changent ; plusieurs codes Sanitas changent aussi. Les IDs techniques de modèle/localité dérivés du dataset changent par construction : ne pas joindre les années sur ces IDs. Le dossier actuel doit garder sa référence au snapshot 2026. La liste des 23 couples absents en 2027 est dans le profil JSON.

Logo CMVEO : [SVG officiel](https://www.cmveo.ch/Site/Skins/Default/Foundation/logo-desktop.svg), référencé par la feuille MAIN.css du site officiel et vérifié HTTP 200/image SVG. 3 568 octets après décompression HTTP gzip, Last-Modified 29.08.2025. La date ne certifie pas à elle seule une charte applicable à toute l’année 2026. AMB : le site amb-assurance.ch cité par le PDF2026 redirige désormais vers une page complémentaire Global smart Groupe Mutuel ; aucun logo AMB propre vérifié. logos-audit.json contient les preuves ; ne pas attribuer le logo d’un produit complémentaire à l’assureur historique.

## Régions, communes, éligibilité et âge

CH0 est la région 0 officielle pour un canton non subdivisé. Informations!A6 de regions.xlsx énumère AG, AI, AR, BS, GE, GL, JU, NE, NW, OW, SO, SZ, TG, UR, ZG. A_COM contient exactement sept colonnes : OFS, canton, commune, région, district, NPA, localité, depuis la ligne 6. Une commune peut avoir plusieurs NPA et un NPA plusieurs communes ; le NPA seul ne prouve pas la région. Les 42 régions suisses de A_COM correspondent aux primes. ZE (146 lignes) et ZR (18 lignes) restent des catégories hors carte Suisse, comme en 2027.

Les 3 939 couvertures non BASE n’ont aucun doublon ni modèle/région sans prime. Dix lignes sont limitées à des communes (Eingeschränkt=Y), les autres 3 929 sont N. Tous les numéros OFS listés existent dans A_COM 2026 et appartiennent au canton/région concerné. Aucun tarif non BASE ne manque de couverture. BASE n’est pas dans Einzugsgebiete : l’existence d’une prime par région définit déjà sa présence territoriale ; les restrictions d’assureur SLKK/Visperterminen au VS sont limitées à la région 2 et corroborées par restricted-territories.csv. Une disponibilité territoriale ne prouve pas qu’un médecin/réseau accepte encore le patient.

Entre A_COM 2026 et 2027 : 13 anciens OFS disparaissent et 3 nouveaux apparaissent, aucun canton/région ne change pour les OFS persistants. Les communes nouvelles incluent Fétigny-Ménières 2056, La Vallée de Joux 5940 et Mathod-Suscévaz 5941. Le classeur 2027 mentionne aussi certaines fusions du 01.01.2026 qui ne figurent pas dans A_COM 2026, construit avec un état 2025 : ne pas réécrire silencieusement le fichier historique. Conserver une recherche spécifique à l’année et signaler l’absence d’un ancien OFS, ou utiliser un rapprochement officiel contrôlé. Le profil JSON détaille les communes concernées.

Le PDF2026 p.25 définit les tranches sur l’année civile. Appliquer l’âge séparément pour chaque année : naissance 2008 = enfant en 2026 puis jeune adulte en 2027 ; naissance 2001 = jeune adulte en 2026 puis adulte en 2027. Une franchise enfant 0 ne devient pas un tarif adulte 2027 valide. Le prix du contrat 2026 et celui de la configuration 2027 doivent donc résoudre leur propre tranche et franchise. Ne pas utiliser l’âge au jour de la simulation.

Les enfants K3/K4/K5 sont des sous-groupes tarifaires particuliers. Attention : une anomalie du CSV Tarife.csv affecte aussi K1 : pour 22 assureurs, le libellé K1 répète le libellé familial de K3/K5. Cela ne signifie pas que K1 soit une réduction familiale. Vérification indépendante dans les tableaux PDF2026 : 225 lignes des pages 35, 233, 441, 547 et 548 couvrent les 34 assureurs et identifient K1 comme la ligne enfant standard / un enfant. Aquilana AG BASE : K1 CHF 127.80 contre K3 CHF 63.90 ; Avenir : K1 CHF 140.60 (un enfant) contre K5 CHF 105.50 (trois enfants et plus) ; Assura : K1 CHF 115.90 (un enfant), K4 CHF 113.90 (deux enfants), K5 CHF 111.90 (trois enfants et plus). Les 42 434 lignes spéciales K3/K4/K5 ont toutes un K1 correspondant et un montant strictement inférieur. Utiliser K1 sans composition du foyer ni rabais familial confirmé ; ne pas afficher le libellé ALT K1 erroné, ne pas choisir MIN parmi les sous-groupes. L’éligibilité familiale détaillée reste propre aux assureurs et n’est pas déduite du seul nombre d’enfants. child-subgroups-audit.json conserve les libellés source contradictoires, une preuve PDF par assureur et les 225 rapprochements. Le PDF affiche une décimale alors que le CSV peut avoir cinq centimes : par exemple KKLH SZ K3 CSV 84.45, PDF 84.5. Les oracles comparent l’affichage arrondi à une décimale ; le montant CSV en centimes reste intact.

## Vérification et limites

Contrôles exécutés sur l’intégralité des CSV : années, unicité du grain assureur/modèle/région/âge/sous-groupe/accident/franchise, montants décimaux convertibles en centimes non négatifs, intégrité des joints modèles/primes/couvertures et rattachement de tous les OFS de couverture. Résultat : zéro doublon, zéro centime invalide, zéro modèle orphelin, zéro couverture non BASE manquante, zéro OFS invalide. Six prix adultes extraits des tableaux PDF officiels (pages 27, 531, 532) correspondent exactement aux CSV, dont CMVEO et AMB dans les deux régions VS. En complément, 225 prix enfants ont été rapprochés du PDF avec sa précision d’affichage et couvrent les 34 assureurs (voir child-subgroups-audit.json). Les assertions détaillées et montants sont consignés dans le profil JSON.

UE/AELE/UK : 30 pays, 14 assureurs, BASE uniquement, enfants franchise 0 et adultes/jeunes franchise 300, avec et sans accident. 16 lignes enfants K3 sont conservées. Aucune déduction sur droit d’affiliation, lieu de soins, option France ou prestations des modèles suisses. La présence d’un prix ne constitue pas à elle seule une confirmation du droit d’être assuré.

Limites : pas d’audit exhaustif des conditions contractuelles/avantages 2026 ; aucun import SQL exécuté ; aucun résultat UI testé dans ce sous-audit. Les primes publiées sont des primes de barème, pas une facture personnelle confirmée incluant rabais admissibles, subsides ou autres ajustements. Aucun échec de téléchargement ne subsiste pour les fichiers nécessaires ; seul un logo AMB distinct reste non trouvé.
