# Site public CoverView — parcours d’entrée

## Résumé

Accueil, trois parcours et contenus éditoriaux du projet, en français. HTML Astro/MDX intégralement statique, lisible sans JavaScript et sans dépendance à l’API. [S-010](../../roadmap/evidence/S-010.md) reste livré ; [S-011](../../roadmap/evidence/S-011.md) documente la mécanique éditoriale locale et les preuves externes encore absentes.

## Périmètre

`/` présente la question retraite et mène aux lectures disponibles : méthode, articles, glossaire, modèles de service, ainsi qu’au compte. Les actions précèdent les lectures secondaires sur mobile. Aucun dossier ni résultat fictif n’est présenté dans l’accueil. `/overview` explique les trois futurs parcours, avec des actions de lecture et leur disponibilité explicite. `/explorer` propose trois catégories ; `/explorer/comprendre`, `/explorer/outils` et `/explorer/espaces` donnent accès aux destinations des §22/66 sans allonger la page d’entrée (FRONT-14). Les approfondissements s’ouvrent sur leur page. La démonstration historique reste à `/demonstration` ; la vraie 404, `/account` et les liens locaux Wallet/équipe sont conservés.

L’inventaire `src/content/fr/acquisition.ts` conserve les propriétaires de parcours et le contenu de repli des destinations futures ; ces IDs restent hors UI. Les contenus éditoriaux disponibles prennent la place de ce repli à la même URL, sans ouvrir leurs outils. Contact, Retire et Miles gardent leur disponibilité opérationnelle en préparation. Une lecture ne déclenche aucune collecte, session anonyme ou événement d’entrée d’outil.

Les 18 contenus éditoriaux se trouvent dans `src/content/fr/editorial/`, plus les MDX méthode/personne existants. `src/content/editorial.ts` les charge et les valide avant de générer pages, index et miroirs. Le corps reste du Markdown standard dans des fichiers MDX, sans code ni composant dynamique. Index articles, cas et rapports : deux entrées au plus par page, URL stable, retour du détail vers la page d’index exacte et ancre focalisable de la carte. Aucun ajout infini ou dépliage hors FAQ.

Le frontmatter porte slug, auteur, création/mise à jour, version, état, type, sources et indicateur fictif. `editorial-schema.ts` bloque un auteur non autorisé, les dates incohérentes, un état de publication externe, une structure cas/rapport incomplète et les formats financiers usuels sans preuve approuvée. Le registre de preuves est vide : renseigner des métadonnées dans un MDX ne suffit pas à valider un chiffre. Ce garde mécanique ne remplace pas la revue du sens, des faits ou des formulations en toutes lettres.

Assets de marque importés depuis leur source sans altération des originaux ; Astro produit le dérivé WebP du fond au build. Le site ne dépend pas de `packages/ui` (MKT-02).

## Règles métier et invariants

Les capacités décrites sont des intentions du projet et le texte indique qu’elles ne sont pas encore disponibles. Aucun tarif, performance commerciale ou conseil financier inventé. Metadata, canonical et Open Graph/Twitter sont rendus au build. JSON-LD : Organization/WebSite pour l’accueil ; Organization, WebPage ou Article pour les contenus, Person minimal sur la personne, FAQPage dérivée des questions/réponses visibles. Aucun statut FinancialService, Service commercial, SoftwareApplication, Offer, avis ou identité sociale absent n’est matérialisé.

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

`pnpm --filter www dev` : `127.0.0.1:4103`, port strict. `build` : HTML/CSS/assets sous `dist`. `typecheck` : Astro Check. Astro, MDX, Tailwind et le plugin Vite sont imposés (MIT). Geist auto-hébergée suit le preset des apps, licence OFL-1.1 signalée dans [UI](../../packages/ui/README.md#dépendances-et-provenance). Aucune nouvelle bibliothèque de composants, CMS ou dépendance backend.

Documentation officielle consultée : [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Tailwind dans Astro](https://docs.astro.build/en/guides/styling/), puis [imports Markdown](https://docs.astro.build/en/guides/markdown-content/) et [Zod exposé par Astro](https://docs.astro.build/en/reference/modules/astro-zod/) pour S-011 le 2026-09-06. Aucun paquet ajouté en S-011 ; lockfile et stack conservés.

`PUBLIC_API_URL` définit l’origine publique de l’API (défaut local `http://127.0.0.1:4100`, origine du site en build). `PUBLIC_WALLET_URL` définit l’origine de Wallet ; défaut local `http://127.0.0.1:4101`, aucun domaine de déploiement inventé en build. Sans cette valeur en build, le lien Wallet est omis. Ces URLs doivent correspondre aux origines approuvées côté serveur ; elles ne prouvent ni continuité déployée ni droit externe.

Sharp est déclaré directement pour le service d’images Astro, uniquement au build/développement. Déjà présent transitivement dans le lockfile, il ne crée aucun traitement de fichiers soumis par un visiteur. Nom/provenance et licence Apache-2.0 contrôlés ; justification et diagnostic d’installation dans le ledger S-010.

## Vérifier les parcours

Après `pnpm build` et installation du Chromium Playwright : `pnpm check:www` sert le build seul sur loopback éphémère puis s’arrête. Il contrôle HTML, metadata, graphe JSON-LD, miroirs comparés à la source et au HTML, liens/ancres/orphelins, sorties d’indexation vides, absence de JS exécutable hors compte, budget JS gzip et LCP/CLS sur onze gabarits. Ces mesures synthétiques ne sont ni du RUM ni une preuve du futur hébergement. Le contrôle est branché en CI après l’installation de Chromium.

La reprise du 6 septembre 2026 privilégie le parcours réel et le rendu, conformément au refus utilisateur des fixtures et tests de surface. Aucun nouveau test public ajouté. Les cinq anciens scénarios d’acquisition ont été retirés explicitement : ils validaient une démonstration chiffrée désormais retirée de l’accueil, des pages de disponibilité et des métadonnées, sans parcours d’acquisition ni calcul persistant. Les scénarios éditoriaux de pagination et retour sont conservés. Les vérifications de compilation et l’inspection visuelle ne prouvent pas la connexion WorkOS.
