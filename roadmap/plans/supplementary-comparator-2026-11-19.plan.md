# Comparateur des complémentaires 2027 du 19 novembre 2026 — catalogue, filtres, comparaison, assistant

Demande utilisateur du 19 novembre 2026 (mandat PROG-23, aucune question bloquante posée) : page du site pour trier et filtrer les complémentaires santé par tag et catégorie, en tableau et en cartes « e-commerce », filtrer par compagnie, ajouter jusqu'à 4 produits à une page de comparaison (en-tête « produit ▾ vs produit ▾ » d'efficient.app, ajout filtrable par thème), prestations équivalentes alignées sur la même ligne, barre de chat qui cherche dans la base et pose une question seulement si la réponse change la recommandation (motif des questions du centre d'actions de Wallet), panneau latéral et CTA panier du comparateur de base. Les prix dépendent du sexe, de la localité et de l'année de naissance : donner un ordre d'idée. Inspirations : efficient.app (capture), comparateur complémentaire de bmpartners (`frontend/src/pages/complementary-health-comparator.jsx`), comparaison d'offres de Wallet (`ComparisonMatrix`), questions de `ActionResolution` (Wallet).

Données : [jeu LCA 2027](../../data/supplementary-insurance/2027/README.md), collecté le 18 novembre 2026 (12 assureurs, 190 produits, 2 671 prestations lues, 372 220 primes relevées aux calculateurs officiels).

## Décisions déléguées (PROG-23)

1. **Routes** : `/comparateur-complementaires-2027` (liste) et `/comparateur-complementaires-2027/comparaison?produits=a,b,c,d` (comparaison), une page Astro chacune, même îlot React, lien dans le menu « Comparateur ».
2. **API** : nouveau module `supplementary-insurance` (catalogue en jsonb, primes en table, import idempotent depuis `data/`), routes publiques anonymes `GET /supplementary-insurance/catalog`, `POST /supplementary-insurance/quote`, `POST /supplementary-insurance/assistant`. Contrat : `@coverview/contracts/supplementary-insurance`. Le site ne lit pas `data/` (aucune exception `.dockerignore` côté site).
3. **Prix indicatifs** : profil par défaut né en 1990, sexe non précisé, canton de Vaud. Une localité de référence par canton romand (Lausanne, Genève, Fribourg, Sion, Neuchâtel, Delémont), celle du relevé ; hors Romandie, le choix reste parmi ces six cantons. Sans sexe, la fourchette femme–homme est affichée. Prix mensuel brut, variante par défaut du calculateur (option vide), accident inclus quand l'option existe. Produit sans prix relevé : « Prix sur demande » et, s'il existe, le prix publié par l'assureur avec son profil.
4. **Lignes exclues des prix** : tarifs famille de Groupe Mutuel (`api_only_not_displayed_single_person`), lignes sans clé de produit (CAPITAL d'AXA, Legis et CyberProtect de Groupe Mutuel). Gardées avec leur remarque : DIMA de Concordia, variantes VIVA de Visana, produits masqués du calculateur Sanitas.
5. **Partenaires** : Assura et Groupe Mutuel (règle health.partner.1), badge « Partenaire » comme le comparateur de base.
6. **Assistant** : interprétation du texte en tags, catégories, compagnies et budget par OpenAI quand la clé est configurée (sortie structurée limitée à la taxonomie), sinon par un dictionnaire de synonymes ; classement et questions déterministes côté serveur. Une question n'est posée que si ses réponses possibles changent les trois premiers résultats. Aucune donnée conservée, limite de débit par IP.
7. **Comparaison** : 4 produits au plus, gardés dans l'URL et dans l'onglet (`sessionStorage`). Lignes = tags (prestations équivalentes) regroupés par famille ; cellule = couverture de la variante choisie, « — » si absente.
8. **Panier** : deuxième étape du même plan (voir plus bas). Tant qu'elle n'est pas livrée, aucun CTA ne prétend ajouter au panier.

## Étape 2 — panier

Une complémentaire s'ajoute au panier existant (demande d'offre « Assurance maladie 2027 ») pour une personne, avec ou sans modèle de base : extension compatible du contrat des demandes (`supplementary` par personne, modèle de base facultatif si au moins une complémentaire), prix recalculé par le serveur, affichage dans Wallet, Admin et Partner. Demande possible pour les seules compagnies partenaires ; ailleurs, CTA grisé et produit partenaire suggéré, comme le comparateur de base.

## Definition of Done — oracles

- V0/V1 : typecheck, lint, build de `api`, `www`, `contracts`, `api-client` ; migration appliquée sur une base vierge.
- V2 : tests du module (import, devis, assistant, routes) sur PostgreSQL réel.
- V3 : parcours réel API + base importée + site : filtres, tri, vues cartes et tableau, popup des prestations, panneau, comparaison à 4, ajout par thème, assistant avec question ; captures ordinateur et téléphone ; `check-www` (budget 100 kB gzip de l'îlot).
- Revue produit (execution-policy) : espaces, hiérarchie, pas de boîtes imbriquées, clavier, mobile, états vide/attente/erreur, mouvement réduit.

## Hors périmètre (premier jet)

Carte des zones par NPA (six localités de référence seulement) ; prix d'Atupri (pare-feu) ; souscription en ligne ; notes ou classements inventés.

## Journal de vérification

À compléter.
