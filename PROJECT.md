# CoverView — identité et état du projet

Initialisation documentaire : 5 septembre 2026, mode BOOT-10. **Socle local S-000a implémenté ; état et preuves dans [son ledger](roadmap/evidence/S-000a.md).** L'utilisateur a autorisé l'implémentation séquentielle, une nouvelle tâche Astra Ultra par slice et le choix des meilleurs défauts. [Le mandat et le protocole de relais](roadmap/execution-policy.md) sont canoniques ; l'état réel et les preuves restent dans la roadmap.

## Problème et valeur

CoverView aide à comprendre, comparer et piloter la prévoyance, l'assurance et la retraite. Un visiteur obtient une première valeur sans compte, conserve ses résultats dans Wallet, puis suit ses contrats, analyses, démarches et décisions. Le même socle alimente les équipes internes, apporteurs et professionnels, selon leurs droits.

La [bible v1.5](references/CoverView_Bible_Produit_Plateforme_v1.5.docx) est la référence maître. [L'index produit](docs/product/README.md) donne accès à son extraction, à la carte fonctionnelle et aux questions ouvertes. Priorité des sources et traitement des instructions embarquées : DOC-16. Objectif demandé : couvrir **l'intégralité** de cette bible ; ses mentions « futur » sont conservées dans la roadmap avec leurs conditions d'activation.

## Personas et surfaces

| Persona / surface | Parcours et frontière à préserver |
|---|---|
| Visiteur anonyme · `www` | Comprendre, comparer, analyser, simuler, initier une démarche avant connexion |
| Client · `client` (Wallet) | Contrats, analyses, documents, assistance, suivi, carte digitale, Miles et avantages |
| Membre d'un foyer · Retire dans Wallet | Plan retraite, budgets, rente/capital, stress et décisions ; droits individuels explicites |
| Conseiller / opérateur / administrateur · `admin` | CRM, dossiers, tâches, catalogue, Gmail/Calendar, cockpit et copilote |
| Apporteur / partenaire · `partners` | Leads, suivi, commissions et avantages dans son périmètre autorisé |
| Professionnel · `intelligence` | Catalogue, benchmarks, analyses et scénarios professionnels autorisés |
| Participants à Exchange · `exchange` | Domaine séparé à spécifier ; aucune opération financière réelle au cadrage |

Source : bible §7–12, §66–71 et R2/R14. `api` désigne CoverView Core commun. `api`, `client`, `admin` et `www` possèdent leurs coquilles techniques ; les autres surfaces restent planifiées. Retire reste un module de Wallet ; les domaines publics nommés dans la bible restent des cibles, aucun DNS n'est configuré.

## Langues et données

Français au départ ; contenu suisse, montants CHF et contexte cantonal selon les sources produit. Le français est un défaut réversible du harness, pas une liste de locales exigée par la bible. i18n dès le socle ; autres langues et voix à préciser au besoin. Date/fuseau de l'utilisateur ne devient pas une règle de date métier sans spécification.

Données fictives au démarrage : ENV-09. Les exemples financiers ne deviennent jamais des paramètres validés. Les modèles de données, contrats, permissions et frontières sont à planifier avant leur implémentation. Documents d'identité, contrats, patrimoine, foyer et échanges requièrent l'isolation décrite dans la bible.

## Choix explicites enregistrés

| Sujet | Source canonique appliquée |
|---|---|
| Stack technique | CLAUDE.md §0, ADR-0001 |
| Identité / connexion WorkOS, projet `coverview` | AUTH-11, ADR-0003 |
| API OpenAI pour OCR et fonctions IA | Décision utilisateur S-042a ; roadmap/execution-policy.md et README document-intelligence |
| Tenancy personnelle, foyers et espaces professionnels | ADR-0002 ; droits non décidés à inventer interdits |
| Preset shadcn et commande exacte fournie | DSN-01, ADR-0004 |
| Palette jointe, logo et fonds du dossier assets | docs/brand.md, ADR-0004 |
| Pas d'allongement des contenus ; surfaces d'ouverture et exception FAQ | FRONT-14 |
| Infomaniak Horizon, protection de l'existant, domaine coverview.ch | HOST-01 à HOST-03, ADR-0005 |
| Astra Ultra pour chaque slice | PROG-12 ; capacités réelles de lancement dans docs/codex.md |
| Nouvelle session propre au seuil de 70 % | CDX-03 ; détection automatique précise indisponible dans les outils actuels |
| Bible complète et traçabilité jusqu'aux prompts | DOC-16, PROG-21 |

## Parcours et carte des capacités

La [carte fonctionnelle](docs/product/capabilities.md) porte l'inventaire dérivé des capacités, leurs dépendances et les workflows A–M. Elle couvre notamment acquisition/3P, catalogue et gouvernance, contrats/documents/signature, Wallet/Retire, assistance, fidélité, opérations, copilotes, partenaires, Intelligence et Exchange. Elle sert au découpage ; elle n'est pas une carte de modules déjà réalisés.

Module implémenté : [platform](apps/api/src/platform/README.md), santé et persistance des seules personas techniques locales. Les frontières métier seront fixées progressivement au plan des slices, avec README propriétaire selon DOC-01. Une seule base métier commune aux applications principales ; Exchange conserve la frontière distincte décrite par §12. Aucun frontend ne lit directement la base.

Module public ajouté le 30.09.2026 : [health-insurance](apps/api/src/modules/health-insurance/README.md), propriétaire du catalogue Priminfo 2027, des régions, des prestations sourcées et du calcul de franchises consommés par www. L’enrichissement des avantages est partiel ; état et preuves dans son README.

Extension Partner du 02.10.2026 : [module commun Leads/offres](apps/api/src/modules/partner-workspace/README.md) et [surface Partner](apps/partners/README.md), reliés à Wallet et Admin. Implémentation partielle du [brief intégral](references/coverview-partner-2026-10-02.md), avec [couverture et reste à faire](roadmap/partner-coverage.md). Cette extension ne clôture pas les slices ni les intégrations antérieures.

## Offre et intégrations

La bible décrit des offres et niveaux de service, notamment Retire Check / Plan / Strategy / Care / Review. Les montants, droits et arbitrages restent attachés aux sources dans l'inventaire ; aucun catalogue exécutable n'existe. Les décisions commerciales non résolues sont dans [le registre de questions](docs/product/open-questions.md). Aucun tarif, commission ou droit n'est inventé au bootstrap.

Les besoins de paiement, signature, email, Gmail/Calendar, document intelligence, LLM, carte Wallet et notifications sont inventoriés. Le fournisseur de connexion et la cible d'hébergement sont déjà choisis ; les autres comptes/prestataires restent non branchés. Stripe demeure l'option technique du harness si le module paiement est activé, pas une intégration réalisée.

## Hypothèses réversibles et questions

- Français pour le premier rendu : rayon d'impact = contenus et catalogues i18n, sans modification des règles métier.
- Noms de dossiers `client` pour Wallet, `www`, `admin`, `partners`, `intelligence`, `exchange` : mapping de travail, sans infrastructure correspondante.
- Modèle de droits du foyer, équipes et partenaires, méthodes WorkOS activées, régions/ressources cloud, règles de calcul/commerciales : **questions ouvertes**, pas hypothèses à matérialiser en base. Elles bloquent les slices concernées seulement.

## Règles transverses

**Identité commerciale — instruction utilisateur du 8 septembre 2026** : CoverView est le seul nom à afficher dans les interfaces, documents et contenus produits. Supprimer toute mention de l’ancienne identité, toute formule « marque de » et ses coordonnées commerciales obsolètes. Cette instruction remplace celle du 7 septembre qui demandait de conserver l’ancienne dénomination. Elle ne modifie pas les identités de connexion, les documents originaux ni les preuves historiques, et ne constitue pas une vérification indépendante des registres ou de la couverture RC. Le [plan des autorisations](roadmap/plans/S-042a-library-authorizations.plan.md) conserve la portée du changement ; les règles de remplissage du profil restent dans [le module documentaire](apps/api/src/modules/document-intelligence/README.md#revue-et-profil-compatible).

**Identité légale — confirmation utilisateur du 3 octobre 2026** : la société a changé de nom et s’appelle désormais CoverView Sàrl. CoverView n’est plus à présenter comme une marque de Bassa Martin Partners Sàrl. Cette confirmation remplace celle du 30 septembre concernant la relation de marque ; elle autorise la correction des contenus actuels, sans réécrire les preuves ni les versions de mentions déjà enregistrées.

Adresse CoverView fournie par l’utilisateur le 8 septembre 2026 : **Avenue Louis-Casaï 71, 1216 Cointrin**. Elle remplace l’adresse précédente dans les coordonnées et documents produits. La notice LSA45 dispose d’une nouvelle version ; les dates d’ouverture des versions antérieures restent conservées.

## Git et livraison

Dépôt donné par l'utilisateur : [smartin281092/coverview-universe](https://github.com/smartin281092/coverview-universe). Remote `origin` configuré, branche locale `main`. Lecture distante initiale : aucune référence publiée retournée par `git ls-remote` le 2026-09-05. Le harness fourni et ses sources ont un commit initial conservé ; aucun historique distant remplacé.

Le remote est raccordé ; aucun push ni déploiement n'a été effectué pendant la préparation. Le premier push suit BOOT-07 / ENV-06. Le [journal d'initialisation](roadmap/initialisation.md) donne les preuves et limites.

Extension du 30.09.2026 : [insurance-requests](apps/api/src/modules/insurance-requests/README.md), propriétaire des demandes d’offre familiales, du suivi invité/Wallet et du traitement Admin. [Vérifications et limites](roadmap/evidence/health-offers.md).
