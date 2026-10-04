# CoverView Partner

## Résumé

Espace opérationnel des professionnels CoverView : Dashboard → Leads → fiche à onglets, avec Clients comme vue transverse. Le [module API](../api/src/modules/partner-workspace/README.md) possède les règles métier.

## Périmètre

Candidature, supervision des candidatures pour l'Admin habilité, tableau de bord, pipeline Kanban/liste avec filtres URL, création/édition, fiche, tâches, agenda, notes et offres versionnées. L'import utilise le stockage privé existant et propose les données extraites à vérifier. Les versions prêtes sont publiables dans Wallet. Les rubriques non réalisées du brief ne sont pas des écrans de démonstration.

## Règles métier et invariants

Une carte représente une demande, pas une personne. Les mutations transmettent révision et clé idempotente. Un déplacement ouvre le formulaire correspondant et attend le contrôle serveur. Aucun déplacement libre vers « signé ». Dates saisies en Europe/Zurich, montants CHF en centimes via le contrat commun. Les libellés français sont externalisés.

## Permissions

Connexion WorkOS sur la surface `partners`. Aucun accès opérationnel avant approbation ; chaque page est filtrée par le serveur. L'administrateur rejoint le contrôle MFA existant, sans élévation locale. Les données privées sont séparées par utilisateur/session dans Query et relues après chaque mutation. Aucun localStorage de dossier.

## État réel

Build, TypeScript et lint ciblés vérifiés. Candidature mobile et retour WorkOS réels observés. La recette opérationnelle nécessite une session habilitée existante ; aucune permission de test n'a été accordée au compte réel. [Ledger](../../roadmap/evidence/partner-core.md).

## Développement

`pnpm --filter partners dev` : Vite, `127.0.0.1:4104`, port strict. `VITE_API_URL`, `VITE_WALLET_URL`, `VITE_ADMIN_URL` configurent les destinations publiques. Origine API et paramètres AuthKit : [`.env.example`](../../.env.example). Dépendances de la stack déjà utilisée par Wallet/Admin, mêmes versions résolues ; aucune nouvelle bibliothèque tierce introduite.
