# Index des slices Astra Ultra

> Vue générée depuis les spécifications et `roadmap/state.json`. Modifier les sources canoniques puis régénérer. La planification ne prouve aucune implémentation.

L’ordre est topologique ; les identifiants restent stables. Vérifier dépendances done, décisions et autorisation effective ; le mandat PROG-23 remplace les GO répétés lorsqu’il est actif. Budget d’une session principale par slice.

[Roadmap](../ROADMAP.md) · [Workflows](workflows.md) · [Décisions](decisions.md) · [Prompts](prompts/README.md) · [État](state.json)

## Ordre de travail

| Ordre | Slice | Jalon | Mode | État | Dépendances | Prompt |
|---|---|---|---|---|---|---|
| 1 | [S-000a — Démarrer un socle local reproductible et une preview fictive](plans/S-000a.plan.md) | M0 | foundation | done | — | [prompt](prompts/S-000a.prompt.md) |
| 2 | [S-000b — Se connecter avec WorkOS et retrouver son espace protégé](plans/S-000b.plan.md) | M0 | integration | done | [S-000a](plans/S-000a.plan.md) | [prompt](prompts/S-000b.prompt.md) |
| 3 | [S-013a — Préparer son profil privé et le reprendre dans Wallet](plans/S-013a.plan.md) | M1 | integration | done | [S-000b](plans/S-000b.plan.md) | [prompt](prompts/S-013a.prompt.md) |
| 4 | [S-042a — Conserver ses documents originaux et confirmer les informations extraites dans son profil](plans/S-042a.plan.md) | M8 | integration | specified | [S-013a](plans/S-013a.plan.md) | [prompt](prompts/S-042a.prompt.md) |
| 5 | [S-010 — Ouvrir les trois parcours CoverView depuis un site public compact](plans/S-010.plan.md) | M1 | local-fixtures | done | [S-000a](plans/S-000a.plan.md) | [prompt](prompts/S-010.prompt.md) |
| 6 | [S-081 — Délivrer un dossier avec tâches, prochaine action et Kanban](plans/S-081.plan.md) | M5 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md) | [prompt](prompts/S-081.prompt.md) |
| 7 | [S-017 — Générer et archiver les documents de démarches à partir du profil](plans/S-017.plan.md) | M2 | local-fixtures | specified | [S-013a](plans/S-013a.plan.md) | [prompt](prompts/S-017.prompt.md) |
| 8 | [S-018 — Signer un document de test et suivre son dossier de preuve](plans/S-018.plan.md) | M2 | local-fixtures | specified | [S-017](plans/S-017.plan.md) | [prompt](prompts/S-018.prompt.md) |
| 9 | [S-080 — Qualifier un entrant et suivre plusieurs opportunités distinctes](plans/S-080.plan.md) | M5 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md), [S-013a](plans/S-013a.plan.md) | [prompt](prompts/S-080.prompt.md) |
| 10 | [S-011 — Publier les pages de méthode, preuves et contenus de référence](plans/S-011.plan.md) | M1 | local-fixtures | review | [S-010](plans/S-010.plan.md) | [prompt](prompts/S-011.prompt.md) |
| 11 | [S-012 — Répondre aux FAQ et conserver la provenance déclarée des prospects](plans/S-012.plan.md) | M1 | local-fixtures | specified | [S-011](plans/S-011.plan.md), [S-080](plans/S-080.plan.md) | [prompt](prompts/S-012.prompt.md) |
| 12 | [S-014 — Créer et documenter un produit de catalogue canonique dans Admin](plans/S-014.plan.md) | M2 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md), [S-017](plans/S-017.plan.md) | [prompt](prompts/S-014.prompt.md) |
| 13 | [S-015 — Valider et publier le catalogue sans modifier les analyses passées](plans/S-015.plan.md) | M2 | local-fixtures | specified | [S-014](plans/S-014.plan.md) | [prompt](prompts/S-015.prompt.md) |
| 14 | [S-016 — Versionner et modifier les hypothèses de calcul depuis Admin](plans/S-016.plan.md) | M2 | local-fixtures | specified | [S-015](plans/S-015.plan.md) | [prompt](prompts/S-016.prompt.md) |
| 15 | [S-019 — Centraliser les contrats et leurs documents dans Wallet](plans/S-019.plan.md) | M2 | local-fixtures | specified | [S-013a](plans/S-013a.plan.md), [S-015](plans/S-015.plan.md), [S-017](plans/S-017.plan.md) | [prompt](prompts/S-019.prompt.md) |
| 16 | [S-082 — Lire la vue client 360 et une timeline commune](plans/S-082.plan.md) | M5 | local-fixtures | specified | [S-013a](plans/S-013a.plan.md), [S-019](plans/S-019.plan.md), [S-080](plans/S-080.plan.md), [S-081](plans/S-081.plan.md) | [prompt](prompts/S-082.prompt.md) |
| 17 | [S-021 — Initier et signer une recherche d’avoirs LPP perdus](plans/S-021.plan.md) | M2 | local-fixtures | specified | [S-018](plans/S-018.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-021.prompt.md) |
| 18 | [S-022 — Suivre la recherche LPP jusqu’aux avoirs identifiés et prochaines démarches](plans/S-022.plan.md) | M2 | local-fixtures | specified | [S-021](plans/S-021.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-022.prompt.md) |
| 19 | [S-020 — Demander et suivre la récupération de contrats par compagnie](plans/S-020.plan.md) | M2 | local-fixtures | specified | [S-018](plans/S-018.plan.md), [S-019](plans/S-019.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-020.prompt.md) |
| 20 | [S-023 — Transformer une pièce en données contractuelles avec revue des conflits](plans/S-023.plan.md) | M2 | local-fixtures | specified | [S-019](plans/S-019.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md), [S-042a](plans/S-042a.plan.md) | [prompt](prompts/S-023.prompt.md) |
| 21 | [S-025 — Analyser un 3P sans compte depuis un document ou une saisie minimale](plans/S-025.plan.md) | M3 | local-fixtures | specified | [S-013a](plans/S-013a.plan.md), [S-023](plans/S-023.plan.md) | [prompt](prompts/S-025.prompt.md) |
| 22 | [S-026 — Expliquer le score 3P, son allocation et son benchmark](plans/S-026.plan.md) | M3 | local-fixtures | specified | [S-025](plans/S-025.plan.md), [S-016](plans/S-016.plan.md) | [prompt](prompts/S-026.prompt.md) |
| 23 | [S-024 — Déclencher un audit de contrat complet et rendre les exceptions traitables](plans/S-024.plan.md) | M3 | local-fixtures | specified | [S-023](plans/S-023.plan.md), [S-026](plans/S-026.plan.md), [S-081](plans/S-081.plan.md) | [prompt](prompts/S-024.prompt.md) |
| 24 | [S-028 — Calculer son besoin retraite en CHF actuels et futurs](plans/S-028.plan.md) | M3 | local-fixtures | specified | [S-013a](plans/S-013a.plan.md), [S-016](plans/S-016.plan.md), [S-019](plans/S-019.plan.md) | [prompt](prompts/S-028.prompt.md) |
| 25 | [S-029 — Explorer des probabilités et un âge cible reproductibles](plans/S-029.plan.md) | M3 | local-fixtures | specified | [S-028](plans/S-028.plan.md) | [prompt](prompts/S-029.prompt.md) |
| 26 | [S-030 — Comparer des stratégies compatibles avec son objectif](plans/S-030.plan.md) | M3 | local-fixtures | specified | [S-026](plans/S-026.plan.md), [S-029](plans/S-029.plan.md), [S-015](plans/S-015.plan.md) | [prompt](prompts/S-030.prompt.md) |
| 27 | [S-027 — Découvrir puis rejouer son Reveal et son Retirement World explicables](plans/S-027.plan.md) | M3 | local-fixtures | specified | [S-026](plans/S-026.plan.md), [S-029](plans/S-029.plan.md), [S-030](plans/S-030.plan.md) | [prompt](prompts/S-027.prompt.md) |
| 28 | [S-031 — Sauvegarder un Full Audit et demander une validation experte](plans/S-031.plan.md) | M3 | local-fixtures | specified | [S-024](plans/S-024.plan.md), [S-030](plans/S-030.plan.md), [S-081](plans/S-081.plan.md), [S-080](plans/S-080.plan.md) | [prompt](prompts/S-031.prompt.md) |
| 29 | [S-032 — Partager un Wrapped révocable et comparer des métriques consenties](plans/S-032.plan.md) | M3 | local-fixtures | specified | [S-027](plans/S-027.plan.md), [S-013a](plans/S-013a.plan.md) | [prompt](prompts/S-032.prompt.md) |
| 30 | [S-033 — Suivre une stratégie par Health Check, Wrapped annuel et timeline](plans/S-033.plan.md) | M3 | local-fixtures | specified | [S-031](plans/S-031.plan.md), [S-027](plans/S-027.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-033.prompt.md) |
| 31 | [S-034 — Explorer un royaume retraite persistant en mode bonus](plans/S-034.plan.md) | M3 | local-fixtures | specified | [S-027](plans/S-027.plan.md), [S-033](plans/S-033.plan.md) | [prompt](prompts/S-034.prompt.md) |
| 32 | [S-130 — Exporter et rectifier ses données avec une preuve de traitement](plans/S-130.plan.md) | M9 | local-fixtures | specified | [S-013a](plans/S-013a.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-130.prompt.md) |
| 33 | [S-132 — Reprendre un dossier après panne sans doubler les effets](plans/S-132.plan.md) | M9 | local-fixtures | specified | [S-021](plans/S-021.plan.md), [S-023](plans/S-023.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-132.prompt.md) |
| 34 | [S-131 — Appliquer la conservation et une demande de suppression contrôlée](plans/S-131.plan.md) | M9 | local-fixtures | specified | [S-130](plans/S-130.plan.md), [S-132](plans/S-132.plan.md) | [prompt](prompts/S-131.prompt.md) |
| 35 | [S-050 — Retire Check : première valeur puis sauvegarde du foyer dans Wallet](plans/S-050.plan.md) | M4 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md), [S-013a](plans/S-013a.plan.md), [S-028](plans/S-028.plan.md) | [prompt](prompts/S-050.prompt.md) |
| 36 | [S-051 — Retirement Plan : achat simulé et accès durable au même dossier](plans/S-051.plan.md) | M4 | local-fixtures | specified | [S-050](plans/S-050.plan.md) | [prompt](prompts/S-051.prompt.md) |
| 37 | [S-052 — Options LPP autorisées et demande des règles manquantes](plans/S-052.plan.md) | M4 | local-fixtures | specified | [S-050](plans/S-050.plan.md), [S-019](plans/S-019.plan.md), [S-022](plans/S-022.plan.md), [S-023](plans/S-023.plan.md), [S-081](plans/S-081.plan.md) | [prompt](prompts/S-052.prompt.md) |
| 38 | [S-054 — Life Engine : budgets de phase, couple, dépendance et transmission](plans/S-054.plan.md) | M4 | local-fixtures | specified | [S-050](plans/S-050.plan.md), [S-052](plans/S-052.plan.md) | [prompt](prompts/S-054.prompt.md) |
| 39 | [S-056 — Profil Monte-Carlo Retire dans le moteur commun](plans/S-056.plan.md) | M4 | local-fixtures | specified | [S-029](plans/S-029.plan.md), [S-052](plans/S-052.plan.md), [S-054](plans/S-054.plan.md) | [prompt](prompts/S-056.prompt.md) |
| 40 | [S-053 — Aujourd'hui : Retirement Range et indicateurs explicables](plans/S-053.plan.md) | M4 | local-fixtures | specified | [S-051](plans/S-051.plan.md), [S-052](plans/S-052.plan.md), [S-056](plans/S-056.plan.md) | [prompt](prompts/S-053.prompt.md) |
| 41 | [S-055 — Explorer et Timeline : variantes de vie comparables sans écraser le plan](plans/S-055.plan.md) | M4 | local-fixtures | specified | [S-053](plans/S-053.plan.md), [S-054](plans/S-054.plan.md) | [prompt](prompts/S-055.prompt.md) |
| 42 | [S-057 — Stress tests Retire : comprendre les crises sans fausser les probabilités](plans/S-057.plan.md) | M4 | local-fixtures | specified | [S-053](plans/S-053.plan.md), [S-054](plans/S-054.plan.md), [S-056](plans/S-056.plan.md) | [prompt](prompts/S-057.prompt.md) |
| 43 | [S-058 — Growth : politique de référence et expositions look-through](plans/S-058.plan.md) | M4 | local-fixtures | specified | [S-052](plans/S-052.plan.md), [S-056](plans/S-056.plan.md), [S-015](plans/S-015.plan.md) | [prompt](prompts/S-058.prompt.md) |
| 44 | [S-059 — Income et Safety : missions de revenu et réserve dynamique](plans/S-059.plan.md) | M4 | local-fixtures | specified | [S-054](plans/S-054.plan.md), [S-058](plans/S-058.plan.md) | [prompt](prompts/S-059.prompt.md) |
| 45 | [S-060 — Lombard Bridge : stress de secours et risque de marge](plans/S-060.plan.md) | M4 | local-fixtures | specified | [S-056](plans/S-056.plan.md), [S-058](plans/S-058.plan.md), [S-059](plans/S-059.plan.md) | [prompt](prompts/S-060.prompt.md) |
| 46 | [S-061 — Growth Cascade : flux de crise, récupération, bonus et non-intervention](plans/S-061.plan.md) | M4 | local-fixtures | specified | [S-054](plans/S-054.plan.md), [S-058](plans/S-058.plan.md), [S-059](plans/S-059.plan.md), [S-060](plans/S-060.plan.md) | [prompt](prompts/S-061.prompt.md) |
| 47 | [S-062 — Optimiser revenu et mix rente/capital sous contraintes](plans/S-062.plan.md) | M4 | local-fixtures | specified | [S-052](plans/S-052.plan.md), [S-053](plans/S-053.plan.md), [S-054](plans/S-054.plan.md), [S-056](plans/S-056.plan.md), [S-057](plans/S-057.plan.md), [S-061](plans/S-061.plan.md) | [prompt](prompts/S-062.prompt.md) |
| 48 | [S-064 — Care : abonnement ou inclusion explicite et droits cohérents](plans/S-064.plan.md) | M4 | local-fixtures | specified | [S-051](plans/S-051.plan.md) | [prompt](prompts/S-064.prompt.md) |
| 49 | [S-067 — Admin : gouverner les paramètres Retire et leurs versions publiées](plans/S-067.plan.md) | M4 | local-fixtures | specified | [S-052](plans/S-052.plan.md), [S-056](plans/S-056.plan.md), [S-058](plans/S-058.plan.md), [S-059](plans/S-059.plan.md), [S-060](plans/S-060.plan.md), [S-061](plans/S-061.plan.md), [S-062](plans/S-062.plan.md), [S-081](plans/S-081.plan.md) | [prompt](prompts/S-067.prompt.md) |
| 50 | [S-083 — Traiter une boîte de réception orientée dossiers avec emails fictifs](plans/S-083.plan.md) | M5 | local-fixtures | specified | [S-017](plans/S-017.plan.md), [S-023](plans/S-023.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-083.prompt.md) |
| 51 | [S-084 — Planifier un rendez-vous et assurer sa suite dans Admin](plans/S-084.plan.md) | M5 | local-fixtures | specified | [S-080](plans/S-080.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md) | [prompt](prompts/S-084.prompt.md) |
| 52 | [S-063 — Strategy : crédit Plan unique, dossier expert et décision conservée](plans/S-063.plan.md) | M4 | local-fixtures | specified | [S-051](plans/S-051.plan.md), [S-052](plans/S-052.plan.md), [S-062](plans/S-062.plan.md), [S-081](plans/S-081.plan.md), [S-084](plans/S-084.plan.md) | [prompt](prompts/S-063.prompt.md) |
| 53 | [S-086 — Expliquer le pipeline pondéré et ses écarts aux objectifs](plans/S-086.plan.md) | M5 | local-fixtures | specified | [S-080](plans/S-080.plan.md) | [prompt](prompts/S-086.prompt.md) |
| 54 | [S-087 — Suivre revenus acquis, commissions dues et encaissements distincts](plans/S-087.plan.md) | M5 | local-fixtures | specified | [S-080](plans/S-080.plan.md), [S-086](plans/S-086.plan.md) | [prompt](prompts/S-087.prompt.md) |
| 55 | [S-085 — Enchaîner les événements métier sans perdre la prochaine action](plans/S-085.plan.md) | M5 | local-fixtures | specified | [S-018](plans/S-018.plan.md), [S-022](plans/S-022.plan.md), [S-024](plans/S-024.plan.md), [S-033](plans/S-033.plan.md), [S-080](plans/S-080.plan.md), [S-081](plans/S-081.plan.md), [S-083](plans/S-083.plan.md), [S-084](plans/S-084.plan.md), [S-087](plans/S-087.plan.md) | [prompt](prompts/S-085.prompt.md) |
| 56 | [S-065 — Care : événement de vie, recalcul, alerte et prochaine action](plans/S-065.plan.md) | M4 | local-fixtures | specified | [S-055](plans/S-055.plan.md), [S-062](plans/S-062.plan.md), [S-064](plans/S-064.plan.md), [S-081](plans/S-081.plan.md), [S-085](plans/S-085.plan.md) | [prompt](prompts/S-065.prompt.md) |
| 57 | [S-066 — Annual/Event Review : service ponctuel et nouveau plan comparable](plans/S-066.plan.md) | M4 | local-fixtures | specified | [S-063](plans/S-063.plan.md), [S-065](plans/S-065.plan.md), [S-084](plans/S-084.plan.md) | [prompt](prompts/S-066.prompt.md) |
| 58 | [S-088 — Piloter la charge, les exceptions et le revenu depuis le cockpit](plans/S-088.plan.md) | M5 | local-fixtures | specified | [S-022](plans/S-022.plan.md), [S-023](plans/S-023.plan.md), [S-024](plans/S-024.plan.md), [S-033](plans/S-033.plan.md), [S-080](plans/S-080.plan.md), [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md), [S-083](plans/S-083.plan.md), [S-084](plans/S-084.plan.md), [S-086](plans/S-086.plan.md), [S-087](plans/S-087.plan.md) | [prompt](prompts/S-088.prompt.md) |
| 59 | [S-091 — Poser une question de couverture et retrouver les contrats applicables](plans/S-091.plan.md) | M6 | local-fixtures | specified | [S-015](plans/S-015.plan.md), [S-019](plans/S-019.plan.md), [S-023](plans/S-023.plan.md) | [prompt](prompts/S-091.prompt.md) |
| 60 | [S-092 — Lire une réponse de couverture prudente, citée et contrôlée](plans/S-092.plan.md) | M6 | local-fixtures | specified | [S-091](plans/S-091.plan.md) | [prompt](prompts/S-092.prompt.md) |
| 61 | [S-093 — Transformer la conversation en assistance suivie dans Wallet](plans/S-093.plan.md) | M6 | local-fixtures | specified | [S-081](plans/S-081.plan.md), [S-082](plans/S-082.plan.md), [S-092](plans/S-092.plan.md) | [prompt](prompts/S-093.prompt.md) |
| 62 | [S-094 — Interroger Admin depuis un chat global ou lié à un objet](plans/S-094.plan.md) | M5 | local-fixtures | specified | [S-082](plans/S-082.plan.md), [S-086](plans/S-086.plan.md) | [prompt](prompts/S-094.prompt.md) |
| 63 | [S-095 — Exécuter une action IA typée avec aperçu et confirmation exacte](plans/S-095.plan.md) | M5 | local-fixtures | specified | [S-081](plans/S-081.plan.md), [S-083](plans/S-083.plan.md), [S-094](plans/S-094.plan.md) | [prompt](prompts/S-095.prompt.md) |
| 64 | [S-096 — Matérialiser les pièces du chat en données et tâches sourcées](plans/S-096.plan.md) | M5 | local-fixtures | specified | [S-014](plans/S-014.plan.md), [S-019](plans/S-019.plan.md), [S-023](plans/S-023.plan.md), [S-095](plans/S-095.plan.md) | [prompt](prompts/S-096.prompt.md) |
| 65 | [S-097 — Dicter, commander et capturer une pièce depuis Admin mobile](plans/S-097.plan.md) | M5 | local-fixtures | specified | [S-095](plans/S-095.plan.md), [S-096](plans/S-096.plan.md) | [prompt](prompts/S-097.prompt.md) |
| 66 | [S-101 — Créer et révoquer une carte de membre à jeton opaque](plans/S-101.plan.md) | M6 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md) | [prompt](prompts/S-101.prompt.md) |
| 67 | [S-103 — Consulter un compte Miles adossé à un ledger immuable](plans/S-103.plan.md) | M6 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md) | [prompt](prompts/S-103.prompt.md) |
| 68 | [S-104 — Gagner des Miles par règles et campagnes versionnées](plans/S-104.plan.md) | M6 | local-fixtures | specified | [S-019](plans/S-019.plan.md), [S-051](plans/S-051.plan.md), [S-087](plans/S-087.plan.md), [S-103](plans/S-103.plan.md) | [prompt](prompts/S-104.prompt.md) |
| 69 | [S-105 — Réserver une récompense dans le shop avec débit atomique](plans/S-105.plan.md) | M6 | local-fixtures | specified | [S-051](plans/S-051.plan.md), [S-104](plans/S-104.plan.md) | [prompt](prompts/S-105.prompt.md) |
| 70 | [S-106 — Valider et consommer un avantage chez le partenaire autorisé](plans/S-106.plan.md) | M6 | local-fixtures | specified | [S-101](plans/S-101.plan.md), [S-105](plans/S-105.plan.md) | [prompt](prompts/S-106.prompt.md) |
| 71 | [S-107 — Annuler, rembourser et rapprocher une redemption](plans/S-107.plan.md) | M6 | local-fixtures | specified | [S-106](plans/S-106.plan.md) | [prompt](prompts/S-107.prompt.md) |
| 72 | [S-108 — Contrôler fraude et responsabilité financière de la fidélité](plans/S-108.plan.md) | M6 | local-fixtures | specified | [S-104](plans/S-104.plan.md), [S-107](plans/S-107.plan.md) | [prompt](prompts/S-108.prompt.md) |
| 73 | [S-110 — Apporter un lead et suivre sa progression autorisée dans Partners](plans/S-110.plan.md) | M7 | local-fixtures | specified | [S-080](plans/S-080.plan.md), [S-087](plans/S-087.plan.md) | [prompt](prompts/S-110.prompt.md) |
| 74 | [S-111 — Proposer une offre partenaire et suivre ses transactions propres](plans/S-111.plan.md) | M7 | local-fixtures | specified | [S-106](plans/S-106.plan.md), [S-107](plans/S-107.plan.md), [S-110](plans/S-110.plan.md) | [prompt](prompts/S-111.prompt.md) |
| 75 | [S-114 — Définir un risque paramétrique isolé et simuler des engagements](plans/S-114.plan.md) | M7 | local-fixtures | specified | [S-000b](plans/S-000b.plan.md) | [prompt](prompts/S-114.prompt.md) |
| 76 | [S-115 — Observer un paramètre et régler un risque Exchange en démonstration](plans/S-115.plan.md) | M7 | local-fixtures | specified | [S-114](plans/S-114.plan.md) | [prompt](prompts/S-115.prompt.md) |
| 77 | [S-000c — Ouvrir le premier parcours sur une infrastructure Infomaniak dédiée](plans/S-000c.plan.md) | M0 | integration | specified | [S-000b](plans/S-000b.plan.md) | [prompt](prompts/S-000c.prompt.md) |
| 78 | [S-035 — Activer la signature réelle des documents et ses preuves](plans/S-035.plan.md) | M8 | integration | specified | [S-018](plans/S-018.plan.md) | [prompt](prompts/S-035.prompt.md) |
| 79 | [S-037 — Classer et extraire réellement des documents avec un adapter approuvé](plans/S-037.plan.md) | M8 | integration | specified | [S-023](plans/S-023.plan.md), [S-042a](plans/S-042a.plan.md) | [prompt](prompts/S-037.prompt.md) |
| 80 | [S-039 — Répondre réellement aux FAQ à partir du corpus public cité](plans/S-039.plan.md) | M8 | integration | specified | [S-012](plans/S-012.plan.md) | [prompt](prompts/S-039.prompt.md) |
| 81 | [S-040 — Alimenter le catalogue et les marchés par des sources réelles validées](plans/S-040.plan.md) | M8 | integration | specified | [S-015](plans/S-015.plan.md), [S-023](plans/S-023.plan.md) | [prompt](prompts/S-040.prompt.md) |
| 82 | [S-112 — Analyser le catalogue et publier une proposition professionnelle sourcée](plans/S-112.plan.md) | M7 | local-fixtures | specified | [S-015](plans/S-015.plan.md), [S-024](plans/S-024.plan.md), [S-029](plans/S-029.plan.md), [S-030](plans/S-030.plan.md), [S-040](plans/S-040.plan.md) | [prompt](prompts/S-112.prompt.md) |
| 83 | [S-042 — Scanner une pièce d’identité pour enrichir le profil confirmé](plans/S-042.plan.md) | M8 | integration | specified | [S-013a](plans/S-013a.plan.md), [S-037](plans/S-037.plan.md), [S-131](plans/S-131.plan.md), [S-042a](plans/S-042a.plan.md) | [prompt](prompts/S-042.prompt.md) |
| 84 | [S-013 — Reprendre un parcours anonyme dans Wallet avec un profil central](plans/S-013.plan.md) | M1 | integration | specified | [S-013a](plans/S-013a.plan.md), [S-015](plans/S-015.plan.md), [S-019](plans/S-019.plan.md), [S-025](plans/S-025.plan.md), [S-028](plans/S-028.plan.md), [S-030](plans/S-030.plan.md), [S-042](plans/S-042.plan.md), [S-050](plans/S-050.plan.md) | [prompt](prompts/S-013.prompt.md) |
| 85 | [S-043 — Valider l'accumulation et ses probabilités sur un corpus indépendant](plans/S-043.plan.md) | M8 | integration | specified | [S-028](plans/S-028.plan.md), [S-029](plans/S-029.plan.md), [S-040](plans/S-040.plan.md) | [prompt](prompts/S-043.prompt.md) |
| 86 | [S-044 — Valider Score, Investment Age, Freshness et cohortes comparables](plans/S-044.plan.md) | M8 | integration | specified | [S-026](plans/S-026.plan.md), [S-040](plans/S-040.plan.md) | [prompt](prompts/S-044.prompt.md) |
| 87 | [S-045 — Valider compatibilité stratégique et traduction Retirement World](plans/S-045.plan.md) | M8 | integration | specified | [S-027](plans/S-027.plan.md), [S-030](plans/S-030.plan.md), [S-043](plans/S-043.plan.md), [S-044](plans/S-044.plan.md) | [prompt](prompts/S-045.prompt.md) |
| 88 | [S-038 — Composer et activer les méthodes accumulation, score et compatibilité validées](plans/S-038.plan.md) | M8 | integration | specified | [S-043](plans/S-043.plan.md), [S-044](plans/S-044.plan.md), [S-045](plans/S-045.plan.md) | [prompt](prompts/S-038.prompt.md) |
| 89 | [S-069 — Stripe réel : Plan, crédit Strategy, Care et Review en environnement test](plans/S-069.plan.md) | M8 | integration | specified | [S-051](plans/S-051.plan.md), [S-063](plans/S-063.plan.md), [S-064](plans/S-064.plan.md), [S-066](plans/S-066.plan.md) | [prompt](prompts/S-069.prompt.md) |
| 90 | [S-089 — Connecter Gmail professionnel et traiter un vrai thread de test](plans/S-089.plan.md) | M8 | integration | specified | [S-083](plans/S-083.plan.md), [S-037](plans/S-037.plan.md) | [prompt](prompts/S-089.prompt.md) |
| 91 | [S-036 — Transmettre réellement les demandes LPP et de récupération de contrats](plans/S-036.plan.md) | M8 | integration | specified | [S-020](plans/S-020.plan.md), [S-022](plans/S-022.plan.md), [S-035](plans/S-035.plan.md), [S-089](plans/S-089.plan.md) | [prompt](prompts/S-036.prompt.md) |
| 92 | [S-041 — Rapprocher les réponses réelles des organismes et clôturer les demandes](plans/S-041.plan.md) | M8 | integration | specified | [S-036](plans/S-036.plan.md), [S-037](plans/S-037.plan.md), [S-089](plans/S-089.plan.md), [S-022](plans/S-022.plan.md), [S-024](plans/S-024.plan.md) | [prompt](prompts/S-041.prompt.md) |
| 93 | [S-074 — Qualifier les sources Retire : caisse, vie, EMS et conditions Lombard](plans/S-074.plan.md) | M8 | integration | specified | [S-038](plans/S-038.plan.md), [S-040](plans/S-040.plan.md), [S-041](plans/S-041.plan.md), [S-052](plans/S-052.plan.md), [S-054](plans/S-054.plan.md), [S-067](plans/S-067.plan.md) | [prompt](prompts/S-074.prompt.md) |
| 94 | [S-075 — Valider les flux Cascade et l'optimisation sur cas indépendants](plans/S-075.plan.md) | M8 | integration | specified | [S-074](plans/S-074.plan.md), [S-058](plans/S-058.plan.md), [S-059](plans/S-059.plan.md), [S-060](plans/S-060.plan.md), [S-061](plans/S-061.plan.md), [S-062](plans/S-062.plan.md), [S-067](plans/S-067.plan.md) | [prompt](prompts/S-075.prompt.md) |
| 95 | [S-076 — Valider sampling, indicateurs, Retirement Range et stress Retire](plans/S-076.plan.md) | M8 | integration | specified | [S-075](plans/S-075.plan.md), [S-053](plans/S-053.plan.md), [S-056](plans/S-056.plan.md), [S-057](plans/S-057.plan.md) | [prompt](prompts/S-076.prompt.md) |
| 96 | [S-068 — Composer et activer les sources et méthodes Retire validées](plans/S-068.plan.md) | M8 | integration | specified | [S-074](plans/S-074.plan.md), [S-075](plans/S-075.plan.md), [S-076](plans/S-076.plan.md) | [prompt](prompts/S-068.prompt.md) |
| 97 | [S-113 — Comparer des stratégies Retire dans Intelligence avec sources communes](plans/S-113.plan.md) | M7 | local-fixtures | specified | [S-052](plans/S-052.plan.md), [S-053](plans/S-053.plan.md), [S-054](plans/S-054.plan.md), [S-056](plans/S-056.plan.md), [S-058](plans/S-058.plan.md), [S-059](plans/S-059.plan.md), [S-060](plans/S-060.plan.md), [S-061](plans/S-061.plan.md), [S-062](plans/S-062.plan.md), [S-067](plans/S-067.plan.md), [S-068](plans/S-068.plan.md), [S-112](plans/S-112.plan.md) | [prompt](prompts/S-113.prompt.md) |
| 98 | [S-070 — Valider le périmètre Retire réellement commercialisable](plans/S-070.plan.md) | M8 | release | specified | [S-062](plans/S-062.plan.md), [S-067](plans/S-067.plan.md), [S-068](plans/S-068.plan.md), [S-069](plans/S-069.plan.md) | [prompt](prompts/S-070.prompt.md) |
| 99 | [S-071 — Distribuer Retire aux partenaires, employeurs et clients B2B](plans/S-071.plan.md) | M4 | local-fixtures | specified | [S-050](plans/S-050.plan.md), [S-063](plans/S-063.plan.md), [S-067](plans/S-067.plan.md), [S-070](plans/S-070.plan.md), [S-087](plans/S-087.plan.md), [S-110](plans/S-110.plan.md) | [prompt](prompts/S-071.prompt.md) |
| 100 | [S-090 — Synchroniser Google Calendar et le rendez-vous de suivi réel](plans/S-090.plan.md) | M8 | integration | specified | [S-084](plans/S-084.plan.md) | [prompt](prompts/S-090.prompt.md) |
| 101 | [S-098 — Brancher le LLM réel pour copilote et couverture avec évaluations](plans/S-098.plan.md) | M8 | integration | specified | [S-092](plans/S-092.plan.md), [S-095](plans/S-095.plan.md), [S-096](plans/S-096.plan.md), [S-037](plans/S-037.plan.md) | [prompt](prompts/S-098.prompt.md) |
| 102 | [S-072 — Copilote Retire : expliquer un run et préparer une action autorisée](plans/S-072.plan.md) | M8 | integration | specified | [S-056](plans/S-056.plan.md), [S-062](plans/S-062.plan.md), [S-067](plans/S-067.plan.md), [S-081](plans/S-081.plan.md), [S-094](plans/S-094.plan.md), [S-095](plans/S-095.plan.md), [S-098](plans/S-098.plan.md) | [prompt](prompts/S-072.prompt.md) |
| 103 | [S-099 — Transcrire réellement la voix Admin et la question de couverture](plans/S-099.plan.md) | M8 | integration | specified | [S-097](plans/S-097.plan.md), [S-098](plans/S-098.plan.md), [S-091](plans/S-091.plan.md) | [prompt](prompts/S-099.prompt.md) |
| 104 | [S-100 — Résoudre un dossier support par copilote de bout en bout](plans/S-100.plan.md) | M8 | integration | specified | [S-093](plans/S-093.plan.md), [S-095](plans/S-095.plan.md), [S-096](plans/S-096.plan.md), [S-098](plans/S-098.plan.md), [S-099](plans/S-099.plan.md), [S-089](plans/S-089.plan.md), [S-090](plans/S-090.plan.md) | [prompt](prompts/S-100.prompt.md) |
| 105 | [S-102 — Installer et mettre à jour les pass Apple et Google réels](plans/S-102.plan.md) | M8 | integration | specified | [S-101](plans/S-101.plan.md), [S-103](plans/S-103.plan.md) | [prompt](prompts/S-102.prompt.md) |
| 106 | [S-109 — Activer les rewards et gains approuvés avec exécution réelle](plans/S-109.plan.md) | M8 | integration | specified | [S-069](plans/S-069.plan.md), [S-102](plans/S-102.plan.md), [S-108](plans/S-108.plan.md) | [prompt](prompts/S-109.prompt.md) |
| 107 | [S-119 — Rapprocher et payer un partenaire via le prestataire validé](plans/S-119.plan.md) | M8 | integration | specified | [S-069](plans/S-069.plan.md), [S-087](plans/S-087.plan.md), [S-109](plans/S-109.plan.md), [S-110](plans/S-110.plan.md), [S-111](plans/S-111.plan.md) | [prompt](prompts/S-119.prompt.md) |
| 108 | [S-120 — Admettre un participant Exchange et garantir son engagement réel](plans/S-120.plan.md) | M8 | integration | specified | [S-114](plans/S-114.plan.md) | [prompt](prompts/S-120.prompt.md) |
| 109 | [S-116 — Activer les métriques et le règlement Exchange réellement qualifiés](plans/S-116.plan.md) | M8 | release | specified | [S-115](plans/S-115.plan.md), [S-120](plans/S-120.plan.md) | [prompt](prompts/S-116.prompt.md) |
| 110 | [S-121 — Étendre le copilote aux actions métier CRM, catalogue et fidélité](plans/S-121.plan.md) | M8 | integration | specified | [S-085](plans/S-085.plan.md), [S-087](plans/S-087.plan.md), [S-094](plans/S-094.plan.md), [S-095](plans/S-095.plan.md), [S-098](plans/S-098.plan.md), [S-108](plans/S-108.plan.md), [S-111](plans/S-111.plan.md), [S-112](plans/S-112.plan.md), [S-089](plans/S-089.plan.md), [S-090](plans/S-090.plan.md) | [prompt](prompts/S-121.prompt.md) |
| 111 | [S-118 — Traiter les exceptions finales et observer les parcours croisés](plans/S-118.plan.md) | M8 | integration | specified | [S-085](plans/S-085.plan.md), [S-088](plans/S-088.plan.md), [S-100](plans/S-100.plan.md), [S-107](plans/S-107.plan.md), [S-108](plans/S-108.plan.md), [S-109](plans/S-109.plan.md), [S-111](plans/S-111.plan.md), [S-119](plans/S-119.plan.md), [S-121](plans/S-121.plan.md) | [prompt](prompts/S-118.prompt.md) |
| 112 | [S-122 — Interroger ses objets Partners et Intelligence et suivre une tâche d’analyse](plans/S-122.plan.md) | M8 | integration | specified | [S-081](plans/S-081.plan.md), [S-110](plans/S-110.plan.md), [S-112](plans/S-112.plan.md), [S-121](plans/S-121.plan.md) | [prompt](prompts/S-122.prompt.md) |
| 113 | [S-133 — Lire les parcours d’acquisition et de traitement avec leurs dénominateurs](plans/S-133.plan.md) | M9 | local-fixtures | specified | [S-012](plans/S-012.plan.md), [S-020](plans/S-020.plan.md), [S-022](plans/S-022.plan.md), [S-027](plans/S-027.plan.md), [S-031](plans/S-031.plan.md), [S-032](plans/S-032.plan.md), [S-033](plans/S-033.plan.md) | [prompt](prompts/S-133.prompt.md) |
| 114 | [S-134 — Mesurer opérations, copilotes et fidélité sans confusion de valeur](plans/S-134.plan.md) | M9 | local-fixtures | specified | [S-088](plans/S-088.plan.md), [S-100](plans/S-100.plan.md), [S-109](plans/S-109.plan.md), [S-118](plans/S-118.plan.md) | [prompt](prompts/S-134.prompt.md) |
| 115 | [S-135 — Éprouver les assistants contre les fuites et actions indues](plans/S-135.plan.md) | M9 | local-fixtures | specified | [S-039](plans/S-039.plan.md), [S-093](plans/S-093.plan.md), [S-100](plans/S-100.plan.md) | [prompt](prompts/S-135.prompt.md) |
| 116 | [S-136 — Autoriser les résultats calculés après validation indépendante](plans/S-136.plan.md) | M9 | local-fixtures | specified | [S-038](plans/S-038.plan.md), [S-068](plans/S-068.plan.md), [S-067](plans/S-067.plan.md) | [prompt](prompts/S-136.prompt.md) |
| 117 | [S-073 — Activer Retire et vérifier les parcours payants, Care et distribution](plans/S-073.plan.md) | M8 | release | specified | [S-000c](plans/S-000c.plan.md), [S-055](plans/S-055.plan.md), [S-065](plans/S-065.plan.md), [S-066](plans/S-066.plan.md), [S-068](plans/S-068.plan.md), [S-069](plans/S-069.plan.md), [S-070](plans/S-070.plan.md), [S-071](plans/S-071.plan.md), [S-072](plans/S-072.plan.md), [S-089](plans/S-089.plan.md), [S-090](plans/S-090.plan.md), [S-113](plans/S-113.plan.md), [S-136](plans/S-136.plan.md) | [prompt](prompts/S-073.prompt.md) |
| 118 | [S-117 — Retrouver tous ses résultats, démarches et avantages dans Wallet](plans/S-117.plan.md) | M7 | local-fixtures | specified | [S-013](plans/S-013.plan.md), [S-019](plans/S-019.plan.md), [S-022](plans/S-022.plan.md), [S-024](plans/S-024.plan.md), [S-026](plans/S-026.plan.md), [S-030](plans/S-030.plan.md), [S-031](plans/S-031.plan.md), [S-033](plans/S-033.plan.md), [S-063](plans/S-063.plan.md), [S-064](plans/S-064.plan.md), [S-065](plans/S-065.plan.md), [S-073](plans/S-073.plan.md), [S-093](plans/S-093.plan.md), [S-102](plans/S-102.plan.md), [S-109](plans/S-109.plan.md) | [prompt](prompts/S-117.prompt.md) |
| 119 | [S-137 — Publier les conditions et consentements validés par parcours](plans/S-137.plan.md) | M9 | local-fixtures | specified | [S-017](plans/S-017.plan.md), [S-051](plans/S-051.plan.md), [S-093](plans/S-093.plan.md), [S-109](plans/S-109.plan.md), [S-116](plans/S-116.plan.md), [S-131](plans/S-131.plan.md) | [prompt](prompts/S-137.prompt.md) |
| 120 | [S-138 — Vérifier accès, mobile et parcours sur toutes les surfaces](plans/S-138.plan.md) | M9 | local-fixtures | specified | [S-034](plans/S-034.plan.md), [S-071](plans/S-071.plan.md), [S-117](plans/S-117.plan.md), [S-116](plans/S-116.plan.md), [S-135](plans/S-135.plan.md) | [prompt](prompts/S-138.prompt.md) |
| 121 | [S-139 — Accepter la v1 complète par les workflows et les invariants de la bible](plans/S-139.plan.md) | M9 | release | specified | [S-035](plans/S-035.plan.md), [S-036](plans/S-036.plan.md), [S-037](plans/S-037.plan.md), [S-040](plans/S-040.plan.md), [S-041](plans/S-041.plan.md), [S-042](plans/S-042.plan.md), [S-073](plans/S-073.plan.md), [S-089](plans/S-089.plan.md), [S-090](plans/S-090.plan.md), [S-102](plans/S-102.plan.md), [S-109](plans/S-109.plan.md), [S-111](plans/S-111.plan.md), [S-113](plans/S-113.plan.md), [S-116](plans/S-116.plan.md), [S-130](plans/S-130.plan.md), [S-131](plans/S-131.plan.md), [S-132](plans/S-132.plan.md), [S-133](plans/S-133.plan.md), [S-134](plans/S-134.plan.md), [S-135](plans/S-135.plan.md), [S-136](plans/S-136.plan.md), [S-137](plans/S-137.plan.md), [S-138](plans/S-138.plan.md), [S-122](plans/S-122.plan.md) | [prompt](prompts/S-139.prompt.md) |
| 122 | [S-140 — Ouvrir CoverView au public sur le cloud dédié et vérifier le rollback](plans/S-140.plan.md) | M9 | release | specified | [S-000c](plans/S-000c.plan.md), [S-139](plans/S-139.plan.md) | [prompt](prompts/S-140.prompt.md) |

## Parcourir par jalon

### M0 — Socle

- [S-000a](plans/S-000a.plan.md) — Démarrer un socle local reproductible et une preview fictive · 6 critères · foundation.
- [S-000b](plans/S-000b.plan.md) — Se connecter avec WorkOS et retrouver son espace protégé · 5 critères · integration.
- [S-000c](plans/S-000c.plan.md) — Ouvrir le premier parcours sur une infrastructure Infomaniak dédiée · 5 critères · integration.

### M1 — Acquisition

- [S-013a](plans/S-013a.plan.md) — Préparer son profil privé et le reprendre dans Wallet · 5 critères · integration.
- [S-010](plans/S-010.plan.md) — Ouvrir les trois parcours CoverView depuis un site public compact · 5 critères · local-fixtures.
- [S-011](plans/S-011.plan.md) — Publier les pages de méthode, preuves et contenus de référence · 6 critères · local-fixtures.
- [S-012](plans/S-012.plan.md) — Répondre aux FAQ et conserver la provenance déclarée des prospects · 5 critères · local-fixtures.
- [S-013](plans/S-013.plan.md) — Reprendre un parcours anonyme dans Wallet avec un profil central · 6 critères · integration.

### M2 — Documents et LPP

- [S-017](plans/S-017.plan.md) — Générer et archiver les documents de démarches à partir du profil · 5 critères · local-fixtures.
- [S-018](plans/S-018.plan.md) — Signer un document de test et suivre son dossier de preuve · 5 critères · local-fixtures.
- [S-014](plans/S-014.plan.md) — Créer et documenter un produit de catalogue canonique dans Admin · 5 critères · local-fixtures.
- [S-015](plans/S-015.plan.md) — Valider et publier le catalogue sans modifier les analyses passées · 5 critères · local-fixtures.
- [S-016](plans/S-016.plan.md) — Versionner et modifier les hypothèses de calcul depuis Admin · 5 critères · local-fixtures.
- [S-019](plans/S-019.plan.md) — Centraliser les contrats et leurs documents dans Wallet · 5 critères · local-fixtures.
- [S-021](plans/S-021.plan.md) — Initier et signer une recherche d’avoirs LPP perdus · 5 critères · local-fixtures.
- [S-022](plans/S-022.plan.md) — Suivre la recherche LPP jusqu’aux avoirs identifiés et prochaines démarches · 5 critères · local-fixtures.
- [S-020](plans/S-020.plan.md) — Demander et suivre la récupération de contrats par compagnie · 5 critères · local-fixtures.
- [S-023](plans/S-023.plan.md) — Transformer une pièce en données contractuelles avec revue des conflits · 6 critères · local-fixtures.

### M3 — Analyse

- [S-025](plans/S-025.plan.md) — Analyser un 3P sans compte depuis un document ou une saisie minimale · 5 critères · local-fixtures.
- [S-026](plans/S-026.plan.md) — Expliquer le score 3P, son allocation et son benchmark · 5 critères · local-fixtures.
- [S-024](plans/S-024.plan.md) — Déclencher un audit de contrat complet et rendre les exceptions traitables · 5 critères · local-fixtures.
- [S-028](plans/S-028.plan.md) — Calculer son besoin retraite en CHF actuels et futurs · 6 critères · local-fixtures.
- [S-029](plans/S-029.plan.md) — Explorer des probabilités et un âge cible reproductibles · 6 critères · local-fixtures.
- [S-030](plans/S-030.plan.md) — Comparer des stratégies compatibles avec son objectif · 5 critères · local-fixtures.
- [S-027](plans/S-027.plan.md) — Découvrir puis rejouer son Reveal et son Retirement World explicables · 5 critères · local-fixtures.
- [S-031](plans/S-031.plan.md) — Sauvegarder un Full Audit et demander une validation experte · 5 critères · local-fixtures.
- [S-032](plans/S-032.plan.md) — Partager un Wrapped révocable et comparer des métriques consenties · 5 critères · local-fixtures.
- [S-033](plans/S-033.plan.md) — Suivre une stratégie par Health Check, Wrapped annuel et timeline · 5 critères · local-fixtures.
- [S-034](plans/S-034.plan.md) — Explorer un royaume retraite persistant en mode bonus · 5 critères · local-fixtures.

### M4 — Retire

- [S-050](plans/S-050.plan.md) — Retire Check : première valeur puis sauvegarde du foyer dans Wallet · 6 critères · local-fixtures.
- [S-051](plans/S-051.plan.md) — Retirement Plan : achat simulé et accès durable au même dossier · 6 critères · local-fixtures.
- [S-052](plans/S-052.plan.md) — Options LPP autorisées et demande des règles manquantes · 6 critères · local-fixtures.
- [S-054](plans/S-054.plan.md) — Life Engine : budgets de phase, couple, dépendance et transmission · 6 critères · local-fixtures.
- [S-056](plans/S-056.plan.md) — Profil Monte-Carlo Retire dans le moteur commun · 7 critères · local-fixtures.
- [S-053](plans/S-053.plan.md) — Aujourd'hui : Retirement Range et indicateurs explicables · 6 critères · local-fixtures.
- [S-055](plans/S-055.plan.md) — Explorer et Timeline : variantes de vie comparables sans écraser le plan · 6 critères · local-fixtures.
- [S-057](plans/S-057.plan.md) — Stress tests Retire : comprendre les crises sans fausser les probabilités · 6 critères · local-fixtures.
- [S-058](plans/S-058.plan.md) — Growth : politique de référence et expositions look-through · 6 critères · local-fixtures.
- [S-059](plans/S-059.plan.md) — Income et Safety : missions de revenu et réserve dynamique · 6 critères · local-fixtures.
- [S-060](plans/S-060.plan.md) — Lombard Bridge : stress de secours et risque de marge · 6 critères · local-fixtures.
- [S-061](plans/S-061.plan.md) — Growth Cascade : flux de crise, récupération, bonus et non-intervention · 6 critères · local-fixtures.
- [S-062](plans/S-062.plan.md) — Optimiser revenu et mix rente/capital sous contraintes · 7 critères · local-fixtures.
- [S-064](plans/S-064.plan.md) — Care : abonnement ou inclusion explicite et droits cohérents · 6 critères · local-fixtures.
- [S-067](plans/S-067.plan.md) — Admin : gouverner les paramètres Retire et leurs versions publiées · 6 critères · local-fixtures.
- [S-063](plans/S-063.plan.md) — Strategy : crédit Plan unique, dossier expert et décision conservée · 6 critères · local-fixtures.
- [S-065](plans/S-065.plan.md) — Care : événement de vie, recalcul, alerte et prochaine action · 6 critères · local-fixtures.
- [S-066](plans/S-066.plan.md) — Annual/Event Review : service ponctuel et nouveau plan comparable · 6 critères · local-fixtures.
- [S-071](plans/S-071.plan.md) — Distribuer Retire aux partenaires, employeurs et clients B2B · 6 critères · local-fixtures.

### M5 — Opérations

- [S-081](plans/S-081.plan.md) — Délivrer un dossier avec tâches, prochaine action et Kanban · 6 critères · local-fixtures.
- [S-080](plans/S-080.plan.md) — Qualifier un entrant et suivre plusieurs opportunités distinctes · 6 critères · local-fixtures.
- [S-082](plans/S-082.plan.md) — Lire la vue client 360 et une timeline commune · 6 critères · local-fixtures.
- [S-083](plans/S-083.plan.md) — Traiter une boîte de réception orientée dossiers avec emails fictifs · 6 critères · local-fixtures.
- [S-084](plans/S-084.plan.md) — Planifier un rendez-vous et assurer sa suite dans Admin · 6 critères · local-fixtures.
- [S-086](plans/S-086.plan.md) — Expliquer le pipeline pondéré et ses écarts aux objectifs · 6 critères · local-fixtures.
- [S-087](plans/S-087.plan.md) — Suivre revenus acquis, commissions dues et encaissements distincts · 6 critères · local-fixtures.
- [S-085](plans/S-085.plan.md) — Enchaîner les événements métier sans perdre la prochaine action · 7 critères · local-fixtures.
- [S-088](plans/S-088.plan.md) — Piloter la charge, les exceptions et le revenu depuis le cockpit · 6 critères · local-fixtures.
- [S-094](plans/S-094.plan.md) — Interroger Admin depuis un chat global ou lié à un objet · 7 critères · local-fixtures.
- [S-095](plans/S-095.plan.md) — Exécuter une action IA typée avec aperçu et confirmation exacte · 7 critères · local-fixtures.
- [S-096](plans/S-096.plan.md) — Matérialiser les pièces du chat en données et tâches sourcées · 7 critères · local-fixtures.
- [S-097](plans/S-097.plan.md) — Dicter, commander et capturer une pièce depuis Admin mobile · 7 critères · local-fixtures.

### M6 — Assistance et fidélité

- [S-091](plans/S-091.plan.md) — Poser une question de couverture et retrouver les contrats applicables · 6 critères · local-fixtures.
- [S-092](plans/S-092.plan.md) — Lire une réponse de couverture prudente, citée et contrôlée · 7 critères · local-fixtures.
- [S-093](plans/S-093.plan.md) — Transformer la conversation en assistance suivie dans Wallet · 7 critères · local-fixtures.
- [S-101](plans/S-101.plan.md) — Créer et révoquer une carte de membre à jeton opaque · 6 critères · local-fixtures.
- [S-103](plans/S-103.plan.md) — Consulter un compte Miles adossé à un ledger immuable · 7 critères · local-fixtures.
- [S-104](plans/S-104.plan.md) — Gagner des Miles par règles et campagnes versionnées · 7 critères · local-fixtures.
- [S-105](plans/S-105.plan.md) — Réserver une récompense dans le shop avec débit atomique · 6 critères · local-fixtures.
- [S-106](plans/S-106.plan.md) — Valider et consommer un avantage chez le partenaire autorisé · 6 critères · local-fixtures.
- [S-107](plans/S-107.plan.md) — Annuler, rembourser et rapprocher une redemption · 6 critères · local-fixtures.
- [S-108](plans/S-108.plan.md) — Contrôler fraude et responsabilité financière de la fidélité · 6 critères · local-fixtures.

### M7 — Professionnels et Exchange

- [S-110](plans/S-110.plan.md) — Apporter un lead et suivre sa progression autorisée dans Partners · 6 critères · local-fixtures.
- [S-111](plans/S-111.plan.md) — Proposer une offre partenaire et suivre ses transactions propres · 6 critères · local-fixtures.
- [S-114](plans/S-114.plan.md) — Définir un risque paramétrique isolé et simuler des engagements · 6 critères · local-fixtures.
- [S-115](plans/S-115.plan.md) — Observer un paramètre et régler un risque Exchange en démonstration · 6 critères · local-fixtures.
- [S-112](plans/S-112.plan.md) — Analyser le catalogue et publier une proposition professionnelle sourcée · 6 critères · local-fixtures.
- [S-113](plans/S-113.plan.md) — Comparer des stratégies Retire dans Intelligence avec sources communes · 6 critères · local-fixtures.
- [S-117](plans/S-117.plan.md) — Retrouver tous ses résultats, démarches et avantages dans Wallet · 7 critères · local-fixtures.

### M8 — Intégrations réelles

- [S-042a](plans/S-042a.plan.md) — Conserver ses documents originaux et confirmer les informations extraites dans son profil · 7 critères · integration.
- [S-035](plans/S-035.plan.md) — Activer la signature réelle des documents et ses preuves · 5 critères · integration.
- [S-037](plans/S-037.plan.md) — Classer et extraire réellement des documents avec un adapter approuvé · 5 critères · integration.
- [S-039](plans/S-039.plan.md) — Répondre réellement aux FAQ à partir du corpus public cité · 5 critères · integration.
- [S-040](plans/S-040.plan.md) — Alimenter le catalogue et les marchés par des sources réelles validées · 5 critères · integration.
- [S-042](plans/S-042.plan.md) — Scanner une pièce d’identité pour enrichir le profil confirmé · 5 critères · integration.
- [S-043](plans/S-043.plan.md) — Valider l'accumulation et ses probabilités sur un corpus indépendant · 5 critères · integration.
- [S-044](plans/S-044.plan.md) — Valider Score, Investment Age, Freshness et cohortes comparables · 5 critères · integration.
- [S-045](plans/S-045.plan.md) — Valider compatibilité stratégique et traduction Retirement World · 5 critères · integration.
- [S-038](plans/S-038.plan.md) — Composer et activer les méthodes accumulation, score et compatibilité validées · 5 critères · integration.
- [S-069](plans/S-069.plan.md) — Stripe réel : Plan, crédit Strategy, Care et Review en environnement test · 6 critères · integration.
- [S-089](plans/S-089.plan.md) — Connecter Gmail professionnel et traiter un vrai thread de test · 6 critères · integration.
- [S-036](plans/S-036.plan.md) — Transmettre réellement les demandes LPP et de récupération de contrats · 5 critères · integration.
- [S-041](plans/S-041.plan.md) — Rapprocher les réponses réelles des organismes et clôturer les demandes · 5 critères · integration.
- [S-074](plans/S-074.plan.md) — Qualifier les sources Retire : caisse, vie, EMS et conditions Lombard · 5 critères · integration.
- [S-075](plans/S-075.plan.md) — Valider les flux Cascade et l'optimisation sur cas indépendants · 6 critères · integration.
- [S-076](plans/S-076.plan.md) — Valider sampling, indicateurs, Retirement Range et stress Retire · 6 critères · integration.
- [S-068](plans/S-068.plan.md) — Composer et activer les sources et méthodes Retire validées · 7 critères · integration.
- [S-070](plans/S-070.plan.md) — Valider le périmètre Retire réellement commercialisable · 7 critères · release.
- [S-090](plans/S-090.plan.md) — Synchroniser Google Calendar et le rendez-vous de suivi réel · 6 critères · integration.
- [S-098](plans/S-098.plan.md) — Brancher le LLM réel pour copilote et couverture avec évaluations · 7 critères · integration.
- [S-072](plans/S-072.plan.md) — Copilote Retire : expliquer un run et préparer une action autorisée · 6 critères · integration.
- [S-099](plans/S-099.plan.md) — Transcrire réellement la voix Admin et la question de couverture · 6 critères · integration.
- [S-100](plans/S-100.plan.md) — Résoudre un dossier support par copilote de bout en bout · 7 critères · integration.
- [S-102](plans/S-102.plan.md) — Installer et mettre à jour les pass Apple et Google réels · 6 critères · integration.
- [S-109](plans/S-109.plan.md) — Activer les rewards et gains approuvés avec exécution réelle · 6 critères · integration.
- [S-119](plans/S-119.plan.md) — Rapprocher et payer un partenaire via le prestataire validé · 6 critères · integration.
- [S-120](plans/S-120.plan.md) — Admettre un participant Exchange et garantir son engagement réel · 6 critères · integration.
- [S-116](plans/S-116.plan.md) — Activer les métriques et le règlement Exchange réellement qualifiés · 6 critères · release.
- [S-121](plans/S-121.plan.md) — Étendre le copilote aux actions métier CRM, catalogue et fidélité · 7 critères · integration.
- [S-118](plans/S-118.plan.md) — Traiter les exceptions finales et observer les parcours croisés · 7 critères · integration.
- [S-122](plans/S-122.plan.md) — Interroger ses objets Partners et Intelligence et suivre une tâche d’analyse · 7 critères · integration.
- [S-073](plans/S-073.plan.md) — Activer Retire et vérifier les parcours payants, Care et distribution · 8 critères · release.

### M9 — Préparation au lancement

- [S-130](plans/S-130.plan.md) — Exporter et rectifier ses données avec une preuve de traitement · 3 critères · local-fixtures.
- [S-132](plans/S-132.plan.md) — Reprendre un dossier après panne sans doubler les effets · 4 critères · local-fixtures.
- [S-131](plans/S-131.plan.md) — Appliquer la conservation et une demande de suppression contrôlée · 3 critères · local-fixtures.
- [S-133](plans/S-133.plan.md) — Lire les parcours d’acquisition et de traitement avec leurs dénominateurs · 3 critères · local-fixtures.
- [S-134](plans/S-134.plan.md) — Mesurer opérations, copilotes et fidélité sans confusion de valeur · 3 critères · local-fixtures.
- [S-135](plans/S-135.plan.md) — Éprouver les assistants contre les fuites et actions indues · 3 critères · local-fixtures.
- [S-136](plans/S-136.plan.md) — Autoriser les résultats calculés après validation indépendante · 3 critères · local-fixtures.
- [S-137](plans/S-137.plan.md) — Publier les conditions et consentements validés par parcours · 3 critères · local-fixtures.
- [S-138](plans/S-138.plan.md) — Vérifier accès, mobile et parcours sur toutes les surfaces · 4 critères · local-fixtures.
- [S-139](plans/S-139.plan.md) — Accepter la v1 complète par les workflows et les invariants de la bible · 8 critères · release.
- [S-140](plans/S-140.plan.md) — Ouvrir CoverView au public sur le cloud dédié et vérifier le rollback · 4 critères · release.
