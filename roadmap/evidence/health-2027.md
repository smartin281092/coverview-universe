# Comparateur maladie 2027 — livraison locale du 30 septembre 2026

Mandat : demande explicite de nouvelle page www, données Priminfo, prestations/clubs, carte et questionnaire. [Plan](../plans/health-2027.plan.md), [règles métier et maintenance](../../apps/api/src/modules/health-insurance/README.md). S-011 garde son statut, S-042a reste running ; aucune clôture générale ni nouvelle slice déduite. Session réelle GPT-6, effort non observable.

## Résultat

Route `/comparateur-assurance-maladie-2027`, liée depuis Explorer → Outils. Prévisualisation réelle sur `http://127.0.0.1:4103/comparateur-assurance-maladie-2027`, API publique locale sur 4100. Carte SVG des 42 régions officielles, survol/focus et sélection, trois primes les plus basses, recherche de commune/NPA, paramètres âge/accident/franchise, filtres de parcours/assureur/prestations, liste paginée et panneau de modèle avec couverture/prestations/club. Guide de 13 questions reprenant la composition de la capture : numéros cerclés, choix en lignes, ligne sélectionnée grise avec flèche, note, Ignorer et Envoyer.

L’objectif choisi influe sur le classement des franchises ; réserve, budget de soins et parcours infléchissent les scénarios. Les autres choix déclenchent des points de vérification sourcés. Texte libre éphémère, non transmis. Aucune recommandation clinique, souscription, collecte nominative ou simulation de tarif inventé.

## Données et provenance

Le snapshot actif est `hi_eb1eceb51a217fd4a4f4cd529e81`. [Archives originales et provenance](../../data/health-insurance/2027/sources.json), [rapport de qualité](../../data/health-insurance/2027/quality.json), [audit indépendant des sources](health-2027-source-audit.md).

| Objet importé | Quantité | Portée |
|---|---:|---|
| Primes | 219 916 | Toutes les lignes du CSV, dont 164 ZE/ZR archivées et non comparées sur la carte suisse |
| Modèles / assureurs | 153 / 32 | IDs OFSP et codes de tarif préservés |
| Localités/NPA | 5 468 | Choix par commune, pas déduction unique depuis un NPA ambigu |
| Régions | 44 archivées, 42 suisses | 26 cantons, 2 104 communes après mutations officielles 2027 |
| Disponibilités modèle/région | 4 992 | Restrictions communales conservées |
| Faits prestations/membres | 88 | 32 assureurs couverts partiellement, 26 modèles enrichis spécifiquement, 24 faits clubs/partenaires |

Les CSV de primes ne contiennent pas les prestations uniques et clubs. Ceux-ci proviennent de sources officielles d’assureurs avec URL, date, conditions et statut ; [audit séparé](health-2027-benefits-audit.md). **8 faits seulement sont explicitement confirmés pour 2027 : 7 présences et 1 absence.** Les 80 autres ne sont pas promus automatiquement à « confirmé ». Les données manquantes restent inconnues, jamais transformées en faux. La couverture n’est pas exhaustive, notamment pour les offres derrière un espace membre.

## Vérifié

| Contrôle | Résultat observé / oracle |
|---|---|
| Fichiers officiels | Publication 2027 réelle, empreintes originales vérifiées, montants Decimal → centimes exacts ; zéro doublon de grain, modèle/éligibilité manquant. Audit source relu indépendamment. |
| Migrations | 0019 et 0020 appliquées à PostgreSQL local. Aucune suppression, reset ni modification de données privées. |
| Import idempotent | Réexécuté sur le même snapshot, mêmes compteurs et 88 faits ; contrôles SQL de nombre, assureurs, disponibilité et absence de jointures orphelines avant commit. Dernier réimport après correction de l’actualisation des noms d’assureurs. |
| Âge / argent | 5 tests métier Vitest passent : frontières 2009/2008 et 2002/2001, soins nuls, sous/au-dessus de la franchise, plafonds adulte/enfant, centimes. Oracle : règles OFSP de participation ordinaire. |
| API + PostgreSQL | `node scripts/verify-health-live.mjs` : 26 assertions passent sur le catalogue réel. Aucun mock, fixture de prime ni dossier de personne. |
| Classement | VD-1 adulte 1990, sans accident, F2500 : 427.00 / 428.05 / 430.20 CHF ; GE : 449.60 / 465.60 / 466.20 CHF, valeurs du CSV vérifiées indépendamment. Pagination sans recouvrement, tri stable, accident et franchises effectifs. |
| Éligibilité | VIVA 370.30 CHF conditionnel en BE-2 sans commune, admis à Meikirch (307), exclu à Aarberg (301). Commune/région incohérentes refusées, régions ZE/ZR refusées. NPA 3053 conservé ambigu. |
| Filtres | Dépistage confirmé ne retient que TelMed Plus dans l’oracle VD. Gratuité totale satisfait aussi « sans franchise ». Génériques non confirmés 2027 non retenus. Pas de fausse prime zéro. |
| Guide | Pour CHF 10 000 de soins, F300 minimise le coût annuel et F2500 la prime mensuelle dans l’oracle VD ; réserve CHF 500 : aucun choix déclaré compatible. Libre choix → BASE ; filtres contradictoires → aucun scénario. |
| Navigateur bureau | CUA, viewport 1440×1100 : localité Lausanne, date saisie au clavier natif, exclusion accident, trois tarifs réels, 13 questions, calcul objectif prime, application franchise, filtres, détail TelMed Plus et sept prestations confirmées. |
| Navigateur mobile | CUA, viewport 390×844 : carte/paramètres/panneau Club lisibles, changement Grisons région 3, document sans débordement horizontal (375 px utiles pour viewport 390). Capture du panneau Sanitas Active avec « 2027 à confirmer ». |
| Accès au site | Après redémarrage et retour au viewport normal, navigation réelle Explorer → Outils → Comparateur maladie 2027 ; carte et trois primes chargées. Onglet laissé ouvert comme livrable. |
| Clavier / dialogues | Flèche du groupe radio change choix et focus ; ouverture/fermeture des panneaux, Escape restaure le focus du modèle. Les onglets ont navigation fléchée. Survol et recherche revus pour invalider les états périmés. |
| Revue indépendante | Deux passes du sous-agent sources : sept premiers constats corrigés, puis réserve inconnue et implication gratuité → franchise corrigées. Aucune nouvelle anomalie signalée sur prix et disponibilité. |
| Statique et compilation | ESLint ciblé passe ; typecheck API, www, contracts et api-client passe (www : 0 erreur/avertissement/hint) ; builds API et www passent, 43 pages générées. |
| Bundles | `node scripts/check-bundles.mjs` : 83 fichiers inspectés, aucune configuration serveur détectée. www reconstruit ; autres dist préexistants, aucune preuve de recette privée induite. |
| Roadmap | Sources canoniques mises à jour, vues régénérées ; `build-roadmap.mjs --check --require-complete` passe. Cela valide la cohérence documentaire, pas l’achèvement du programme. |

