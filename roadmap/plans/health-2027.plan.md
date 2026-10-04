# Comparateur public d’assurance maladie 2027

Statut : approuvé par la demande explicite du 30 septembre 2026 et le mandat d’autonomie PROG-23. Cette extension demandée est suivie séparément du travail existant non committé, sans déclarer S-042a terminé.
Session recommandée : GPT-6 Astra / ultra ; session réelle : GPT-6, effort non observable.

## Objectif

Un visiteur compare les primes officielles 2027 par localité et région, explore les trois modèles les moins chers sur une carte suisse, consulte les conditions et avantages sourcés dans un panneau et répond à un questionnaire guidé pour comparer ses coûts et contraintes.

## Décisions

- Données réelles uniquement, année contrôlée dans les fichiers ; import reproductible, idempotent, montants en centimes et provenance avec empreinte. Aucun tarif 2026 renommé 2027.
- Catalogue public distinct des données privées : assureur OFSP, modèle, prime, localité/commune/région, sources, prestations, clubs. Absence de preuve = inconnu (`null`), jamais `false`. Conditions d’éligibilité et assurance complémentaire explicitement séparées.
- Prix classés selon le profil et la région sélectionnés. Pas de commission ni score médical inventé. Les restrictions locales d’un réseau doivent rester visibles.
- Questionnaire à choix reprenant la composition de la capture ; réponses facultatives, retour et réinitialisation. Les réponses sensibles restent éphémères, sans stockage, tracking ni texte libre médical. L’estimation compare primes + participation ordinaire aux coûts, avec limites documentées et réserves financières visibles.
- Route publique `/comparateur-assurance-maladie-2027`. Contenu éditorial SSG, îlot React, API publique en lecture/calcul sans session obligatoire. Politique noindex de la préversion conservée.
- Déploiement distant et souscription ne sont pas implicites. La livraison inclut données importées localement et recette réelle.

## Périmètre et règles

`www`, module API `health-insurance`, `contracts`, `api-client`, migrations Drizzle et outillage d’import. Aucun événement, room ou job permanent nécessaire ; import CLI local borné. Tables publiques sans tenant ; aucune PII persistée. Pas de modification des droits privés.

Références : CLAUDE.md, PROJECT.md, docs/codex.md, architecture.md, backend.md, conventions.md, contracts.md, api.md, data.md, security.md, marketing-web.md, frontend.md, seo.md, geo.md, brand.md, i18n.md, testing.md, environment.md, dependencies.md, program.md. Pas de billing, realtime, LLM, Sites.

## DoD et oracles

- [x] Sources officielles 2027 téléchargées, inventoriées, compteurs et jointures vérifiés.
- [x] Migration additive et import atomique/idempotent exécutés sur PostgreSQL local.
- [x] API réelle : recherche NPA ambiguë, groupes d’âge, accident/franchise, classement stable, prestations et clubs conditionnels.
- [x] Carte aux régions réelles, navigation clavier et clic, trois résultats, panneau ; largeur mobile vérifiée, appareil tactile physique non testé.
- [x] Questionnaire avec coûts annuels et limites, sans collecte privée persistante.
- [x] Typecheck/lint/build ciblés, tests des calculs et intégrité ; recette navigateur bureau/mobile sur données persistées.
- [x] Ledger avec limites de couverture, sources, preuve et commandes reproductibles.
- [ ] Recherche exhaustive et confirmation 2027 de toutes les prestations/clubs : 88 faits documentés, couverture encore partielle et explicitement indiquée.

## Risques

Publication progressive des sources et avantages 2027 : conserver période et statut de vérification, exposer la couverture manquante. NPA couvrant plusieurs communes : choix explicite de la commune. Franchise optimale dépendant des dépenses futures : scénarios et capacité à absorber le reste à charge, aucune promesse médicale. Préserver les nombreux changements préexistants.

## Journal

30.09.2026 : inspection architecture ; publication 2027 confirmée par audit Priminfo en cours. Le shim pnpm utilisateur est cassé ; utiliser le runtime local vérifié, sans modifier sa configuration globale.

30.09.2026 : 219 916 lignes de primes importées, 42 régions réelles, 88 faits sourcés ; deux revues indépendantes et corrections d’éligibilité/états UI/filtrage. 5 tests financiers et 26 assertions API sur PostgreSQL passent. Parcours de 13 questions, filtre de dépistage et panneau mobile constatés dans CUA. Détails et limites : [ledger](../evidence/health-2027.md). Ni publication ni exhaustivité documentaire déclarées ; S-042a conservée running.
