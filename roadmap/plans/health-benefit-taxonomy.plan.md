# Plan — Prestations supplémentaires uniformisées des modèles LAMal 2027

> Statut : livré localement le 4 octobre 2026 — approuvé par mandat (`roadmap/execution-policy.md`, autonomie maximale), demande utilisateur du même jour. Recette : [health-benefit-taxonomy.md](../evidence/health-benefit-taxonomy.md)
> **Session requise** (PROG-12) : recherche documentaire multi-assureurs + moteur ; effort maximal
> **Session réelle** : Claude Opus 5.5 (`claude-opus-5-5`), effort max, Claude Code desktop
> **Budget** (PROG-14) : 1 session

## Demande

« Pour toutes les compagnies d’assurance maladie utilisées dans le comparateur, rends-toi sur la page web produit de chaque modèle, extrais toutes les prestations supplémentaires du modèle en plus de la LAMal (avantage concurrentiel). Catégorise et uniformise celles qui sont similaires. Ajoute-les au système/base de données et prends-les en compte dans la détermination du modèle le plus approprié pour le client. » Branche dédiée, fusion sur `main` à la fin.

## Constat initial

- Comparateur, moteur adaptatif et catalogue de preuves présents seulement sur `claude/partner-merge` (c6cb640). Branche `claude/health-benefits` créée depuis ce commit, worktree séparé : les services de preview du checkout principal et le travail partenaire non commité (`coverview-astra-integration`) ne sont pas touchés.
- Catalogue 2027 actuel : 138 fiches, 68 `equivalenceGroup` libres dont plusieurs synonymes (`telemedicine_advice_free` / `telemedicine_initial_advice`, `partner_discounts` / `member_partner_discounts`…). La déduplication des services par groupe échoue donc sur des synonymes.
- Le moteur ne valorise une prestation que si elle est vérifiée et confirmée 2027 (18 fiches sur 138) et pose ses questions fiche par fiche : les prestations ne pèsent presque jamais dans le classement.

## Décisions (mandat : meilleurs défauts documentés)

1. **Taxonomie canonique dans le catalogue** (`benefitTypes`), versionnée et publiable avec lui ; chaque fiche porte un `equivalenceGroup` égal à une clé canonique et la famille correspondante. Libellé uniforme + synonymes assureurs ; la formulation propre de l’assureur reste dans `title` / `insurerTerm`. Pas de table ni de migration : le catalogue est déjà persisté en `jsonb` versionné (`health_recommendation_catalogs`) avec import CLI et publication Admin auditée. Évite aussi toute collision avec la migration partenaire 0070 non commitée.
2. **Préférence par type** : nouvelle question `benefit_types` (« quelles prestations utiliseriez-vous réellement ? »), options = types valorisables présents parmi les offres candidates. Elle remplace la question par catégories `lifestyle` dans le parcours automatique ; `lifestyle` reste valide pour les réponses existantes.
3. **Seuil de preuve administrable** `serviceEvidence` dans les règles : `official` (défaut) = une prestation annoncée sur une source officielle de l’assureur compte dans l’utilité « services » ; `verified` = seulement les preuves vérifiées et confirmées 2027. Les **montants** (exonérations, plafonds, rabais) restent calculés uniquement avec une preuve vérifiée, contractuelle et confirmée pour l’année : aucune économie certaine n’est fabriquée.
4. Si le meneur change selon que l’on retienne ou non les prestations non confirmées 2027, le résultat devient `provisional` (`benefit_evidence_unconfirmed`) : la réserve n’apparaît que lorsqu’elle est décisive.
5. Les avantages exigeant une complémentaire, indépendants de la base (`requiresSameBase: false`), communs légaux ou payants ne créent pas de points.

## Definition of Done — oracles

- [x] Recherche web des 153 modèles / 32 assureurs, sources officielles consultées le 4 octobre 2026, fichiers `data/health-insurance/2027/research/review-c*.json` — oracle : contrôle mécanique de couverture (tous les modèles présents, aucun id inconnu).
- [x] Taxonomie + catalogue réassemblé (`scripts/health-research-catalog.py`) et validé par le contrat strict + `validateCatalog` — oracle : V1 `recommendation.import.ts --validate`.
- [x] Moteur : question par type, utilité services par type dédupliquée, seuil de preuve, réserve décisive — oracle : V2 `vitest recommendation.test.ts` (cas ajoutés).
- [x] WWW : libellés uniformes dans le volet du modèle, filtre du comparateur par types, prestations retenues dans l’explication du résultat — oracle : V0/V1 types + build WWW, V3 parcours réel navigateur sur base locale clonée.
- [x] Import réel dans une base locale dédiée (clone), API + WWW du worktree sur ports distincts — oracle : V3.
- [x] Ledger `roadmap/evidence/health-benefit-taxonomy.md`, README module, backlog/state à jour.
- [ ] Page Admin ouverte dans un navigateur — oracle V3 non exécuté (MFA administrateur) ; typage seul.

## Périmètre

- Modules : `health-insurance` (API), contrats `health-recommendation`, `health-insurance` (filtre), WWW comparateur ; Admin seulement pour le nouveau réglage.
- Données : catalogue de preuves 2027 (jsonb existant). Aucune migration, aucune nouvelle dépendance, aucune variable d’environnement.
- Permissions : inchangées (routes publiques en lecture/calcul ; publication Admin existante).
- Événements, rooms, jobs : aucun.

## Satellites

`docs/data.md`, `docs/api.md`, `docs/contracts.md`, `docs/evolution.md` (champs additifs), `docs/frontend.md` (îlot comparateur), `docs/testing.md`. Exclusions : billing, realtime, jobs, seo/geo.

## Risques

- Sources marketing non datées → seuil `official` assumé et affiché « 2027 à confirmer » ; réserve décisive.
- Volume du catalogue public (téléchargé par WWW) → mesurer la taille et la compression.
- Base locale partagée par d’autres sessions → import uniquement dans un clone dédié.

## Hors périmètre

Conditions d’accès complètes des modèles (premier contact) au-delà des notes de recherche ; table héritée `health_benefits` (88 faits, ancienne API) ; contact des assureurs ; déploiement.

## Journal de vérification

| # | Cible | Oracle | Observé | Décision |
|---|---|---|---|---|
| 1 | Installation du worktree | `pnpm install` | lanceur global pnpm 12.3.4 sans binaire | appel direct de `pnpm.exe` du même paquet, sans changer la version |
| 2 | Scripts Python | `ast.parse` | saut de ligne littéral introduit par `sed` dans `newline='\n'` | correction par script Node déterministe, puis syntaxe vérifiée |
| 3 | Import local | garde `assertLocalDatabase` | clone nommé `coverview_health_benefits` refusé | conteneur Postgres dédié où la base s’appelle `coverview_local` ; garde conservée |
| 4 | Latence du guide | `/recommend` réel | 1,2 s avec 23 types sondés un à un | élagage des types non décisifs puis sonde conjointe d’abord avec arrêt anticipé : ~0,5 s |
