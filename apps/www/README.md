# Site public CoverView — parcours d’entrée

## Résumé

Accueil, trois parcours et présentation courte du projet, en français. HTML Astro/MDX intégralement statique, lisible sans JavaScript et sans dépendance à l’API. État vérifié S-010 dans [son ledger](../../roadmap/evidence/S-010.md).

## Périmètre

`/` présente la question retraite et l’exemple fictif ; `/overview` expose analyser, préparer et comparer. `/explorer` porte la navigation complète des §22/66 sur desktop et mobile. Les approfondissements s’ouvrent sur `/demonstration`, `/methode` et `/sebastien-martin` ; retour natif et lien ancré vers l’exemple, sans contenu déplié (FRONT-14). La vraie 404, `/account` et les liens locaux Wallet/équipe sont conservés.

Les destinations futures sont générées depuis `src/content/fr/acquisition.ts`. Chaque entrée conserve son propriétaire de slice (et les propriétaires associés si nécessaire) ; ces IDs ne sont pas affichés aux visiteurs. Les URLs stables donnent l’état exact, un repère de lecture et un lien de retour. Une page de disponibilité ne déclenche aucune collecte, session anonyme ou événement d’entrée d’outil. Ces effets attendent l’outil propriétaire ; aucun faux événement d’usage n’est émis pour une simple lecture. Les nouveaux contenus restent sous `src/content/fr/`, les textes longs en MDX.

Assets de marque importés depuis leur source sans altération des originaux ; Astro produit le dérivé WebP du fond au build. Le site ne dépend pas de `packages/ui` (MKT-02).

## Règles métier et invariants

Les capacités décrites sont des intentions du projet et le texte indique qu’elles ne sont pas encore disponibles. Aucun tarif, performance commerciale ou conseil financier inventé. Le contenu public reste SSG intégral sans dépendance réseau. Metadata, canonical, Open Graph/Twitter et JSON-LD Organization/WebSite sont rendus au build ; aucune offre ou structure de produit fictive.

Seule `/account` charge un script natif via `@coverview/api-client`. Il lit disponibilité et identité pour un indicateur connecté/non connecté, ouvre le login serveur et rejoint le compte Wallet. Aucune identité, adresse email ou donnée métier n’est affichée sur le site public : la demande explicite de continuité est limitée à cet indicateur et cette navigation (MKT-08). Les résultats ne sont pas conservés ; une navigation, perte de visibilité ou nouvelle vérification annule la requête précédente et retire l’état affiché. Le retour de focus/pageshow revérifie le serveur. Sans JavaScript, l’explication et le lien Wallet restent accessibles.

## Permissions

Contenu public sans dossier privé ni credential. Les seules lectures d’identité utilisent le cookie HttpOnly de l’API avec credentials include ; aucun token n’est stocké côté navigateur. La préversion de développement écoute exclusivement sur loopback, et toutes les pages portent `noindex,nofollow`. Le nom de domaine dans les canonical est la cible du projet ; il ne prouve aucun DNS ou déploiement.

## État réel

Parcours de lecture et de navigation S-010 vérifiés localement ; aucun calculateur, analyse de contrat, comparateur, formulaire commercial ou tracker actif. L’exemple 65/71/+6 illustre uniquement les notions objectif/trajectoire/écart. Il ne provient d’aucun calcul et n’est pas une référence à l’âge légal. Les contenus détaillés et preuves éditoriales appartiennent à S-011. Le compte S-000b reste soumis à son activation externe non vérifiée. Pas de site publié, Search Console, mesure RUM ou INP terrain.

## Indexation et bots

Décision réversible S-000a : **tous les robots sont refusés** via `robots.txt` tant que ce site est une préversion sans contenu public validé. Cela couvre les bots de recherche/réponse et d’entraînement (GEO-02), sans prétendre constituer une protection d’accès. Aucun sitemap ou `llms.txt` ne liste de page non indexable. Leur génération depuis le contenu, les choix d’ouverture aux bots et la protection d’une preview déployée devront accompagner la slice de publication ; aucun endpoint public n’existe ici.

## Développement et dépendances

`pnpm --filter www dev` : `127.0.0.1:4103`, port strict. `build` : HTML/CSS/assets sous `dist`. `typecheck` : Astro Check. Astro, MDX, Tailwind et le plugin Vite sont imposés (MIT). Geist auto-hébergée suit le preset des apps, licence OFL-1.1 signalée dans [UI](../../packages/ui/README.md#dépendances-et-provenance). Aucune nouvelle bibliothèque de composants, CMS ou dépendance backend.

Documentation officielle consultée le 2026-09-05 : [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Tailwind dans Astro](https://docs.astro.build/en/guides/styling/). Versions stables vérifiées via le registre npm et conservées dans le lockfile.

`PUBLIC_API_URL` définit l’origine publique de l’API (défaut local `http://127.0.0.1:4100`, origine du site en build). `PUBLIC_WALLET_URL` définit l’origine de Wallet ; défaut local `http://127.0.0.1:4101`, aucun domaine de déploiement inventé en build. Sans cette valeur en build, le lien Wallet est omis. Ces URLs doivent correspondre aux origines approuvées côté serveur ; elles ne prouvent ni continuité déployée ni droit externe.

Sharp est déclaré directement pour le service d’images Astro, uniquement au build/développement. Déjà présent transitivement dans le lockfile, il ne crée aucun traitement de fichiers soumis par un visiteur. Nom/provenance et licence Apache-2.0 contrôlés ; justification et diagnostic d’installation dans le ledger S-010.

## Vérifier les parcours

Après `pnpm build` et installation du Chromium Playwright : `pnpm check:www` sert le build seul sur loopback éphémère puis s’arrête. Il contrôle HTML, metadata, absence de JS exécutable hors compte, budget JS gzip et LCP/CLS synthétiques locaux sur cinq gabarits. Ces mesures ne sont ni du RUM ni une preuve de performance du futur hébergement. Le contrôle est branché en CI après l’installation de Chromium.

Preview démarrée : `pnpm exec playwright test tests/e2e/acquisition.spec.mjs` vérifie les vraies destinations, HTML sans JS, focus et retour, reflow 320/390/640 px, absence de requêtes API/tiers et stockage sur les lectures publiques. La suite complète conserve aussi les oracles S-000a et les transports d’identité explicitement simulés S-000b. Pour remplacer une disponibilité lors d’une prochaine slice, préserver l’URL, mettre à jour l’inventaire et les tests selon la capacité réellement livrée.
