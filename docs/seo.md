# SEO technique

> **Résumé** : SEO au build : metadata complètes, canonical, sitemap fiable, redirections 301 traitées comme des contrats versionnés, JSON-LD exact par type de page, hreflang, E-E-A-T.

S'applique à toutes les surfaces publiques (`marketing-web.md`). Le SEO se construit au build, pas en retouche.

## SEO-01 — Exigence de build

Toute page publique DOIT sortir du build avec : `title` unique, meta description, canonical, balises Open Graph/Twitter, directive d'indexation voulue. Une vérification automatisée DEVRAIT bloquer les pages incomplètes (G-15).

## SEO-02 — Metadata

- `title` unique (~50–60 caractères), description utile (~150–160) — pas de duplication entre pages.
- Open Graph + Twitter cards avec image dédiée (1200×630), générée par template si besoin.

## SEO-03 — Canonical et duplication

- Canonical absolu sur chaque page. Trancher une fois : apex vs `www`, trailing slash — et imposer par redirection.
- Paramètres de tracking (`utm_…`) exclus du canonical. Pagination : chaque page se canonicalise elle-même.

## SEO-04 — Sitemap et robots.txt

- `sitemap.xml` généré au build, `lastmod` fiable (dérivé du contenu, pas de la date de build), déclaré dans `robots.txt` et Search Console.
- `robots.txt` bloque les chemins sans valeur (recherche interne, préversions), mais n'est JAMAIS un mécanisme de sécurité : contenu privé = authentification (SEC-01).
- Environnements de préversion NON indexables : `noindex` + protection d'accès.

## SEO-05 — URLs et redirections : des contrats

- Une URL publiée est un contrat public (même logique que G-12). Tout changement = redirection **301** ajoutée à un fichier de redirections versionné et testé en CI.
- Jamais de chaîne de redirections (un seul saut), jamais de 302 pour du permanent.
- Contenu supprimé : 301 vers l'équivalent le plus proche, sinon 410 assumé.

## SEO-06 — Données structurées (JSON-LD)

- Par type de page : `Organization` + `WebSite` (accueil), `BlogPosting`/`Article` (auteur, `datePublished`, `dateModified`), `BreadcrumbList` ; `Product`/`Offer` et `FAQPage` uniquement quand le contenu correspond réellement.
- Le JSON-LD DOIT refléter le contenu visible — jamais de données structurées mensongères (risque de pénalité ; les agents IA les consomment aussi — GEO-01).
- Validation automatisée au build.

## SEO-07 — International

Si multilingue : une URL par langue (jamais de contenu négocié par cookie), `hreflang` réciproques + `x-default`, pas de pages à moitié traduites indexées.

## SEO-08 — Contenu

- Une intention de recherche par page ; pas de pages quasi identiques qui se cannibalisent.
- Maillage interne : toute nouvelle page reçoit des liens depuis des pages existantes pertinentes ; aucune page orpheline (présente dans le sitemap mais absente du maillage).
- E-E-A-T : auteur réel identifié, dates exactes, sources citées.
- L'IA PEUT assister la rédaction ; le contenu publié est relu par un humain et apporte une valeur propre. La génération en masse non relue est INTERDITE.

## SEO-09 — Mesure

Search Console (et équivalent Bing) configurés ; suivi des pages clés (impressions, clics, positions) ; erreurs de couverture et d'indexation traitées comme des bugs.
