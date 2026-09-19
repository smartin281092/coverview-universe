# Site public CoverView — assurance, prévoyance et retraite

## Résumé

Site marketing en français pour la Suisse, construit autour de la compréhension des contrats, de la prévoyance et de l’objectif retraite. [ADR-0008](../../adr/0008-shadcn-geist-montech.md) gouverne le preset shadcn ; [ADR-0009](../../adr/0009-lausanne.md) définit la typographie Lausanne/Montech ; [ADR-0007](../../adr/0007-xai-design-reference.md) conserve la composition ouverte de la [référence xAI fournie](../../references/xai-style-reference.md). [ADR-0006](../../adr/0006-marketing-design-system.md) conserve la décision de partager les composants de présentation avec les apps. Le contenu public reste statique, lisible sans JavaScript et sans dépendance à l’API pour sa lecture. Les ledgers [S-010](../../roadmap/evidence/S-010.md) et [S-011](../../roadmap/evidence/S-011.md) conservent l’historique et les limites des versions antérieures ; ils ne valent pas validation de cette correction.

## Périmètre

`src/content/fr/marketing.ts` porte les six sections de l’accueil : hero centré avec texte court, deux bentos de guides, méthode, ressources, FAQ et appel à l’action final. Le bento contrat ouvre `/services#3e-pilier` ; le bento retraite ouvre `/retire`. Leurs aperçus sont des repères issus des lectures disponibles, explicitement étiquetés « Guide de lecture ». Ils ne représentent ni des captures de Wallet, ni des résultats personnels.

Le contenu expose aussi les libellés de navigation, la narration de l’orientation et les introductions des services et du compte. Les CTA ouvrent une orientation, une lecture existante ou la page de connexion ; aucun bouton ne promet une analyse ou un calcul actuellement indisponible. Le rendu exclut les images 3D et illustrations bleues de la tentative précédente. Aucun dossier fictif, rendement ou témoignage n’alimente le hero. ADR-0008 et le système commun portent les règles visuelles actuelles, sans copie locale de leur palette.

`/overview` oriente selon un contrat à comprendre, une retraite à préparer ou des options à comparer. `/services` relie 3e pilier, LPP, assurances, retraite et documents ; les ancrages stables sont notamment `#3e-pilier`, `#lpp` et `#assurances`. `/methode` développe l’objectif initial puis les six étapes canoniques. Les approfondissements gardent leurs URLs propres. L’explorateur conserve l’accès aux destinations des §22/66, dont les outils futurs restent qualifiés. La démonstration historique reste à `/demonstration` ; la vraie 404 et `/account` sont conservés.

L’inventaire `src/content/fr/acquisition.ts` conserve les propriétaires de parcours et le contenu de repli des destinations futures ; ces IDs restent hors UI. Les contenus éditoriaux disponibles prennent la place de ce repli à la même URL, sans ouvrir leurs outils. Contact, Retire et Miles gardent leur disponibilité opérationnelle en préparation. Une lecture ne déclenche aucune collecte, session anonyme ou événement d’entrée d’outil.

Les 18 contenus éditoriaux se trouvent dans `src/content/fr/editorial/`, plus les MDX méthode/personne existants. `src/content/editorial.ts` les charge et les valide avant de générer pages, index et miroirs. Le corps reste du Markdown standard dans des fichiers MDX, sans code ni composant dynamique. Index articles, cas et rapports : deux entrées au plus par page, URL stable, retour du détail vers la page d’index exacte et ancre focalisable de la carte. Aucun ajout infini ou dépliage hors FAQ.

Le frontmatter porte slug, auteur, création/mise à jour, version, état, type, sources et indicateur fictif. `editorial-schema.ts` bloque un auteur non autorisé, les dates incohérentes, un état de publication externe, une structure cas/rapport incomplète et les formats financiers usuels sans preuve approuvée. Le registre de preuves est vide : renseigner des métadonnées dans un MDX ne suffit pas à valider un chiffre. Ce garde mécanique ne remplace pas la revue du sens, des faits ou des formulations en toutes lettres.

