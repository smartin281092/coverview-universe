# Décisions à instruire — lecture de la bible

Ce registre conserve les inconnues de la source pour préparer les futurs plans. Il ne demande pas de les résoudre toutes pour terminer l’initialisation et ne leur attribue pas de défaut métier inventé. Chaque slice devra charger les lignes qui affectent ses règles, permissions, finances ou activation et rendre son périmètre concret. Les textes exhaustifs de [R16](bible.extracted.md#p1729) et [§94](bible.extracted.md#p2896) restent dans l’inventaire.

## Arbitrages déjà donnés par le porteur du projet

La commande shadcn, WorkOS/projet coverview, hébergement Infomaniak protégé, domaine, données fictives de départ, charte et règles d’ouverture des détails relèvent de [PROJECT](../../PROJECT.md) et des satellites canoniques : DOC-16, AUTH-11, FRONT-14, ENV-09. Ils ne doivent pas être redemandés sous prétexte qu’un choix générique du harness ou une proposition de la bible diffère.

La [page scrollable et le progressive disclosure de §45](bible.extracted.md#p0946) décrivent des vues et une progression ; leur réalisation doit respecter FRONT-14. La demande du porteur n’interdit pas une page détaillée distincte, mais elle modifie le comportement d’ouverture de contenu. L’authentification [email/OTP et continuité de §30](bible.extracted.md#p0742) doit être examinée avec AUTH-11 pour conserver le parcours source dans WorkOS ; aucun fournisseur concurrent ne doit être réintroduit.

## Ambiguïtés et limites de portée à rendre explicites

| ID | Constat et conséquence pour la planification | Source |
|---|---|---|
| bible.question.001 | Le porteur veut couvrir l’ensemble de la bible en v1 ; la source qualifie Exchange de futur et hors MVP principal, Group Wrapped de conditionné à l’usage individuel, RPG de bonus et distribution B2B de phase ultérieure. Conserver ces capacités dans la couverture ; distinguer préparation/prototype/développement et activation sous les réserves métier de la source. Ne pas interpréter « tout implémenter » comme une validation juridique déjà acquise ni supprimer ces éléments du backlog. | [§12](bible.extracted.md#p0294), [§61–62](bible.extracted.md#p1304), [R12](bible.extracted.md#p1636), [§71](bible.extracted.md#p2197) |
| bible.question.002 | La ligne R15 sur Commerce mentionne « facturation séparée des simulations » alors que R11, R12 et la DoD interdisent la facturation par simulation après achat. Signaler l’ambiguïté de cette formulation ; ne pas créer une facturation à l’usage. Les conditions commerciales précises restent à définir. | [p1727](bible.extracted.md#p1727), [p1632](bible.extracted.md#p1632), [p1638](bible.extracted.md#p1638), [p2893](bible.extracted.md#p2893) |
| bible.question.003 | Le PDF autonome `[RET-1]` est cité comme source de 7 pages mais seul le DOCX est présent dans `references`. Sa reprise est complète dans R1–R13 selon la bible ; cette concordance avec l’original ne peut pas être vérifiée ici. Conserver cette limite de preuve, sans bloquer l’indexation des exigences déjà fournies. | [p0092](bible.extracted.md#p0092), [p1383](bible.extracted.md#p1383), [p3053](bible.extracted.md#p3053) |
| bible.question.004 | Langues UI/locales non spécifiées. Le document français, Genève/Suisse et CHF situent le contexte mais ne valident pas une liste FR/DE/IT/EN. Les langues de transcription restent explicitement ouvertes. Choisir la stratégie i18n au plan concerné. | [p0729](bible.extracted.md#p0729), [p2922](bible.extracted.md#p2922) |

## Questions métiers regroupées de §94

Ces groupes couvrent les 39 sujets individuels `p2897` à `p2935` ; `p2936` renvoie aux 12 sujets Retire de R16, conservés ci-dessous. La synthèse ne remplace pas le texte exact.

| ID | Décision nécessaire avant le comportement concerné | Ancrages source |
|---|---|---|
| bible.question.005 | Choisir fournisseur et niveau de signature par type de document ; valider le périmètre légal de chaque mandat/procuration et la preuve nécessaire. | [p2897](bible.extracted.md#p2897), [p2906](bible.extracted.md#p2906) |
| bible.question.006 | Définir conservation des pièces d’identité et documents médicaux, ainsi que rétention/export/suppression des conversations et modalités de partage avec CoverView. | [p2898](bible.extracted.md#p2898), [p2928](bible.extracted.md#p2928) |
| bible.question.007 | Définir méthode probabiliste, corrélations, CoverView Score/pondérations, Investment Age et cohortes de benchmark ; seuils de confiance de la revue humaine. Les exemples de scores/précision/trajectoires ne sont pas des calibrations validées. | [p2899–p2902](bible.extracted.md#p2899), [p2908](bible.extracted.md#p2908), [§57](bible.extracted.md#p1207) |
| bible.question.008 | Fixer le modèle de ménage/objectifs partagés, les relations et consentements d’accès par membre ; droits d’édition/publication depuis Intelligence et visibilité des activités/finances selon rôle. Aucun accès implicite à tout le foyer. | [p2903–p2904](bible.extracted.md#p2903), [p2915](bible.extracted.md#p2915), [p1698](bible.extracted.md#p1698) |
| bible.question.009 | Spécifier workflow/email ingress et modèle Project/Case/Task : templates, états, SLA, priorités, prochaine action, responsable et exceptions. Les technologies retenues par le harness sont des choix d’ingénierie ; elles ne définissent pas les règles métier manquantes. | [p2905](bible.extracted.md#p2905), [p2911](bible.extracted.md#p2911) |
| bible.question.010 | Définir étapes commerciales, probabilités/scoring, pipeline et statuts de revenus/commissions, granularité/fréquence/gouvernance des objectifs et forecasts. Aucun revenu pondéré ne devient un encaissement. | [p2909–p2910](bible.extracted.md#p2909), [p2914](bible.extracted.md#p2914) |
| bible.question.011 | Délimiter Gmail/Calendar : comptes, labels, calendriers, rétention et permissions ; déduplication, rapprochement, conflits et sens de synchronisation. Aucun périmètre de boîte privée n’est déduit d’une connexion existante. | [p2912–p2913](bible.extracted.md#p2912) |
| bible.question.012 | Définir emplacement/nom du copilote et partage/mémoire/contexte maximal ; fournisseurs LLM, résidence/rétention/réutilisation des données ; citations et comportement de contradiction ; protection contre injections. | [p2916–p2917](bible.extracted.md#p2916), [p2919–p2921](bible.extracted.md#p2919) |
| bible.question.013 | Définir le premier registre d’actions IA et ses schémas, niveaux lecture/brouillon/exécution/confirmation/interdiction, seuils de confiance, annulation et compensations. Les permissions du produit ne sont pas celles de l’agent de développement. | [p2918](bible.extracted.md#p2918), [p2924–p2925](bible.extracted.md#p2924) |
| bible.question.014 | Choisir transcription, langues, vocabulaire/noms propres et rétention audio ; préciser mobile/PWA, éventuel hors ligne et synchronisation de brouillons. | [p2922–p2923](bible.extracted.md#p2922) |
| bible.question.015 | Définir nom/ton de l’assistant client, catégories de réponse, hiérarchie contractuelle exacte, seuils et escalades obligatoires ; traiter les sources/versions/faits manquants sans conclusion inventée. | [p2926–p2927](bible.extracted.md#p2926), [§67.4–67.5](bible.extracted.md#p1829) |
| bible.question.016 | Choisir fournisseur de pass, champs/design/deep links/mises à jour/révocation ; format/rotation/expiration des jetons et scanners/POS ; résoudre l’éventuel hors ligne sans contredire la validation serveur des opérations sensibles. | [p2929–p2930](bible.extracted.md#p2929), [p1950](bible.extracted.md#p1950) |
| bible.question.017 | Fixer unité Miles, barèmes de gain, expirations/plafonds/tiers/transférabilité/reprises et règles comptables/financement/TVA/fiscalité/settlement ; la source fournit un ledger et des cas possibles, aucun barème chiffré complet. | [p2931–p2932](bible.extracted.md#p2931), [§67.8](bible.extracted.md#p1905) |
| bible.question.018 | Définir catalogue rewards initial, Miles+cash, stock/voucher/réservation/annulation/no-show/support ; onboarding/validation/droits/fraude/litiges partenaires ; valider avantages liés aux contrats, assurances offertes et cashback avant leur activation. | [p2933–p2935](bible.extracted.md#p2933) |
| bible.question.019 | Qualifier et valider Exchange, gestion des fonds/engagements, règlement, limites et responsabilités ; garder le domaine isolé et les intégrations autorisées explicites. | [p2907](bible.extracted.md#p2907), [§12](bible.extracted.md#p0294), [workflow K](bible.extracted.md#p2731) |

## Douze arbitrages Retire de R16

| ID | Question de la source et impact | Ancrage |
|---|---|---|
| bible.question.020 | Profils 10 000 / 100 000 : exécution, coût, convergence et seuils ; la cible ne vaut pas N exécuté. | [p1733–p1734](bible.extracted.md#p1733) |
| bible.question.021 | Réussite 50 % / 80–90–95–99 % : événements et horizon ; Target Age d’accumulation distinct du revenu soutenable. | [p1735–p1736](bible.extracted.md#p1735) |
| bible.question.022 | Durée rapide 25 ans versus longévité : distributions, couple, décès, horizon et paramètres démographiques. | [p1737–p1738](bible.extracted.md#p1737) |
| bible.question.023 | Allocation 80/17/3 versus cibles de flux Income/Safety : priorité, initialisation et recalibrage ; ni pourcentages universels ni rééquilibrage inventé. | [p1739–p1740](bible.extracted.md#p1739) |
| bible.question.024 | High-water mark et inflation : règle 4 % source versus inflation personnalisée ; traitement des apports/retraits et bonus de récupération. | [p1741–p1742](bible.extracted.md#p1741), [p1562–p1564](bible.extracted.md#p1562) |
| bible.question.025 | Retirement Range : association plancher/recommandé/prospérité aux seuils non fournie ; ne pas déduire arbitrairement une correspondance. | [p1743–p1744](bible.extracted.md#p1743) |
| bible.question.026 | EMS activé par défaut et phases Life : profondeur disponible initialement, budgets nets, données/coûts et expérience publiable. | [p1745–p1746](bible.extracted.md#p1745), [p1472](bible.extracted.md#p1472) |
| bible.question.027 | Plan permanent/recalculs/Care : droits, résultats conservés, accès à échéance/résiliation, recalculs inclus et frontière monitoring/revue humaine. | [p1747–p1748](bible.extracted.md#p1747), [p1632](bible.extracted.md#p1632) |
| bible.question.028 | Indicateurs/optimisation : fiscalité, actualisation, coûts/dettes, ruine, patrimoine transmis, vente forcée, marge et break-even ; définir méthodes, calibration, fréquence et poids des stress avant tout résultat crédible. | [p1749–p1750](bible.extracted.md#p1749), [p1608](bible.extracted.md#p1608) |
| bible.question.029 | LPP/EMS/Lombard : sources et règles de caisse réelles, survivants, dépendance/prestations, conditions de crédit et validations ; simulation distincte de décision et exécution. | [p1751–p1752](bible.extracted.md#p1751), [p1542](bible.extracted.md#p1542) |
| bible.question.030 | Conditions des tarifs : TVA, nombre/durée rendez-vous, livrable expert, renouvellement, annulation/facturation ; prix stratégiques pas encore offre commercialisée. | [p1753–p1754](bible.extracted.md#p1753), [R11](bible.extracted.md#p1609) |
| bible.question.031 | Distribution/fidélité Retire : commissions, employeurs, white-label, Miles/rewards/remises ; aucun barème automatique ni droit partenaire sur données de foyer. | [p1755–p1756](bible.extracted.md#p1755), [p2185](bible.extracted.md#p2185) |

Les conventions de drawdown (base, frontières inclusives, dernier recours), fréquence d’arbitrage, taxonomie look-through et périmètre des plafonds sont aussi explicitement ouverts dans [R6](bible.extracted.md#p1518) et [R8](bible.extracted.md#p1564). Elles relèvent du même ensemble modèle/Cascade, à porter dans les critères de la slice concernée. Ni faux barème ni équation financière non spécifiée ne doivent être présentés comme ayant été validés par cette analyse.

## Risques concrets pour la future roadmap

La dépendance la plus forte est la traçabilité des données : un score, une réponse de couverture et un plan Retire ont besoin d’objets canoniques, de versions, de sources et de droits avant de produire une décision interprétable. Des fixtures cohérentes permettent de construire les parcours et les états pendant que ces sources/méthodes sont définies, en appliquant ENV-09.

Les risques financiers se concentrent sur la sémantique des métriques, les méthodes non calibrées, les droits commerciaux, le crédit d’upgrade, la double dépense Miles et les conditions d’activation. Les risques de confidentialité se concentrent sur les membres d’un foyer, le rapprochement documentaire, les conversations et les partenaires. Les risques opérationnels se concentrent sur la perte d’une prochaine action, les erreurs de synchronisation silencieuses et les workflows non idempotents. Ils doivent conduire à des oracles ciblés dans les slices concernées, pas à déclarer toute la roadmap bloquée.
