# Audit B — modèles et avantages maladie 2027

Date de contrôle : 2026-10-01. Recherche officielle, aucun contact externe envoyé. Périmètre : les 16 assureurs assignés et les 89 modèles de l'inventaire, conservés avec leurs identifiants et codes exacts.

**Vérifié :** correspondance 89/89 modèles, 93 fiches avantages/règles, 90 URL officielles distinctes, absence de référence de modèle orpheline. Tous les passages sont des paraphrases. Pages PDF numérotées à partir de 1. Les conditions anciennes restent datées ; aucune continuité 2026→2027 n'est supposée.

**Limite explicite :** couverture de recherche complète de l'inventaire, pas certification exhaustive de tous les droits 2027. Un statut `partial` ou une valeur `null` signifie inconnu/non démontré, jamais « non offert ». Les clubs proposent des catalogues évolutifs ; les fiches indiquent les avantages lus et les questions restantes, sans prétendre épuiser toutes les offres temporaires.

| ID OFSP | Marque | Modèles examinés | Fiches | Modèles avec source explicite 2027 |
|---|---|---:|---:|---:|
| 941 | sodalis | 4 | 3 | 0 |
| 966 | vita surselva | 2 | 2 | 0 |
| 1040 | KKV | 3 | 2 | 0 |
| 1318 | Krankenkasse Wädenswil | 2 | 1 | 0 |
| 1322 | Birchmeier | 3 | 3 | 0 |
| 1384 | SWICA | 9 | 15 | 5 |
| 1386 | Galenos | 6 | 5 | 0 |
| 1401 | rhenusana | 3 | 3 | 0 |
| 1479 | Mutuel Assurance | 5 | 5 | 0 |
| 1509 | Sanitas | 8 | 9 | 8 |
| 1535 | Philos Assurance | 5 | 5 | 0 |
| 1542 | Assura | 9 | 16 | 1 |
| 1555 | Visana | 9 | 5 | 0 |
| 1560 | Agrisano | 4 | 10 | 0 |
| 1562 | Helsana | 8 | 5 | 0 |
| 1568 | sana24 | 9 | 4 | 0 |

## Conditions 2027 exploitables

Les identifiants stables complets se trouvent dans `review-b.json`. Pour intégrer une règle, joindre **assureur + modelId**, jamais seulement le nom commercial. `yearConfirmed` ne certifie que le fait décrit ; il ne certifie ni l'ensemble du modèle ni l'admission d'un médecin précis.

### Sanitas 1509

Source contractuelle : [CGA/CC, version 2027](https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/6009_Sanitas_AVB_KVG_fr.pdf), pages 6, 11–16.

- **TelMed Basic** : télécentre préalable, plan contraignant avec fournisseur et durée ; traitement définitif à distance soumis à participation LAMal. Les programmes chroniques/numériques peuvent être obligatoires.
- **TelMed Plus** : télécentre ou pharmacie partenaire ; si la pharmacie ne conclut pas le traitement, coordination par télécentre. Plan contraignant sur soins/durée/type de fournisseur ; choix de personne sous réserves contractuelles. Programmes chroniques et case management facultatifs.
- **MultiAccess** : médecin/cabinet choisi dans la liste, télécentre ou pharmacie agréée. Plan contraignant ; consultation télémédicale définitive soumise à participation.
- **Médecin de famille 1/2/3/4** : document générique 2027 trouvé, mais correspondance précise NetMed/CareMed et listes de médecins non démontrée. Garder le rapprochement en revue.