Le système de présentation partagé vit dans `packages/ui`. `@astrojs/react` permet le rendu serveur statique des composants de présentation React, sans hydratation ajoutée pour le contenu public. Les actions utilisent `ButtonLink` et ses variantes communes avec `Button` ; les bentos composent la primitive `Card` autour d’un `article`. ADR-0006 a remplacé le précédent défaut d’isolation de la présentation ; ADR-0008 fixe la typographie et les composants actuels. Les assets historiques restent conservés et n’imposent pas le rendu actuel.

## Narration, SEO et sources

La composition issue de la référence xAI reste conservée : priorité au texte, hiérarchie sobre et deux guides en bento suivis de contenus ouverts. Ses fontes et composants ont été remplacés selon ADR-0008. La tentative IM8/Apple appartient à l’historique d’ADR-0006. Le contenu métier et ses sources restent propres à CoverView ; aucune preuve commerciale, capacité produit ou affirmation financière n’est déduite d’une référence de style.

| Page | Intention de lecture et de recherche |
| --- | --- |
| `/` | Assurance, prévoyance et retraite en Suisse ; comprendre la proposition CoverView |
| `/overview` | Choisir comment commencer selon son contrat, son projet ou ses options |
| `/services` | Identifier les questions liées au 3e pilier, à la LPP, aux assurances et aux documents |
| `/methode` | Comprendre le raisonnement de l’objectif à la réévaluation |
| `/benchmark` | Connaître les critères d’une comparaison de prévoyance |
| `/articles/lire-un-benchmark` | Savoir lire le cadre, les chiffres et les limites d’un classement |
| `/articles/pourquoi-conserver` | Comprendre pourquoi analyser ne suppose pas remplacer un contrat |
| `/retire` | Préparer les questions de niveau de vie, de ressources et de rente ou capital |
| `/articles/questions-frequentes` | Répondre aux objections et aux questions avant de commencer |

Titres et descriptions sont propres à l’intention de chaque page. Les textes structurent les questions en titres et paragraphes autonomes, avec des liens entre besoin, méthode et approfondissement. Les FAQ utilisent les mêmes questions et réponses pour la lecture et les données structurées. Ce travail prépare le contenu SEO ; il ne lève pas le `noindex` de l’environnement local.

La [bible v1.5](../../docs/product/bible.extracted.md) est la source métier fournie. La narration s’appuie sur §2–4 (`p0093` à `p0159` : vue d’ensemble, objectif avant produit, benchmark, méthode), §5.2 et §6 (`p0171` à `p0207` : preuves et valeur avant vente), §21–28 (`p0525` à `p0727` : pages, parcours et questions), §66 (`p1763` à `p1790` : besoins publics et continuité compte), R1–R2 (`p1384` à `p1413` : niveau de vie, décisions et Wallet). Les articles sur le maintien conservent également §26.1 (`p0682`, `p0684`). Les ancrages précis des pages MDX vivent dans leur frontmatter.

La source décrit une vision et un produit à construire. Elle ne fournit pas de résultats clients vérifiés, de qualification professionnelle à certifier, de conditions fiscales actuelles ou d’autorisation de promettre un rendement. Aucun prix, avis, nombre de clients, certification ni service personnalisé opérationnel n’a donc été ajouté. Les textes sur la retraite et les contrats restent des questions de méthode, sans recommandation financière individuelle. Les disponibilités sont présentées dans les FAQ et au point d’entrée des actions concernées, sans transformer le reste du site en inventaire technique.

## Règles métier et invariants

Les principes de méthode sont distincts de l’état des outils. Les fonctionnalités futures ne sont pas présentées comme actives. Aucun tarif, performance commerciale ou conseil financier inventé. Metadata, canonical et Open Graph/Twitter sont rendus au build. JSON-LD : Organization/WebSite pour l’accueil ; Organization, WebPage ou Article pour les contenus, Person minimal sur la personne, FAQPage dérivée des questions/réponses visibles. Aucun statut FinancialService, Service commercial, SoftwareApplication, Offer, avis ou identité sociale absent n’est matérialisé.

L’auteur « CoverView » désigne la rédaction du projet, explicitement assistée par IA ; aucune signature personnelle d’expert n’est attribuée. Les dates décrivent la création locale (`dateCreated`) et la mise à jour, pas une publication externe ni un résultat financier. Auteur, dates et provenance suivent le contenu ; les avertissements sur les exemples fictifs restent avant leur lecture. La provenance visible renvoie à `/sources#bible-v15` ; les ancrages précis du document fourni restent dans les métadonnées sources. La biographie reprend seulement les sept axes de la source avec leur limite de validation. Les deux cas et le rapport sont entièrement fictifs, sans PII ni calcul. Aucun article dérivé d’Instagram n’est revendiqué faute de référence fournie.

