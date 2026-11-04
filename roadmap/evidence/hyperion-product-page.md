# Page produit Hyperion — livraison du 4 novembre 2026

Mandat : demande de l’utilisateur du 4 novembre 2026 (page produit « à la Décathlon » pour Hyperion, 3e pilier à stratégie CoverView porté par Liechtenstein Life). [Plan et décisions H-1 à H-12](../plans/hyperion-product-page.plan.md). Session réelle : Claude Code, Claude Fable 5.1, effort max.

## Ledger

| Élément | Statut | Oracle et portée |
| --- | --- | --- |
| Page `/hyperion-3e-pilier` : galerie, bloc d’achat, avantages, fiche technique, performances, simulateur, captures, avis, FAQ, commande | Vérifié | Astro Check (121 fichiers, 0 erreur, 0 avertissement), build (46 pages), `check-www` réussi : 45 pages, 0 orpheline, FAQ HTML = JSON-LD, liens et ancres contrôlés |
| Moteur Hyperion : rendements nets, taux annualisé, projection, retenues, Monte Carlo reproductible | Vérifié | 10 tests Vitest (`hyperion-model.test.ts`) : 19,04 % brut 2016 – 2025 et 18,00 % net 2016 – 2026 retrouvés (valeurs horizon3), récurrence mensuelle indépendante, quantiles, masse de probabilité = 1, graine reproductible |
| Données Hyperion (série 2016 – 2026, frais, prime de risque, retenues) | Fait non vérifié indépendamment | Copiées de horizon3 `b96fad6` ; statut d’origine conservé : 2016 – 2025 « données initiales du comparateur, non revérifiées », 2026 « communiqué » ; aucune vérification auprès de Liechtenstein Life |
| « Top 1 % des 3e piliers sur plus de 140’000 contrats, 4e année consécutive », classement 2026 (bmpartners) | Fait non vérifié | Déclarations de l’utilisateur et du dépôt bmpartners `bba0848`, affichées avec attribution ; aucun document de Liechtenstein Life consulté |
| Commande : dialogue, validation, envoi, reprise idempotente, succès, erreurs | Vérifié (transport simulé, contrat réel) | Playwright bureau et mobile : erreurs de champs affichées, puis commande acceptée par un serveur local de substitution qui valide le corps avec `horizon3ContactSchema` du paquet contracts (`source: "coverview"`, `productId: 0`, `strategyId: "prosperity"`, `company: "Liechtenstein Life"`, 500 CHF par mois, 1992, capital initial `null`) et répond comme la route ; référence affichée. **L’API réelle n’a pas été exercée** : pas de Docker dans la session, donc ni Postgres ni Testcontainers |
| API : `source` élargi à `coverview`, CORS de la route étendu à `AUTH_WWW_ORIGIN`, textes du Lead et de l’avis par site d’origine, gabarit `horizon3-request-v3` | Vérifié V0 · fait non vérifié V2 | `tsc` contracts, api-client et api sans erreur ; ESLint sans erreur. Le test d’intégration `partner-intake.test.ts` (nouveau cas coverview, version v3) n’a pas pu tourner : Testcontainers exige Docker, absent ici — à exécuter en CI ou en local |
| Simulateur : paramètres partagés entre le bloc d’achat et le simulateur, projection et Monte Carlo recalculés | Vérifié | Playwright : 300 → 500 CHF dans le bloc d’achat change le capital du simulateur (2’172’620 → 3’621’284 CHF à 31 ans) ; bascule mensuel/annuel convertit 500 → 6’000 ; distribution calculée dans le worker (médiane 4’013’204 CHF, projection au 54,3e percentile à 500 CHF/mois) |
| Dialogues : détail des performances, avis, hypothèses, captures ; Échap ferme et rend le focus | Vérifié | Playwright : les quatre dialogues s’ouvrent et se ferment à Échap ; dialogue de commande fermé par Échap |
| Avis Google : marquee, pause au survol, au focus et au bouton, lecture complète en dialogue | Vérifié | Playwright : `data-paused` bascule ; dix avis à sujets prévoyance / 3e pilier / investissement / assurance-vie, verbatim ; dates relatives périmées retirées |
| Rendu bureau 1440 px et mobile 390 px, sans débordement horizontal | Vérifié | Captures des sections après défilement réel ; `scrollWidth` = `innerWidth` sur les deux largeurs ; console sans erreur ni avertissement après chargement complet |
| Budget JavaScript, LCP, CLS | Vérifié | `check-www` : 99’479 octets gzip chargés (plafond 102’400), LCP synthétique local 280 ms, CLS 0,0002 ; marge faible sur le budget, le worker Monte Carlo n’est chargé qu’à la visibilité du simulateur |
| Illustration : coffret SVG dans le concept des packagings maladie, liasse, pièces, chandeliers | Vérifié visuellement (revue de l’agent) | Captures bureau et mobile ; logo d’abord absent des trois dépôts (emplacement réservé, nom en texte brut, aucun logo inventé), puis **fourni par l’utilisateur le jour même** et posé sur le coffret, dans le héros et à la clôture |
| Logo Hyperion : original conservé, vectorisation | Vérifié | PNG 1254 × 1254 copié sans retouche (SHA-256 `00438d0c…`), `logo.svg` reconstruit depuis la géométrie mesurée dans les pixels ; recouvrement avec l’original 95,2 % (Jaccard), écarts limités à des bandes de 1 à 3 px sur les bords (anticrénelage, original 568 × 560 px non carré) ; paramètres dans `provenance.json` |
| Maillage : à la une du menu Comparateur, Explorer, section stratégie de l’accueil | Vérifié | `check-www` : page atteinte depuis l’accueil ; lint ciblé |
| Préférence de réduction des mouvements | Fait non vérifié sur un OS réglé ainsi | Branches CSS et `data-motion="paused"` relues ; marquee et dégradé du CTA immobiles sous `prefers-reduced-motion` |

