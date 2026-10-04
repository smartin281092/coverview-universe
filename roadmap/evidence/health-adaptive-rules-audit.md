# Audit indépendant — calcul santé et administration

Consultation : 1er octobre 2026. Périmètre : lecture du module `health-insurance`, de ses contrats, des frontières Admin existantes et des sources officielles ci-dessous. Aucun code modifié, aucune opération externe d’écriture. Cet audit étaye l’implémentation ; ce n’est pas une validation juridique de mise en production.

## Constats dans l’existant

- **Vérifié en lecture** : `health.cost.ts` calcule correctement la participation **ordinaire** : franchise effectivement consommée, puis 10 % de l’excédent avec plafond de quote-part de CHF 700 adulte / CHF 350 enfant. Le commentaire exclut expressément hospitalisation, maternité, médicaments majorés, exonérations propres au modèle, complémentaires et subsides.
- **À remplacer pour la nouvelle mission** : `health.repository.ts:guide` ne conserve que `comparison.offers[0]` à chaque franchise. Une offre initialement plus chère mais compatible ou utile ne peut donc jamais émerger. La nouvelle présélection doit conserver les offres susceptibles de devenir pertinentes après une réponse inconnue.
- **À remplacer** : `bestDeductible` cherche le premier scénario dont `reserveSufficient !== false`, assimilant la prudence à une exclusion. Le nouveau moteur doit séparer alerte de soutenabilité et contrainte expressément choisie.
- **Version à rendre explicite** : `healthYear`, le chargement du snapshot et plusieurs fonctions sont actuellement fixés à 2027. `healthDeductibles` ne reçoit pas l’année, malgré le paramètre facultatif de `healthAgeGroup`. Une année future doit être refusée si ses primes/règles manquent, jamais prendre les conditions 2027 par défaut. Les catégories d’âge testées actuellement correspondent bien au catalogue 2027.
- **Contrat insuffisant pour l’adaptation** : les réponses historiques sont des enums uniques, sans état non posé/ignoré/inconnu/refusé/inactif, et les dépenses sont obligatoires. Ne pas convertir leur contenu silencieusement en nouvelles exigences. Le montant de réserve historique ne permet pas de reconstituer une fourchette réellement déclarée.

## Sources effectivement consultées

Toutes les sources suivantes sont officielles. Les pages web ont été lues le 1er octobre 2026. Les PDF ont été téléchargés par `Invoke-WebRequest` dans un répertoire temporaire, extraits avec PDFium et les pages mentionnées ci-dessous ont été rendues et contrôlées visuellement.