Seule `/account` charge un script natif via `@coverview/api-client`. Il lit disponibilité et identité pour un indicateur connecté/non connecté, ouvre le login serveur et rejoint le compte Wallet. Aucune identité, adresse email ou donnée métier n’est affichée sur le site public : la demande explicite de continuité est limitée à cet indicateur et cette navigation (MKT-08). Les résultats ne sont pas conservés ; une navigation, perte de visibilité ou nouvelle vérification annule la requête précédente et retire l’état affiché. Le retour de focus/pageshow revérifie le serveur. Sans JavaScript, l’explication et le lien Wallet restent accessibles.

## Permissions

Contenu public sans dossier privé ni credential. Les seules lectures d’identité utilisent le cookie HttpOnly de l’API avec credentials include ; aucun token n’est stocké côté navigateur. La préversion de développement écoute exclusivement sur loopback, et toutes les pages portent `noindex,nofollow`. Le nom de domaine dans les canonical est la cible du projet ; il ne prouve aucun DNS ou déploiement.

## État réel

Parcours de lecture locaux S-010/S-011 ; aucun calculateur, analyse de contrat, comparateur, formulaire commercial ou tracker actif. L’exemple 65/71/+6 a été retiré de l’accueil après le rejet utilisateur ; sa page historique indique toujours son caractère fictif. Le contact n’a pas de collecte ni de raccord CRM : C06 reste non vérifié. S-080 possède l’entrée publique CRM canonique ; après sa livraison, S-011 pourra raccorder et vérifier le contact minimal. S-012 enrichit ensuite FAQ et attribution sur ce contact existant : l’exiger avant S-011 créerait une boucle sémantique. Le compte S-000b reste soumis à son activation externe non vérifiée. Pas de site publié, Search Console, mesure RUM ou INP terrain.

## Indexation et bots

Décision de préversion S-000a conservée : **tous les robots sont refusés** via `robots.txt`, pages `noindex,nofollow`, serveur local loopback. Cela couvre recherche/réponse et entraînement (GEO-02), sans constituer une protection d’accès. `sitemap.xml`, `feed.xml` et `llms.txt` sont générés depuis la même sélection vide de contenus indexables. Ils ne listent aucune page de préversion ; pas de déclaration Sitemap dans robots. Aucune variable d’environnement n’active leur publication.

Chaque contenu lisible possède `/<slug>.md`, annoncé par un lien alternatif, avec le même corps Markdown, auteur/dates/état/sources et URL canonique. Aucun dossier privé, chemin de dépôt, brouillon ou frontmatter brut n’est exposé. Les headers noindex des endpoints ne sont pas à eux seuls une politique d’hébergement : le futur serveur statique devra appliquer cette politique aux miroirs. Ouverture aux moteurs, validation éditoriale humaine, protection de preview et hébergement restent à traiter avant exposition externe.

## Développement et dépendances

Le lancement `dev` passe par `dev.mjs` pour conserver la supervision du processus parent et éviter une seconde mise en arrière-plan par Astro dans un contexte agent. La preview applique le même marqueur à son enfant Astro. Conserver ce cycle de vie unique ; [diagnostic S-000a](../../roadmap/evidence/S-000a.md).

Si l’import de Sharp échoue après une installation pnpm, inspecter la résolution du paquet et la cible de sa jonction avant de modifier les versions. En S-010, une cible sans suffixe de peer expliquait l’échec ; la résolution outillée de la même version a rétabli import, build et installation frozen, sans édition manuelle du lockfile. [Diagnostic conservé](../../roadmap/evidence/S-010.md).

`pnpm --filter www dev` : `127.0.0.1:4103`, port strict. `build` : HTML/CSS/assets sous `dist`. `typecheck` : Astro Check. Astro, MDX, Tailwind et le plugin Vite sont imposés (MIT). `@astrojs/react` assure le rendu statique de `@coverview/ui` ; aucun CMS ni accès direct à une base applicative n’est ajouté.