## Premier retour du 4 novembre 2026 (H-13 à H-16)

| Élément | Statut | Oracle et portée |
| --- | --- | --- |
| CTA « Découvrir Hyperion » dans le héros de l’accueil, vers la page produit | Vérifié | Build et `check-www` (lien local compté, page atteinte) ; capture du héros de l’accueil |
| Bouton shader du comparateur sur les quatre CTA de la page (achat, simulateur, envoi de commande, clôture) | Vérifié V1 · rendu WebGL fait non vérifié en headless | `HealthGradient` dans chaque bouton, îlot `HyperionOrderCta` déclaré dans l’oracle ; le dialogue de commande s’ouvre depuis la clôture. La scène WebGL ne s’est pas chargée dans Chromium headless (serveur de développement : dépendance en cours d’optimisation ; oracle : `deferredDecorationGzipBytes` à 0), le fond statique du bouton s’affiche alors, comme sur le comparateur |
| Budget JavaScript du gabarit | Vérifié | `check-www` : 100’803 octets gzip chargés hors décoration différée (plafond 102’400), LCP 244 ms, CLS 0 ; les chunks `HealthShaderScene` et `three.module` sont déclarés décoration différée de cette seule page (G-08, H-14) |
| Card « 2026, année en cours » en tête, fond sombre BM Partners, chevrons verts montants, pixels scintillants ; alternance dark / clair sur les indicateurs et les résultats clients ; chevrons sur la tuile du héros | Vérifié visuellement | Captures bureau après défilement ; animations CSS seules, immobiles sous `prefers-reduced-motion` et en mode pause |
| « Composez votre Hyperion » en 18 px ; logo en exposant du titre (0,36 em) | Vérifié visuellement | Capture du héros |
| Types, lint, build | Vérifié | Astro Check (0 erreur), ESLint, build (46 pages) |

## Observations de la revue navigateur

- Le serveur de développement affiche « Invalid hook call » au rendu serveur de **toutes** les pages (accueil compris), avant cette livraison : non introduit ici, à examiner à part (G-07). Aucun avertissement dans le navigateur.
- Les captures d’éléments Playwright montrent parfois le lien « Aller au contenu » : artefact de capture des éléments fixes (sonde : le lien reste à −100 px et n’a pas le focus).
- Les plages centrales de la distribution portent par construction 15 % et 10 % (déciles) : la lecture utile est dans les bornes en francs, comme sur horizon3.
- Contrôles de dépôt : `lint:docs` et `test:tooling` (51 tests) passent ; `check:roadmap` échoue déjà à HEAD (`roadmap/backlog.yaml` périmé par rapport aux sources, inchangé ici) et `knip` signale sept fichiers inutilisés et un export dupliqué antérieurs à cette livraison (G-07, non corrigés) ; les exports inutilisés des nouveaux modules ont été retirés. dependency-cruiser émet pour `hyperion-reviews.ts` le même avertissement d’orphelin que pour les autres contenus importés seulement par des fichiers Astro.

## Outillage et adaptations (G-08)

`scripts/check-www.mjs` déclare la nouvelle route parmi les gabarits mesurés et ses scripts attendus (`HyperionBuy@load`, `HyperionSimulator@visible`, module `HyperionPage`). Aucun seuil modifié. Le JSON-LD de la page se limite à `WebPage`, `BreadcrumbList` et `FAQPage`, l’oracle refusant `Product`, `Offer`, `Review` et `AggregateRating`.

Dérogation déclarée : le CTA n’emprunte pas le shader WebGL des CTA du comparateur (préférence du 24 octobre) mais un dégradé CSS animé aux mêmes couleurs, parce que la page est mesurée par `check-www` et que three.js dépasserait le budget JavaScript du gabarit (MKT-06, DOIT).

## Périmètre et limites

Applications modifiées : `www` (page, contenu, composants, styles, navigation, oracle), `api` et `contracts` (source `coverview`, CORS, textes par origine, gabarit v3, test), documentation (README www, règles de la commande, plan, ledger, mémoire). Aucune dépendance ajoutée, aucune migration, aucune table, permission, room, job ni variable d’environnement nouvelle ; `AUTH_WWW_ORIGIN` existante doit porter l’origine publique du site (compose de production : `SITE_ORIGIN`). Aucun déploiement ; aucune commande réelle envoyée.

Reste à faire : exécuter `partner-intake.test.ts` avec Docker ; après déploiement, passer une commande de test depuis la page et vérifier le Lead et l’avis interne ; décider d’une illustration photoréaliste (imagegen) maintenant que le logo est disponible.
