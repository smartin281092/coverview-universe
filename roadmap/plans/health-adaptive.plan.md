# Recommandation maladie adaptative et contrôle des conditions

Mandat utilisateur détaillé du 1er octobre 2026, autorisation autonome PROG-23. Extension du comparateur existant ; aucun déploiement ni message envoyé aux assureurs.

## Audit et décisions

Conserver Astro/React, Fastify/Zod/PostgreSQL, les 219 916 primes officielles, les 153 modèles / 32 assureurs, la carte et le classement par prix. Priminfo confirme la publication 2027 le 1er octobre. L'ancien guide choisit seulement le premier modèle par franchise et ignore les effets de prestations : il reste une API compatible, mais le nouveau parcours emploie un moteur séparé. Les 88 faits existants ne suffisent pas à un classement personnalisé complet. L'inventaire est extrait du snapshot, jamais d'une liste de partenaires.

Les conditions dont la validité 2027 n'est pas prouvée restent conditionnelles et ouvrent un dossier nominatif. Aucun diagnostic, aucune probabilité inventée, aucune valorisation monétaire de points. Profil de recommandation éphémère dans la page et les requêtes POST ; notes jamais transmises. L'année provient du profil et doit correspondre au snapshot et aux preuves. Les montants ordinaires ne représentent pas un plafond universel.

## Livraison cohérente

- [x] Contrats versionnés séparant réponse, affichage, preuves, compatibilité et stabilité ; schéma additif de catalogue/règles/contrôles/historique.
- [x] Moteur serveur : candidats complets, compatibilité, coûts par scénario, utilité dédupliquée, classement explicite par objectif, questions par sensibilité et dépendances, conditions d'arrêt.
- [x] Recherche officielle de chaque assureur et modèle, inventaire de couverture, preuves, années, contradictions et file de contrôle. Deux audits documentaires indépendants CDX-05, fichiers de recherche distincts ; code sous un seul propriétaire.
- [x] WWW : boucle atomique après réponse, multisélection confirmée, modifications et réponses conservées/inactives, notes privées, résultats expliqués, CTA du volet et repli prix.
- [x] Page Admin protégée : règles/version/retour arrière, simulation, catalogue/preuves, couverture et dossiers nominatifs avec responsable/historique, exports.
- [x] Tests des 20 cas d'acceptation et protections Admin/CSRF/idempotence ; types, lint, builds, migrations, recette navigateur.
- [x] Rapport opérateur, exports JSON/CSV, documentation et ledger des limites/examens restants.

## Risques et oracles

Les réseaux et programmes privés peuvent rester inaccessibles : afficher la réserve et une question opérateur précise, pas interroger le visiteur sur une ambiguïté contractuelle. Sources non exhaustives et absence de service ne sont jamais confondues. Les publications des conditions 2027 progressent : revue par année et version explicite. Configuration métier testable et administrable mais aucune modification des lois à partir de poids de confort. Contraintes impératives non compensables ; résultats non évaluables séparés.

Oracles : règles OFSP primaires, sources documentaires inspectées, tests de coûts aux seuils et invariants de classement, PostgreSQL isolé pour Admin et versions, navigateur via CUA. L'authentification WorkOS réelle ou contrôle juridique humain non exécuté reste déclaré. Activation progressive off/opt-in/on ; tri par prix disponible en permanence.

## Journal

1er octobre : inventaire normalisé de référence créé ; audits documentaires et règles officielles lancés. Aucun changement des primes ni des comptes utilisateurs.

1er octobre, clôture de l’implémentation locale : moteur/API/WWW/Admin, import de catalogue complet en périmètre, 323 dossiers de conditions restant à vérifier. Oracles et limites détaillés dans `roadmap/evidence/health-adaptive.md` ; les cases cochées ne signifient pas que tous les contrats ont reçu leur validation humaine. Migrations 0024/0025 appliquées, 45 tests et 26 assertions réelles, builds/types/lint ciblés vérifiés. Knip global conserve quatre anciens composants inutilisés hors périmètre ; aucune règle neutralisée. Suite documentaire préparée dans `health-adaptive-operator-review.plan.md`.
