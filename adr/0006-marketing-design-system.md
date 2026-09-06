# ADR-0006 — Refonte blanche et système de composants commun

Statut : accepté par instruction explicite utilisateur, 6 septembre 2026.

> **Mise à jour historique** : la direction visuelle ci-dessous est remplacée par [ADR-0007](0007-xai-design-reference.md) et la [référence xAI fournie](../references/xai-style-reference.md). La décision de partager les composants de présentation statique entre Astro et les apps reste applicable.

## Décision

Remplacer la direction visuelle initiale par un fond blanc, des neutres sobres, une typographie ample et des sections ouvertes inspirées visuellement d’Apple. La narration et la structure des pages marketing prennent IM8 comme référence de composition, sans reprendre sa marque, ses textes ni ses preuves commerciales. Les cards sont réservées aux bentos : informations courtes associées à une illustration ou un chiffre justifié.

`packages/ui` porte le système commun. Les composants React de présentation peuvent être rendus statiquement par Astro, sans hydratation ni JavaScript client superflu ; les interactions applicatives restent dans leurs apps. Cette décision remplace le défaut DSN-07 pour la composition statique partagée, sans transformer le site en SPA.

Cette demande remplace la palette imposée et les décisions visuelles correspondantes d’ADR-0004 et de BRD-01/03. Les assets sources restent conservés comme historique ; le logo existant reste utilisable. Les primitives accessibles shadcn existantes sont réutilisées, sans réinstaller un second framework ni réappliquer l’ancien thème. La nouvelle source de tokens et ses consommateurs sont documentés dans `packages/ui/README.md`.

## Conséquences

La charte initiale n’est plus un oracle du nouveau rendu. Les anciennes règles d’empreintes continuent de protéger les originaux, sans forcer leur palette dans les apps. Aucune prestation, preuve client ou fonctionnalité non livrée n’est inventée pour remplir la page. L’architecture, les permissions et les choix d’hébergement restent inchangés.
