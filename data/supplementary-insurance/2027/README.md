# Complémentaires santé (LCA) — comparatif interne 2027

Pour douze assureurs actifs en Suisse romande : tous les produits d'assurance maladie complémentaire vendus aux particuliers, leurs prestations classées par tags communs, et leurs primes par année de naissance.

Assureurs : Assura, Groupe Mutuel, CSS, Helsana, Sanitas, CONCORDIA, SWICA, AXA, Atupri, Visana, Sympany, KPT.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `insurers/<clé>.json` | Source par assureur : produits, variantes, prestations, facteurs tarifaires, prix publiés. Format dans `schema.md`. |
| `premiums/<clé>.csv` | Primes relevées dans le calculateur officiel, une ligne par produit, variante, année de naissance et sexe. |
| `premiums/<clé>.md` | Méthode du relevé, profil appliqué, limites et anomalies. |
| `premiums/collectors/` | Scripts qui ont produit les relevés, relançables. |
| `taxonomy.json` | 15 catégories de produits, 12 familles et 65 tags de prestations. |
| `products.json` | Consolidé : assureurs et produits, avec les tags couverts par chaque produit. |
| `benefits.csv` | Consolidé : une ligne par prestation, avec famille, tag, taux, plafond, période et source. |
| `premiums.csv` | Consolidé : primes des calculateurs et prix publiés par les assureurs. |
| `quality.json` | Compteurs par assureur et anomalies du contrôle. |
| `research-brief.md`, `premium-brief.md` | Consignes de collecte. |

Les quatre fichiers consolidés sont produits par `python3 scripts/supplementary-insurance-build.py 2027` ; ne pas les modifier à la main.

## Lire les données

- `verification` = `read` : montant lu dans un document officiel de l'assureur (conditions, aperçu des prestations, page produit). `secondary` : source tierce, à confirmer.
- `source_type` d'une prime : `official_calculator` (relevé au calculateur), `official_published` (barème ou prix d'appel publié), `secondary`.
- Un tag `other:<mot>` signale une prestation sans équivalent dans la taxonomie.
- Profil standard des relevés : début au 01.01.2027, 1003 Lausanne, né le 15.06 de chaque année de 1947 à 2026, femme et homme, accident inclus, sans franchise optionnelle, sans assurance de base chez l'assureur quand le calculateur le permet. Les écarts sont décrits dans `premiums/<clé>.md`.
- Les primes des complémentaires dépendent souvent de la région, de l'âge d'entrée et de rabais (famille, durée, combinaison) : un prix vaut pour son profil exact.

## Réseau

La collecte demande l'accès aux sites et calculateurs des assureurs. L'environnement cloud « coverview-universe » les autorise ; `source-leads.md` garde la liste des hôtes et des documents de départ.
