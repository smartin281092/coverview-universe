# Site public CoverView — préversion

## Résumé

Accueil statique, en français, présentant le projet en construction. HTML généré avec Astro et contenu MDX, lisible sans JavaScript et sans dépendance à l’API.

## Périmètre

Une page d’accueil bornée, une vraie page 404 et des liens locaux vers Wallet et l’espace équipe pendant le développement. Aucun formulaire, compte, calculateur, comparateur, tracker ni cookie. Les contenus par locale vivent dans `src/content/fr/`. Assets de marque importés depuis leur source, sans copie des fonds ni des logos. Le site ne dépend pas de `packages/ui` (MKT-02).

## Règles métier et invariants

Les capacités décrites sont des intentions du projet et le texte indique qu’elles ne sont pas encore disponibles. Aucun tarif, performance commerciale ou conseil financier inventé. Rendu SSG intégral, sans îlot hydraté ni script applicatif. Metadata, canonical, Open Graph/Twitter et JSON-LD Organization/WebSite sont rendus au build ; aucune offre ou structure de produit fictive.

## Permissions

Contenu public sans donnée privée ni credential. La préversion de développement écoute exclusivement sur loopback, et toutes les pages portent `noindex,nofollow`. Le nom de domaine dans les canonical est la cible du projet ; il ne prouve aucun DNS ou déploiement.

## État réel

Coquille statique écrite. Les vérifications build et navigateur sont consignées dans le ledger S-000a. Pas de site publié, pas de Search Console ni de mesure RUM réelle dans cette slice locale.

## Indexation et bots

Décision réversible S-000a : **tous les robots sont refusés** via `robots.txt` tant que ce site est une préversion sans contenu public validé. Cela couvre les bots de recherche/réponse et d’entraînement (GEO-02), sans prétendre constituer une protection d’accès. Aucun sitemap ou `llms.txt` ne liste de page non indexable. Leur génération depuis le contenu, les choix d’ouverture aux bots et la protection d’une preview déployée devront accompagner la slice de publication ; aucun endpoint public n’existe ici.

## Développement et dépendances

`pnpm --filter www dev` : `127.0.0.1:4103`, port strict. `build` : HTML/CSS/assets sous `dist`. `typecheck` : Astro Check. Astro, MDX, Tailwind et le plugin Vite sont imposés (MIT). Geist auto-hébergée suit le preset des apps, licence OFL-1.1 signalée dans [UI](../../packages/ui/README.md#dépendances-et-provenance). Aucune nouvelle bibliothèque de composants, CMS ou dépendance backend.

Documentation officielle consultée le 2026-09-05 : [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Tailwind dans Astro](https://docs.astro.build/en/guides/styling/). Versions stables vérifiées via le registre npm et conservées dans le lockfile.