`src/styles/global.css` importe `@coverview/ui/styles.css` et déclare `@source "../../../../packages/ui/src"` pour compiler les utilitaires des composants partagés. Tailwind est porté par UI ; le plugin Vite reste déclaré dans `www`, sans dépendance Tailwind directe redondante. Le thème charge les WOFF2 locaux Lausanne pour les titres et le corps, puis les OTF locaux Montech aux graisses 400/500 pour les usages précédents de Geist Mono. Montech n’est pas à chasse fixe. Le [README UI](../../packages/ui/README.md) porte la provenance du preset réellement généré, les primitives `button`, `skeleton`, `card`, `input`, `label` et les sources des fontes. La dépendance Fontsource Geist est retirée ; aucune autre bibliothèque UI n’est introduite.

Documentation officielle consultée lors des étapes précédentes : [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Tailwind dans Astro](https://docs.astro.build/en/guides/styling/), puis [imports Markdown](https://docs.astro.build/en/guides/markdown-content/) et [Zod exposé par Astro](https://docs.astro.build/en/reference/modules/astro-zod/) pour S-011 le 2026-09-06. S-011 n’ajoutait aucun paquet ; l’intégration React appartient à la refonte ADR-0006.

`PUBLIC_API_URL` définit l’origine publique de l’API (défaut local `http://127.0.0.1:4100`, origine du site en build). `PUBLIC_WALLET_URL` définit l’origine de Wallet ; défaut local `http://127.0.0.1:4101`, aucun domaine de déploiement inventé en build. Sans cette valeur en build, le lien Wallet est omis. Ces URLs doivent correspondre aux origines approuvées côté serveur ; elles ne prouvent ni continuité déployée ni droit externe.

Sharp est déclaré directement pour le service d’images Astro, uniquement au build/développement. Déjà présent transitivement dans le lockfile, il ne crée aucun traitement de fichiers soumis par un visiteur. Nom/provenance et licence Apache-2.0 contrôlés ; justification et diagnostic d’installation dans le ledger S-010.

## Vérifier les parcours

Le retour explicite d’un détail éditorial rejoint la page d’index qui contient réellement sa carte, avec son ancre ; un retour systématique à la racine perd la position dans une liste paginée. Distinguer la preuve de ce retour explicite de la restauration native du focus par le navigateur. [Correction et oracles S-011](../../roadmap/evidence/S-011.md).

GSAP est installé à la demande de l’utilisateur pour les prochaines animations, sans chargement dans les pages actuelles. [Périmètre préparatoire, licence et exception Knip](../../roadmap/evidence/gsap-setup.md). Sa future intégration devra préserver le contenu sans JavaScript et respecter la réduction des animations.

Le [ledger shadcn et typographie](../../roadmap/evidence/shadcn-typography.md) porte les vérifications courantes et leurs limites. Le [ledger xAI](../../roadmap/evidence/xai-redesign.md) conserve l’étape précédente. L’aperçu social `/og.png` et la variante `/og-preview.svg` sont générés depuis `src/content/social.ts` et le texte de l’accueil. La provenance du visuel de la tentative précédente reste conservée dans `src/assets/README.md` ; elle ne prouve pas son utilisation dans le rendu actuel.

Après `pnpm build` et installation du Chromium Playwright : `pnpm check:www` sert le build seul sur loopback éphémère puis s’arrête. Il contrôle HTML, metadata, graphe JSON-LD, miroirs comparés à la source et au HTML, liens/ancres/orphelins, sorties d’indexation vides, absence de JS exécutable hors compte, budget JS gzip et LCP/CLS sur onze gabarits. Ces mesures synthétiques ne sont ni du RUM ni une preuve du futur hébergement. Le contrôle est branché en CI après l’installation de Chromium.

La reprise du 6 septembre 2026 privilégie le parcours réel et le rendu, conformément au refus utilisateur des fixtures et tests de surface. Aucun nouveau test public ajouté. Les cinq anciens scénarios d’acquisition puis quatre scénarios éditoriaux de surface ont été retirés explicitement : ils validaient démonstration chiffrée, pages d’indisponibilité, métadonnées et textes recopiés, sans acquisition persistante. Seul le scénario éditorial de pagination et retour/focus reste. Les vérifications de compilation et l’inspection visuelle ne prouvent pas la connexion WorkOS.