**Paniers séparés TelMed Plus uniquement** : [table d'exonération dès le 01.01.2027](https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/KOBE_Befreiung_TelMed_fr.pdf), page 1, colonnes inspectées visuellement. Les sept cases sont dans Plus ; Basic est vide. La franchise **et** la quote-part sont supprimées pour chaque panier admissible :

| Panier | Conditions à conserver |
|---|---|
| Premier conseil pharmacie | Pharmacie partenaire listée |
| Consultation médicale à distance | Centre télémédical |
| Vaccinations | OPAS 12a |
| Examen gynécologique préventif | OPAS 12e, mesure b |
| Mammographie préventive | OPAS 12d, mesure d / 12e, mesure c |
| Coloscopie | OPAS 12d, mesure b / 12e, mesure d ; prévention ou dépistage organisé |
| Médicaments ménopause | Liste nominative dans le JSON ; inscription LS et autorisation Swissmedic |

Ne pas étendre ces paniers à toute imagerie mammaire, tout dépistage digestif ou tout médicament hormonal. Les critères OPAS d'indication, risque, âge et fréquence restent nécessaires ; la présente recherche ne les transforme pas en règle clinique automatique. Ne pas cumuler une exonération légale commune avec son complément commercial comme deux économies.

### SWICA 1384

| Code tarifaire exact | Source 2027 | Porte d'entrée et obligations utiles |
|---|---|---|
| Medica (MEDICA) | [CS Medica](https://dam.swica.ch/image/upload/v1775120854/016_f_ZB_Favorit_Medica_ybulqt.pdf), p. 3 | Fournisseurs du répertoire Medica, aussi gynécologie/pédiatrie/ophtalmologie. Cela ne démontre pas une obligation générale de médecin de famille préalable. |
| Medpharm (PHARMA) | [CS Medpharm](https://dam.swica.ch/image/upload/v1775120874/018_f_ZB_Favorit_Medpharm_ywq7in.pdf), p. 3–4 | Pharmacie partenaire, santé24 ou SymptomCheck d'abord. Recommandations facultatives ; fournisseurs et médicaments dans le répertoire. |
| Santé (HMO) | [CS Santé](https://dam.swica.ch/image/upload/v1775120853/011_f_ZB_Favorit_Sante_lgz50g.pdf), p. 3 | Cabinet partenaire préalable ; son accord pour prolongations et orientations spécialisées. |
| Telmed | [CS Telmed](https://dam.swica.ch/image/upload/v1775120876/017_f_ZB_Favorit_Telmed_hmdmme.pdf), p. 3–4 | santé24 ou SymptomCheck préalable ; recommandation facultative. Pas de nouvel appel pour suivi dans les six mois. Pédiatrie soumise au premier recours dès 16 ans révolus. |
| Favorit Start | [CS Start](https://dam.swica.ch/image/upload/v1789112483/025_f_ZB_Favorit_Start_nn8ptv.pdf), p. 3–4 | SymptomCheck puis parcours imposé ; prescription santé24 et réseau Start. Téléphone si application indisponible ou appareil incompatible. |

**Gratuité 2027 précisément prouvée** : le conseil santé24 dans Telmed, Medpharm et Start est gratuit ; taxe de communication à charge. Cela ne suffit pas à coder toute consultation médicale définitive gratuite. Les CS renvoient aux listes publiées pour les autres exonérations. La FAQ TARDOC actuelle décrit une reprise de participation pour les modèles Favorit, mais sa continuité 2027 n'est pas prouvée par cette FAQ seule.

**Point bloquant Start** : la rédaction française dit « plus de 16 ans » et « à partir de la 17e année de vie », puis téléphone jusqu'à 16 ans révolus. Faire préciser la frontière d'anniversaire avant filtrage automatique. Pas d'exception générale pédiatre/ophtalmologue dans les CS Start ; gynécologie, séjour temporaire à l'étranger et urgence sont expressément prévus.

Casa, Bestcare et Multichoice : CS 2026 trouvées, non reconduites automatiquement. Bestcare impose le cabinet partenaire pour la suite ; Multichoice conserve les fournisseurs dans son répertoire même si le conseil initial est facultatif à suivre.

### Assura 1542 — HS

Le [communiqué Assura/EHC du 16.09.2026](https://passuraassets01.blob.core.windows.net/blue/cockpit-assets/2026/09/16/16.09.2026-Communiqu-presse_Assura_EHC_Hopital-de-Confiance_WEB_uid_6aaa437a8306f.pdf), p. 1, confirme le démarrage EHC au 01.01.2027 dans Vaud. La page [Hausspital](https://www.assura.ch/fr/client/calculator/hausspital) décrit encore KSBL. Garder **HS en revue** jusqu'au mapping modèle/commune/réseau et aux CSA : aucun réseau unique ni gratuité télémédicale universelle à en déduire.

## Paniers actuels documentés, 2027 encore inconnu

- **PrimaFlex Mutuel/Philos** : génériques sans franchise ; examens mammaires admissibles sans franchise ; certains tests/conseils pharmacie sans frais. Quote-part et conditions ne sont pas identiques entre ces paniers. Sources et restrictions détaillées dans le JSON.
- **Assura PreventoMed** : génériques et cancers sein/côlon/prostate sans franchise avec quote-part de 10 % ; tests diabète/cardiovasculaires en pharmacie partenaire sans franchise ni quote-part. FeminaVita possède son propre panier. Ne pas propager à Basis, QualiMed ou MediTel.
- **Helsana** : conseil pharmacie offert pour Flexmed, Telmed et PREMED-24 seulement ; BetterDoc offert aux modèles alternatifs. L'avis BetterDoc est facultatif chez Helsana, mais imposé pour spécialités listées chez Assura QualiMed.
- **Clubs** : myPoints et bonus BENEVITA exigent des complémentaires admissibles. Helsana+ annonce un changement de conditions au 01.01.2027. Let's Go Fitness, Sunclub Premium et certains bons Zur Rose Assura expirent au 31.12.2026. La vaccination rhenusana ne concerne qu'un événement en novembre 2026.
- **Agrisano** : avantages agricoles, aide au dépannage et fonds de rigueur ont des conditions de couverture distinctes ; aucun n'est un remboursement universel accessible à tout assuré.

## Questions opérateur prioritaires

1. Obtenir les annexes 2027 des exonérations PrimaFlex, PreventoMed, FeminaVita et les nouvelles conditions Helsana+.
2. Relier Sanitas 1–4, Helsana R1–R4 et sana24 MCMIT/MCOHNE aux listes exactes ; un suffixe R ne désigne pas une région OFSP.
3. Pour HS, distinguer EHC/KSBL et tout autre réseau par territoire.
4. Vérifier disponibilité/admission du médecin et des pharmacies à la date d'affiliation, distinctement de l'existence d'un tarif 2027.
5. Les petits assureurs ont bien été recherchés : absence de club trouvé n'est pas absence d'avantage. Le PDF scanné KKV a été lu visuellement (pages 2–4) ; il est daté 2024 et ne certifie pas les règles 2027.

Le registre OFSP utilisé pour les noms juridiques et groupes est [assureurs admis, octobre 2026](https://www.priminfo.admin.ch/downloads/assureurs-maladie-admis-2026-10.xlsx), également présent dans le snapshot local. Les services d'une marque du groupe ne sont pas automatiquement attribués aux autres entités : notamment myPoints Galenos/sana24 reste conditionné à l'accès LCA effectif.

Aucun fichier applicatif modifié. Aucune prime, franchise ou participation nouvelle calculée dans cet audit.
