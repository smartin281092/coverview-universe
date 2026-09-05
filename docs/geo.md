# Visibilité auprès des moteurs et agents IA (GEO)

> **Résumé** : Visibilité IA : les fondamentaux (HTML servi, JSON-LD, contenu extractible) priment ; llms.txt et miroir .md = compléments à faible coût générés depuis la source, au bénéfice non prouvé (statut mi-2026, à réévaluer).

Complète `seo.md`. GEO (Generative Engine Optimization) : être correctement lu, compris et cité par les moteurs de réponse et agents IA (ChatGPT, Claude, Perplexity, AI Overviews…).

## GEO-01 — Hiérarchie honnête des leviers

- Les leviers **prouvés** sont les fondamentaux : contenu présent dans le HTML initial sans JavaScript requis (MKT-03), sémantique propre (MKT-07), JSON-LD exact (SEO-06), contenu structuré en réponses directes (GEO-05), autorité et maillage (SEO-08).
- `llms.txt` et le miroir Markdown sont des **compléments à faible coût, au bénéfice non démontré**. Statut mi-2026 : ~10 % d'adoption, aucune corrélation mesurée avec la fréquence de citation par les LLM, la grande majorité des fichiers jamais requêtés par les bots ; Google déclare ne pas l'utiliser, Anthropic (ClaudeBot) le consulte. Les implémenter est encouragé vu le coût ; les présenter comme un levier prouvé ou les substituer aux fondamentaux est INTERDIT.
- Ce statut évolue vite : le réévaluer périodiquement, logs à l'appui (GEO-06), et mettre à jour ce fichier.

## GEO-02 — Politique robots.txt pour les bots IA

- Autoriser ou refuser chaque famille de bots IA est un **choix business explicite**, documenté (ADR ou README de `apps/www`) — jamais un défaut implicite.
- Distinguer les usages : entraînement (`GPTBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`…) vs recherche/réponse et fetch à la demande (`OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`…). Liste évolutive : la maintenir.
- Défaut recommandé pour un site marketing : autoriser les bots de recherche/réponse — être cité est un canal d'acquisition ; l'entraînement se décide selon la politique de contenu.
- Cohérence bout en bout : ne pas bloquer au niveau CDN/WAF un bot autorisé dans `robots.txt` (et inversement). `robots.txt` n'est pas une sécurité (SEO-04).

## GEO-03 — llms.txt

- DEVRAIT être fourni (coût quasi nul, standard émergent) : fichier Markdown à la racine (`/llms.txt`) — titre du site, description courte, sections thématiques (`##`) listant les pages clés en liens absolus, une ligne de description par lien.
- Généré au build **depuis la même source que le sitemap** — JAMAIS maintenu à la main en parallèle (il divergerait).
- `llms-full.txt` (contenu complet concaténé) PEUT servir pour une documentation produit ; rarement utile pour un site marketing.
- Ne pas y lister : pages sans valeur informative, contenus privés, argumentaire creux.

## GEO-04 — Miroir Markdown des pages

- Pattern éprouvé pour la **documentation produit** (docs servies aussi en `.md`, façon Stripe/Vercel/Anthropic). Pour un blog dont la source est déjà en Markdown, exposer `/<slug>.md` DEVRAIT être fait (coût quasi nul).
- Le `.md` est généré depuis la **même source** que la page HTML, avec en-tête : titre, date de mise à jour, URL canonique. Jamais une seconde version éditée à la main.
- La négociation de contenu (`Accept: text/markdown`) PEUT compléter ; la route `.md` explicite est plus simple et suffit.

## GEO-05 — Contenu lisible par les agents

- Réponse directe en tête de page ou de section : les moteurs de réponse extraient des passages autonomes.
- Paragraphes compréhensibles hors contexte ; définitions, chiffres et dates en texte — jamais uniquement dans une image ; vrais tableaux HTML, pas des captures.
- FAQ réelles rendues côté serveur (+ `FAQPage` si pertinent — SEO-06) ; aucun contenu clé caché derrière une interaction JS non rendue (accordéons ou tabs vides côté serveur).

## GEO-06 — Mesure

- Suivre le trafic référent des moteurs IA (referrers `chatgpt.com`, `perplexity.ai`, etc.) et les user-agents IA dans les logs serveur.
- Vérifier si `llms.txt` et les routes `.md` sont réellement requêtés avant d'investir davantage (GEO-01).
