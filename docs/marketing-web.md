# Site marketing, blog et contenu public

> **Résumé** : Surfaces publiques à priorités propres : SSG par défaut, SPA client-only interdit, îlots opt-in, contenu Markdown/CMS, budgets Core Web Vitals en CI, formulaires via l'API leads, consentement RGPD.

Ce fichier gouverne les surfaces publiques de contenu (`apps/www` : site marketing, blog, landing pages, éventuellement documentation publique). Les règles de l'application (multi-tenant, idempotence, temps réel) ne s'y appliquent PAS — sauf à la frontière des formulaires (MKT-08). Réciproquement, les règles de ce fichier ne s'appliquent pas à l'app.

Pour les interactions d'ouverture de contenu CoverView, charger FRONT-14 dans `docs/frontend.md` ; pour l'identité visuelle, charger `docs/brand.md`.

## MKT-01 — Ordre de priorité propre

1. Exactitude du contenu ; 2. Crawlabilité et SEO (`seo.md`, `geo.md`) ; 3. Performance (Core Web Vitals) ; 4. Accessibilité ; 5. Conformité (consentement, RGPD) ; 6. Simplicité ; 7. Maintenabilité éditoriale.

En cas d'arbitrage avec l'esthétique ou l'outillage : le contenu servi, crawlable et rapide gagne.

## MKT-02 — Séparation architecturale

- `apps/www` est une application indépendante : build et déploiement propres, AUCUNE dépendance au backend applicatif pour afficher le contenu — le site reste en ligne si l'app est down, et inversement.
- NE JAMAIS accéder à la base de l'app. Le contenu vit en Markdown/MDX dans le repo ou dans un CMS headless (MKT-05).
- Partage avec l'app limité au design réellement commun (tokens, logo) — pas de couplage à un package UI global (ARCH-13).

## MKT-03 — Stratégie de rendu

- **SSG par défaut** pour tout contenu public : le HTML complet est servi, lisible sans JavaScript.
- **SSR** uniquement pour du contenu réellement dynamique ou personnalisé (prix par région, expérimentation server-side), toujours derrière un cache HTTP/CDN.
- **ISR/revalidation** PEUT servir pour du contenu fréquemment mis à jour sans rebuild complet.
- **SPA client-only INTERDIT** pour du contenu public : un contenu absent du HTML initial est invisible ou dégradé pour les moteurs, les agents IA et le premier rendu.

## MKT-04 — Îlots d'interactivité

- L'interactivité (calculateur, carrousel, formulaire riche) s'implémente en îlots hydratés individuellement (architecture islands — Astro ou équivalent).
- Le JavaScript est opt-in par composant : un composant statique ne s'hydrate pas. Pas de state manager global sur un site de contenu.
- Chaque îlot respecte le budget JS de la page (MKT-06) et DEVRAIT se dégrader proprement sans JS quand c'est possible (formulaires : POST natif en secours).

## MKT-05 — Gestion du contenu

- Source par défaut : Markdown/MDX versionné dans le repo, relu en PR. CMS headless si des non-développeurs publient régulièrement — jamais les deux pour un même contenu.
- Frontmatter normé : `title`, `description`, `date`, `updatedAt`, `author`, `tags`, `ogImage`.
- Slug défini à la création ; tout changement de slug passe par une redirection 301 (SEO-05) — jamais de slug régénéré silencieusement depuis un titre modifié.
- 404 utile (navigation, liens) ; jamais de soft-404 (page vide servie en 200).
- Dates réelles affichées (publication et mise à jour).

## MKT-06 — Performance et Core Web Vitals

- Budgets par gabarit de page, vérifiés en CI (Lighthouse CI ou équivalent) : LCP < 2,5 s, INP < 200 ms, CLS < 0,1, JS initial borné (ordre de grandeur : < 100 kB compressé hors îlots).
- Images : AVIF/WebP, dimensions explicites (zéro CLS), lazy loading sous la ligne de flottaison, image LCP préchargée.
- Fonts auto-hébergées, `font-display: swap`, sous-ensembles de caractères.
- Cache HTTP et CDN explicites pour tout le statique.

## MKT-07 — Accessibilité et sémantique

FRONT-12 s'applique intégralement. En plus : une seule `h1` par page, hiérarchie de titres stricte, landmarks, alternatives textuelles éditoriales. La sémantique sert autant l'accessibilité que le SEO et la lisibilité par les agents (GEO-05).

## MKT-08 — Formulaires : la frontière avec l'app

- Lead, contact, newsletter, demande de démo : le site appelle l'**API publique du backend** — jamais la base. À cette frontière, les règles de l'app s'appliquent : validation (CTR-02), rate limiting (SEC-04), idempotence si critique (API-04). Le module `leads` du backend reste la source de vérité.
- Anti-spam obligatoire : honeypot + contrôles serveur ; CAPTCHA uniquement si le spam observé le justifie (friction).
- Aucune donnée soumise n'est stockée côté site. Aucun contenu authentifié n'est affiché sur le site marketing — sinon c'est l'app.

## MKT-09 — Consentement et tracking

- Aucun cookie non essentiel ni tracker chargé avant consentement explicite. Inventaire des tags tiers tenu à jour ; chargement conditionné au consentement.
- Une solution d'analytics respectueuse (cookieless / exemptée de consentement selon la CNIL) DEVRAIT être privilégiée pour réduire bandeau et friction.
- Le bandeau de consentement ne dégrade pas les CWV (pas de CLS, chargement différé). Jamais de secret côté client (G-04).

## MKT-10 — Observabilité minimale

Mesure des CWV réels (RUM), surveillance des 404/5xx et des redirections cassées, visibilité sur le crawl (logs serveur, Search Console — SEO-09, GEO-06).
