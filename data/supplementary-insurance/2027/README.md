# Complémentaires santé (LCA) — comparatif interne 2027

Jeu de données prévu : pour les principaux assureurs actifs en Suisse romande, tous les produits d'assurance maladie complémentaire, leurs prestations classées par tags communs et leurs primes pour chaque année de naissance.

## État au 18 novembre 2026 : collecte non commencée

Aucune donnée d'assureur n'est encore présente. La session de préparation tournait dans un environnement cloud dont le réseau refusait tous les sites concernés (403 du proxy, WebFetch en `ENOTFOUND`), y compris les comparateurs et web.archive.org. Seule la recherche web répondait, et elle ne donne que des titres et des résumés générés : rien n'en a été tiré, pour ne pas enregistrer de montants non lus.

Ce dossier contient donc uniquement l'outillage :

| Fichier | Rôle |
| --- | --- |
| `taxonomy.json` | 15 catégories de produits, 12 familles et 65 tags de prestations |
| `schema.md` | Format d'un fichier `insurers/<clé>.json` |
| `research-brief.md` | Consigne de recherche par assureur (périmètre, sources, règle `read` / `secondary`) |
| `source-leads.md` | URL officielles repérées par la recherche, non lues |
| `../../../scripts/supplementary-insurance-build.py` | Contrôle les fichiers assureurs et produit `products.json`, `benefits.csv`, `premiums.csv`, `quality.json` |

## Assureurs retenus

Assura, Groupe Mutuel, CSS, Helsana, Sanitas, CONCORDIA, SWICA, AXA, Atupri, Visana, Sympany, KPT.

## Pour reprendre

1. Ouvrir le réseau de la session aux hôtes listés dans `source-leads.md` (pages et PDF). Les hôtes techniques des calculateurs de primes restent à observer une fois les pages d'entrée chargées.
2. Relancer la recherche par assureur avec `research-brief.md` ; chaque assureur écrit `insurers/<clé>.json`.
3. Relever les primes dans les calculateurs officiels **pour chaque année de naissance** (demande du 18 novembre 2026 : pas seulement des tranches d'âge), les autres paramètres étant fixés par profil (sexe, localité, franchise, accident). Les ajouter dans `pricing.publishedPrices` avec `birthYear`, `age` et `sourceType: "official_calculator"`. Quand un assureur tarife par tranche, relever les bornes exactes de la tranche (`ageBand`) et en déduire les années de naissance, sans interpoler.
4. Lancer `python3 scripts/supplementary-insurance-build.py 2027` et traiter les anomalies de `quality.json`.