| Référence | Version et localisation | Vérification / limite |
|---|---|---|
| [OFSP, Primes-Conseil 2027](https://www.bag.admin.ch/dam/fr/sd-web/ZUZ4kwDN4gnu/Primes-conseil%202027.pdf) | Couverture « Septembre 2026 » ; page PDF 5, section 3, économies/franchise ; 16 pages | Page 5 inspectée, y compris avertissement de réserve, contribution hospitalière et exemptions. SHA-256 `7bb181f9ebe68ae880babd735cdf786075cbf8282582c7f27c51ebaf98aac0ed`. |
| [Priminfo, FAQ](https://www.priminfo.admin.ch/fr/faq) | Sections participation aux coûts, franchises, maternité et médicaments ; site courant des primes 2027 | Confirme année civile du traitement, paliers possibles et liberté de l’assureur de ne pas proposer tous les paliers. |
| [OFSP, participation aux coûts](https://www.bag.admin.ch/fr/assurance-maladie-participation-aux-couts-pour-assures-domicilies-en-suisse) | Sections participation ordinaire / prestations exemptées | Page de règle générale actuelle ; ne constitue pas une preuve des exemptions commerciales d’un modèle particulier. |
| [OFSP, prestations en cas de maternité](https://www.bag.admin.ch/fr/assurance-maladie-prestations-en-cas-de-maternite) | Section participation aux coûts | Prestations spécifiques et période d’exemption de soins généraux ; aucune conclusion individuelle sans qualifier les soins et leur date. |
| [OFSP, quote-part différenciée](https://www.bag.admin.ch/fr/quote-part-differenciee-pour-les-medicaments) | FAQ 3, 7, 9, 10, 13, 22 ; valeurs prévues au 1er décembre 2026 | La Liste des spécialités à la remise reste déterminante. Ne pas traiter une liste de septembre 2026 comme figée pour toute l’année 2027. |
| [OFSP, FAQ médicaments PDF](https://www.bag.admin.ch/dam/fr/sd-web/-IX4fZik4WGr/antworten-auf-haeufig-gestellte-fragen-zum-differenzierten-selbstbehalt.pdf) | Pages 2-3, questions 7/9 ; page 6, tableau et astérisque | Tableau page 6 inspecté visuellement. SHA-256 `8faa940ad02a85d1c54b96df00123568370ffc0c0eed525421eb9402229bf9d7`. |
| [OFSP, suspension du risque accidents](https://www.bag.admin.ch/fr/assurance-maladie-assures-pouvant-suspendre-le-risque-accidents) | Conditions et procédure | Couverture LAA complète et preuve à l’assureur nécessaires ; une préférence pour une prime basse n’établit rien à ce sujet. |
| [OFSP, catégories de modèles 2027](https://www.bag.admin.ch/dam/fr/sd-web/uDId3CkEMIKj/PG27-FB-Neue%20Modellkategorien_FR.pdf) | 29 septembre 2026 ; pages 1-2 ; page 2 inspectée visuellement | Catégories générales, pas les conditions détaillées de chaque modèle. SHA-256 `875175b029f61c98ab04c67997cfef324175658d88920d4f049b2344375b1b8d`. |
| [Priminfo, téléchargements 2027](https://www.priminfo.admin.ch/fr/downloads/aktuell) | Répertoire Suisse et régions valables du 01.01.2027 au 31.12.2027 | La commune et son numéro OFS déterminent la région ; le NPA est une aide de recherche. |

Le téléchargement direct Python a échoué par fermeture de connexion ; la requête PowerShell normale a fonctionné. L’ouverture web du PDF Primes-Conseil a également échoué, mais son fichier a été obtenu et inspecté. Aucun accès restreint n’a été contourné.

## Règles de calcul et traitements prudents

### Participation ordinaire

En CHF, pour une dépense annuelle admissible `S`, une franchise `F`, une prime mensuelle `P` et un plafond ordinaire `C` :

`coût = 12 × P + min(S, F) + min(max(S − F, 0) × 0,10, C)`.

Utiliser des centimes entiers dans le code. La règle d’arrondi au centime est une convention du simulateur à documenter ; ne pas la présenter comme la reproduction exacte de l’arrondi de toutes les factures des assureurs. La date du soin détermine l’année de franchise. Chaque scénario doit être calculé séparément ; la fonction est non linéaire. Les paliers adultes sont 300/500/1000/1500/2000/2500 ; enfants 0/100/200/300/400/500/600, mais seuls les paliers réellement tarifés par le modèle sont comparables. [Priminfo, FAQ](https://www.priminfo.admin.ch/fr/faq)

Exemples indépendants pour des tests :

| Dépense CHF | Franchise CHF | Personne | Participation ordinaire CHF |
|---:|---:|---|---:|
| 0 | 2500 | Adulte | 0 |
| 299 | 300 | Adulte | 299 |
| 300 | 300 | Adulte | 300 |
| 2000 | 300 | Adulte | 470 |
| 7300 | 300 | Adulte | 1000 |
| 9500 | 2500 | Adulte | 3200 |
| 3500 | 0 | Enfant | 350 |
| 4100 | 600 | Enfant | 950 |

Les montants sont des exemples synthétiques, pas des dépenses d’utilisateurs ni des primes d’assureurs.

### Hors du plafond ordinaire

**Hospitalisation** : la contribution est de CHF 15 par jour facturable, sans jour de sortie, en plus des participations applicables. Les enfants jusqu’à 18 ans révolus, les jeunes jusqu’à 25 ans révolus en formation et les prestations de maternité bénéficient d’exemptions. Ne pas utiliser seulement l’année de naissance pour décider un jour d’hospitalisation près d’un anniversaire. Si les jours facturables ou l’exemption manquent, produire un coût partiel explicite ou un résultat non évaluable pour cette composante. [Primes-Conseil 2027, p. 5](https://www.bag.admin.ch/dam/fr/sd-web/ZUZ4kwDN4gnu/Primes-conseil%202027.pdf)

**Maternité** : les prestations spécifiques sont exemptées ; l’exemption des soins médicaux généraux s’étend de la treizième semaine jusqu’à huit semaines après l’accouchement selon la page officielle consultée. Un simple « oui » ne signifie pas que toutes les dépenses annuelles sont exemptées. Sans répartition admissible/date, ne pas optimiser définitivement la franchise sur le total non ventilé. Conserver le tri des primes, indiquer le calcul ordinaire à titre de scénario limité et marquer le coût complet non évaluable. Ce traitement ne nécessite pas de demander un diagnostic. [OFSP, maternité](https://www.bag.admin.ch/fr/assurance-maladie-prestations-en-cas-de-maternite)

**Médicaments majorés** : la majoration peut aussi concerner génériques/biosimilaires. La preuve dépend de la LS au moment de la remise et d’exceptions documentées. Un modèle imposant des génériques peut prévoir d’autres conséquences contractuelles. Une réponse générale Q8 n’établit ni le taux du traitement ni une exonération ; retourner « à vérifier » sans créer d’économie certaine. [OFSP, quote-part différenciée](https://www.bag.admin.ch/fr/quote-part-differenciee-pour-les-medicaments)

Le tableau officiel après franchise montre trois achats de CHF 1000 : participations de 400, 400, puis 320 ; imputation au plafond de 250, 250, puis 200. Total effectivement payé CHF 1120, plafond imputé CHF 700. Les 25 % désignent la part des frais imputable, **pas 25 % de la somme payée**. Avec des soins ordinaires et médicaments mélangés, l’ordre de consommation de franchise/plafond peut compter : ne pas appliquer 40 % à tout, ni plafonner systématiquement le paiement effectif à 700. Sans répartition ou scénario d’ordre documenté, préférer une composante non évaluable. [OFSP, FAQ PDF p. 6, astérisque compris](https://www.bag.admin.ch/dam/fr/sd-web/-IX4fZik4WGr/antworten-auf-haeufig-gestellte-fragen-zum-differenzierten-selbstbehalt.pdf)

**Réserve** : CHF 3200 est le maximum **ordinaire** adulte à franchise 2500, pas un plafond universel de frais. Pour une fourchette `[min,max]`, afficher suffisant seulement si son minimum couvre le besoin ordinaire ; insuffisant si son maximum est inférieur ; sinon indéterminé. Une limite supérieure ouverte reste ouverte. Ne pas remplacer cette réponse par le maximum de la fourchette, ni modifier les soins prévus. L’exclusion exige une contrainte explicite ; sinon l’offre garde son prix et reçoit une alerte justifiée.

### Exonérations et avantages combinés

Recommandations d’implémentation issues de cet audit :

- Un plafond documenté réduit remplace le plafond de la composante concernée ; il n’est jamais retranché forfaitairement. À franchise 300 et soins 1000, ramener le plafond de quote-part de 700 à 300 n’économise rien : la quote-part consommée n’est que 70. À soins 10000, l’économie devient 400.
- Une exonération de franchise n’établit pas une exonération de quote-part. Séparer ces effets et les dépenses auxquelles ils s’appliquent. Si l’ordre des soins exemptés et ordinaires influence le résultat et n’est pas connu, proposer des scénarios/limites explicites.
- Dédupliquer un même service, un même panier ou un même avantage foyer avant toute valorisation. Aucune économie sur les primes ne provient d’un rabais commercial périphérique.
- Les plafonds familiaux communs et les rabais de fratrie exigent la composition et l’assureur juridique commun vérifiés. Le fichier actuel utilise K1 pour les enfants ; ne pas présenter sa somme comme un tarif familial complet quand K3/K4/K5 ou le plafond familial pourraient changer la décision. La règle de plafond familial est mentionnée dans Primes-Conseil p. 5, mais les combinaisons de franchises nécessitent une spécification juridique plus détaillée avant calcul automatisé.
- Coût net après subside : seulement montant/droit vérifiés pour le canton et l’année. Faute de cela, conserver « avant subside » ; aucune pénalité d’adéquation.
- Scinder qualité des preuves contractuelles et réponse personnelle. Une source contradictoire va à l’opérateur, pas dans une question à l’utilisateur.

### Compatibilité des parcours et accident

PRAXIS regroupe notamment médecin de famille et HMO ; TEL_DIG englobe téléphone **ou** numérique ; FLEX indique plusieurs premières portes, sans garantir leur composition. Une catégorie seule ne prouve pas que chaque contact coché est proposé, ni qu’un médecin précis est admis. La documentation du modèle doit établir les canaux, leurs obligations, les exceptions et les réseaux. Les choix acceptables sont des alternatives ; une exigence « plusieurs portes » est une réponse distincte. [OFSP, catégories 2027 p. 1-2](https://www.bag.admin.ch/dam/fr/sd-web/uDId3CkEMIKj/PG27-FB-Neue%20Modellkategorien_FR.pdf)

La suspension de la couverture accident exige une couverture LAA professionnelle et non professionnelle complète ; l’OFSP mentionne au moins huit heures hebdomadaires chez un employeur, avec demande et preuve à l’assureur. Ni l’objectif de prime minimale ni un simple statut professionnel n’autorisent une suppression silencieuse. Si `accident=false` et la preuve est inconnue, le tarif reste disponible sous hypothèse, mais la compatibilité est à vérifier. [OFSP, suspension du risque accidents](https://www.bag.admin.ch/fr/assurance-maladie-assures-pouvant-suspendre-le-risque-accidents)

### Statuts recommandés

Conserver séparément `tariffAvailable`, `compatibility`, `financialEvaluability` et `sourceVerification`. Le calcul peut retourner une prime complète, un coût ordinaire sous hypothèse, une composante spéciale non évaluable et une recommandation provisoire. L’absence d’un avantage facultatif documenté ne doit pas bloquer à elle seule un objectif de prime minimale ; une compatibilité de réseau déterminante inconnue le peut.

## Intégration minimale à Admin

Chemin vérifié : `apps/admin/src/router.tsx` contient des routes lazy ; `AppShell.tsx` la navigation ; les libellés passent par les namespaces i18n. `InsuranceRequestsPage` utilise `AdminBoundary`, TanStack Query et les composants du design system. La nouvelle configuration peut reprendre cette structure, sans nouvel outil d’administration externe.

1. **Toutes les lectures privilégiées**, y compris export et simulation de configuration brouillon : appeler `identity.authenticateAdministrator(request)` puis `identity.auditAdministratorAccess(request, null, resource, action)` côté API. Un chemin sous `/admin` n’est pas une autorisation.
2. **Toutes les écritures** : appeler `identity.checkMutation(request)` avant traitement, puis authentifier l’administrateur. Ce helper vérifie Host, Origin autorisée, cookie canonique, CSRF lié à la session et `Idempotency-Key` UUID. Ne pas employer le cookie invité des demandes d’offre pour ces écritures.
3. **Transaction de publication / retour arrière / résolution opérateur** : revalider les droits et la MFA sous verrou. Le précédent `insurance-requests.repository.ts:transition` utilise `lockProfileActor(tx, { ...actor, administratorUserId: actor.userId })`, verrouillant le profil propre de l’administrateur et relisant utilisateur, session, révocation et permission. Ajouter contrôle de révision, empreinte du contenu, acteur et clé unique pour les commandes ; un UUID valide seul ne rend pas une opération idempotente.
4. **Autorisation réelle** : `requireAdministration` impose la permission locale `administration.access` et une preuve MFA de session de moins de 24 heures. La sélection de la surface Admin, une adresse email ou un objet WorkOS ne confère pas la permission. `AUTH_ENABLED=false` refuse par 503 ; aucun bypass de preview.
5. **Cache UI** : clés privées incluant user/session, `enabled: !blocked`, aucun résultat sensible affiché pendant revalidation, données annulées/nettoyées à la perte de session. Cette protection complète l’API sans la remplacer.
6. **Historique et retour arrière** : versions immuables et activation transactionnelle d’une version autorisée ; pas de suppression des anciennes preuves. Le moteur renvoie les versions exactes utilisées pour que la simulation soit reproductible. Les profils fictifs du simulateur restent séparés des dossiers clients et des pièces opérateur.

## Oracles à ajouter à la réalisation

- Calculs : seuils franchise/plafond, valeurs nulles distinctes de zéro, scénarios non linéaires, plafond réduit consommé seulement, médicaments et maternité non évaluables sans informations adéquates, réserve en intervalle sans exclusion implicite.
- Compatibilité : professionnel indispensable incompatible jamais compensé ; canaux inconnus ne deviennent pas compatibles ; réponse inchangée/sans effet conserve l’ordre.
- Année : condition 2026 exclue du moteur 2027 même si le nom de modèle correspond ; source courante sans période non promue silencieusement en preuve annuelle.
- Admin : anonyme 401, utilisateur sans permission 403, administrateur sans MFA fraîche 403, droit retiré pendant une publication refusé, CSRF/Origin/Host faux refusés, replay identique unique, réutilisation de clé avec autre contenu refusée, concurrence de révisions 409. Tester aussi accès direct à export/simulation, pas seulement visibilité du lien.

Statut de ce document : **lecture et sources vérifiées** ; propositions de calcul prudent et d’intégration **à valider par les tests de l’implémentation**. Aucun nouveau test ni parcours Admin authentifié exécuté dans cet audit.

## Complément du 1er octobre 2026 — socle légal des sept exonérations TelMed Plus 2027

Mandat borné : vérifier les paniers Sanitas du fichier `data/health-insurance/2027/research/review-b.json`, sans modification du code. La page unique de la [liste Sanitas, valable dès le 01.01.2027](https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/KOBE_Befreiung_TelMed_fr.pdf) a été extraite puis inspectée visuellement : les sept croix sont dans la colonne **TelMed Plus**, pas TelMed Basic. Les exemptions concernent franchise et quote-part, sous les conditions propres à chaque ligne. Elles ne prouvent pas que l’intégralité de cette économie soit supplémentaire au socle légal.

### Mapping à appliquer à tous les candidats avant les particularités du modèle

Le tableau distingue l’exemption attachée au panier, indépendamment d’une franchise déjà épuisée, du plafond de quote-part déjà atteint ou d’une autre exemption personnelle applicable. « Aucune exemption générale identifiée » ne signifie pas qu’une prestation est nécessairement facturée.

| Panier de la liste Sanitas | Socle légal commun : franchise | Socle légal commun : quote-part | Différentiel potentiel TelMed Plus et contrôle |
|---|---|---|---|
| Premier conseil en pharmacie partenaire | Aucune exemption générale identifiée pour tout conseil de pharmacie | Aucune exemption générale identifiée | La gratuité documentée vaut dans les pharmacies partenaires. Ne pas inventer une facture AOS chez les autres candidats ni valoriser comme payant un conseil déjà accessible gratuitement. Prix et nature du service comparé nécessaires. |
| Consultation médicale du centre télémédical | Régime ordinaire pour une consultation AOS ; ne pas la confondre avec un triage non facturé | Régime ordinaire | Exonération contractuelle des deux composantes pour le centre prévu ; un accès à une plateforme ou un appel de triage n’établit pas une consultation médicale payante ailleurs. |
| Vaccination admissible OPAS 12a et conseil correspondant | **Exonérée pour tous** depuis le 01.01.2026 | **10 %**, dans le plafond ordinaire applicable | Seule la quote-part résiduelle peut constituer une économie supplémentaire. Ne jamais valoriser une exemption supplémentaire de franchise. |
| Examen gynécologique préventif OPAS 12e b | Régime ordinaire | Régime ordinaire | Exonération des deux composantes potentiellement différenciante, uniquement sur l’examen admissible. Deux premiers examens annuels, puis tous les trois ans en cas de résultats normaux ; ne pas confondre avec les contrôles spécifiques de maternité déjà exonérés. |
| Mammographie OPAS 12e c, **programme organisé admissible** | **Exonérée pour tous** | **10 %**, dans le plafond ordinaire applicable | Différentiel limité à la quote-part résiduelle. Conditions : dès 50 ans, périodicité de deux ans et programme conforme. |
| Mammographie OPAS 12d d, risque documenté, **hors programme exonéré** | Régime ordinaire | Régime ordinaire | Exonération des deux composantes potentiellement différenciante. L’exemption d’une mammographie n’établit pas celle d’une IRM ni des examens additionnels. |
| Coloscopie OPAS 12e d, **programme cantonal admissible** | **Exonérée pour tous** | **10 %**, dans le plafond ordinaire applicable | Différentiel limité à la quote-part résiduelle. Tranche d’âge 50–74 ans ; coloscopie tous les dix ans ou après résultat positif du test de selles admissible. Vérifier l’inscription et les actes réellement inclus au programme. |
| Coloscopie préventive OPAS 12e d **hors programme exonéré**, ou risque OPAS 12d b | Régime ordinaire | Régime ordinaire | Exonération des deux composantes potentiellement différenciante. Ne pas étendre à une coloscopie diagnostique quelconque, aux médicaments de préparation ou à une anesthésie sans preuve de leur périmètre. |
| Médicaments ménopause nommés par Sanitas | Régime ordinaire ; aucune exemption générale propre à cette indication identifiée | Régime applicable au médicament, éventuellement majoré | Limiter aux produits explicitement listés, admis dans la LS et autorisés par Swissmedic. Le médicament exact et le taux applicable doivent être établis avant un calcul certain ; aucun bonus « tous médicaments ménopause ». |

Sources du socle : [OPAS consolidée, état affiché au 01.01.2027, art. 12a, 12d et 12e, pages 23–24 et 29–33](https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1995/4964_4964_4964/20270101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1995-4964_4964_4964-20270101-fr-pdf-a.pdf), à compléter impérativement par le [RO 2026 336, art. 12a et 12e, pages 2 et 6](https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/oc/2026/336/fr/pdf-a/fedlex-data-admin-ch-eli-oc-2026-336-fr-pdf-a.pdf), pour la divergence décrite ci-dessous. Le maintien de la quote-part après exemption vaccinale est explicite dans la [FAQ officielle OFSP sur les vaccinations](https://www.bag.admin.ch/fr/vaccinations-prophylactiques). Les autres taux relèvent des [règles officielles de participation aux coûts](https://www.bag.admin.ch/fr/assurance-maladie-participation-aux-couts-pour-assures-domicilies-en-suisse).

Les programmes colorectaux nommés par le RO 2026 336 sont BL, BS, BE, FR, GE, **GL**, GR, JU, LU, NE, SG, SO, TI, UR, VD, VS. Le canton de résidence ne suffit pas à prouver la participation au programme. Une réponse générique « mammographie » ou « coloscopie » ne permet pas de choisir silencieusement le régime le plus favorable au modèle : il faut une qualification du panier, ou des scénarios séparés/une valeur non évaluable.

### Changements adoptés pour 2027 et divergence de sources à tracer

Le [RO 2026 336](https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/oc/2026/336/fr/pdf-a/fedlex-data-admin-ch-eli-oc-2026-336-fr-pdf-a.pdf), pages 1–2 et 8, introduit au 01.01.2027 la prise en charge des vaccinations OPAS 12a réalisées par les pharmaciens qualifiés et autorisés par le canton, pour les personnes âgées d’au moins 16 ans. Certaines situations nécessitent une prescription. Il modifie aussi la clause LS de l’art. 12a, al. 5. Le [commentaire officiel OFSP, pages 3–4](https://www.bag.admin.ch/dam/fr/sd-web/hB7uwEMylr2J/Commentaire%20des%20modifications%20de%20l%27OPAS%20pour%20le%201.7.2026%20et%201.1.2027.pdf) explicite la suppression de l’exigence de programme cantonal HPV à cette date, avec maintien du groupe 11–26 ans. Ne pas importer les anciennes restrictions depuis la page générique OFSP, qui les affiche encore lors de cette consultation.

**Dossier source à intégrer à la file opérateur — `OFSP-2027-OPAS-CONSOLIDATION-336`** :

- Périmètre : tous les assureurs et modèles 2027 pour le socle vaccinal/colorectal ; effet différentiel direct sur Sanitas, modèle TelMed Plus `hm_e302cd84bf5d000ed188a0845ea6`.
- Confirmé : le RO ajoute Glaris à la liste des programmes exonérés, effet au 01.07.2026 (pages 6 et 8), et contient les modifications vaccinales ci-dessus.
- Divergence observée : le PDF consolidé portant « État le 1er janvier 2027 » conserve la liste de quinze cantons sans GL (page 33), ainsi que l’ancienne exception HPV à la clause LS (page 24). Le document consolidé du 01.07.2026 présente aussi ces anciennes dispositions. Ce constat porte sur les fichiers effectivement téléchargés ; aucune cause technique n’est présumée.
- Traitement proposé : versionner explicitement le socle avec les articles du RO publié et leurs dates d’entrée en vigueur ; conserver le constat de divergence et ne pas promouvoir automatiquement le texte consolidé en unique vérité. Les conditions individuelles d’accès restent distinctes de cette qualité de source.
- Impact : faux coût comparatif si une franchise vaccinale/colorectale est attribuée au socle, ou fausse inéligibilité si les anciennes règles pharmacie/HPV sont réutilisées.
- Question opérateur : confirmer la consolidation applicable et la référence vaccinale 2027 ; contrôler que les articles du RO 2026 336 sont intégrés dans la version publiée du moteur.
- Action : revue juridique/données et vérification des futures versions Fedlex/OFSP. Priorité **bloquante pour toute règle contradictoire utilisée dans un coût certain** ; statut **ouvert** ; responsable **à affecter (référent juridique/catalogue Admin)**. Historique : constat et inspection des PDF le 01.10.2026 ; aucun contact externe effectué.

### Oracle financier conseillé

Pour le cas ordinaire à 10 %, avec paniers disjoints `O` (soins soumis à franchise), `V` (soins légalement exonérés de franchise seulement), `Z` (soins exonérés des deux), franchise `F` et plafond de quote-part `C` :

`participation = min(O, F) + min(C, 0,10 × max(O − F, 0) + 0,10 × V)`.

`Z` ne consomme ni franchise ni quote-part. Les exemptions du modèle transforment les paniers avant ce calcul ; leur économie est la différence entre deux calculs complets, jamais la somme des montants affichés. Cette formule ne couvre pas la quote-part majorée, les coûts hors AOS, les contributions hospitalières ou les situations spéciales déjà signalées plus haut.

Exemples synthétiques à tester : 300 CHF de vaccination admissible et aucun autre soin, adulte F=2500 → socle commun 30 CHF, TelMed Plus 0 CHF, différentiel 30 CHF. Si 10000 CHF de soins ordinaires s’ajoutent, le plafond de 700 CHF est déjà atteint dans les deux offres → différentiel vaccinal 0 CHF. Pour un examen de 300 CHF déjà exonéré de franchise dans un programme, ne jamais économiser à nouveau ces 300 CHF sur la franchise.

### Empreintes de preuve

Les pages contenant les tableaux, conditions et dates d’entrée en vigueur ont été rendues puis inspectées visuellement. SHA-256 des fichiers consultés :

| Document | SHA-256 |
|---|---|
| Liste Sanitas TelMed 2027, page 1 | `a16ae9b2ce7b8eed4fe33049216ec6af55920402334feec2f433fec696067037` |
| Commentaire OFSP 2026/2027, pages 3–4 et 6 | `617f74927c481ffd666098d2313daa25af2393aa2c7135c092268d5938ef5fd7` |
| OPAS consolidée affichant l’état au 01.01.2027, pages 24 et 33 | `4e01eb25ea4c84d423abd5250586e4b1b217e176ada5120f683e017f06605e07` |
| RO 2026 336, pages 6 et 8 notamment | `73ef3dfe259b5067d8cf1d4ff8175cc61a432bf81d6cbb0d18cdca98d634e567` |

Statut du complément : **sources et divergence vérifiées** ; traduction en règles et oracles **proposée, aucun code modifié**. L’examen est borné aux sept paniers ; il ne constitue pas une revue de l’intégralité des règles OPAS, des actes associés ni des autres modèles.