Ces tests ont été écrits dans cette livraison ; ils ne constituent pas une validation humaine indépendante. Les montants de référence, les sources et la revue statique ont néanmoins été examinés séparément. Les captures navigateur sont celles émises dans la conversation, pas des maquettes présentées comme des captures produit.

## Fait, non vérifié ou incomplet

- Exhaustivité des prestations/clubs, maintien 2027 des faits non confirmés, catalogue privé des membres et admission effective aux complémentaires. Aucune valeur de club déduite d’une prime.
- Déploiement public, DNS, proxy API et configuration de production, WorkOS en mode production, validation médicale/juridique spécialisée, validation humaine visuelle et test sur un appareil mobile physique.
- Recette générale de tout le dépôt. `boundaries` : aucune erreur de frontière, trois avertissements préexistants dans les contenus landing ; Knip reste en échec sur quatre fichiers préexistants `Closing.astro`, `Faq.astro`, `GuideVisual.astro`, `ResourceVisual.astro`. Les deux nouveaux outils CLI sont déclarés comme points d’entrée, pas ignorés arbitrairement.
- `check:www` préexistant adapté explicitement à un îlot Astro et ses deux scripts de démarrage sur cette seule route ; ses règles éditoriales restent inchangées. Le runner Playwright externe n’a pas été exécuté : recette UI via CUA conformément aux outils de cette session. Pas de résultat CI global au vert revendiqué.
- Performance terrain/LCP/INP/CLS non mesurés. Inventaire build : environ 203 048 octets gzip de JS pour le comparateur avec React, Zod et géométrie, 105 581 octets gzip de HTML ; cela dépasse le repère éditorial de 100 kB si l’îlot entier y est inclus. Pas de relèvement silencieux du budget CI. Optimisation ultérieure possible de la duplication de géométrie SSR/client.
- Changements laissés dans le checkout partagé non committé, qui contenait déjà de nombreux développements et la migration 0018. Aucun commit global ne mêle ces travaux, aucune PR ni publication créée. Les deux nouvelles migrations s’appuient sur l’état local existant.

## Exploitation et incidents résolus

Commandes canoniques dans le README du module. Le shim pnpm global ne lançait pas le runtime ; utilisation du binaire pnpm local vérifié, sans changer la configuration utilisateur. Node observé 24.13.1, inférieur au minimum déclaré 24.20 ; les commandes ci-dessus ont réellement passé, pas une validation de tous les environnements.

Maintenance/import et preview publique lancés avec `AUTH_ENABLED=false` uniquement dans le processus local, car `.env` active WorkOS sans ses secrets ici. `.env` et les permissions privées ne sont pas modifiés. Pas de clé ni donnée personnelle dans ce ledger. Les logs locaux omettent corps et query strings ; notes libres jamais envoyées.

L’ajout d’exports dédiés a laissé un cache de résolution périmé dans Vite : diagnostic dans les logs puis redémarrage du seul processus www créé pour cette tâche ; la route réelle fonctionne après rechargement. Un verrou transitoire sur `backlog.yaml` a empêché la première génération ; accès en écriture contrôlé puis génération réussie. Aucune boucle de relance ni suppression de cache globale.

Pas de nouvelle dépendance d’exécution. Génération géographique : pyshp 3.1.6, shapely 2.1.2 et numpy 2.5.3 dans un répertoire temporaire isolé, `openpyxl` déjà disponible. Versions, source swisstopo, conditions d’utilisation des géodonnées et reproduction décrites dans l’audit de carte.
