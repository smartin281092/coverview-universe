# Fiche modèle : configuration et écarts animés

Mandat du 3 octobre 2026, exécution autonome. Simplifier Données (retirer modèle/type, total annuel, notices et lien demandés), éditer région/pays, franchise et accident avec HealthSelect commun à Wallet. Année 2027 conservée pendant clarification facultative du périmètre historique ; ne jamais rapprocher des modèles de millésimes différents par leur nom.

Le serveur existant reste l’autorité tarifaire : relire les offres du même identifiant de modèle, avec filtres d’assureur et pagination bornée. Aucune substitution par l’offre la moins chère lorsque le modèle est indisponible. Masquer le prix/CTA pendant un changement non résolu, ignorer les réponses obsolètes, reporter ensemble l’offre résolue et les paramètres dans le comparateur et le checkout. Référence 2026 inchangée.

Afficher un pictogramme décoratif de trois chevrons à gauche du montant annuel : baisse verte vers le bas, hausse rouge vers le haut, opacités alternées ; état égal sans flèche. Réutiliser le rendu en fiche, liste et popup carte, avec les écarts calculés côté serveur pour les offres de toutes les régions. Respecter prefers-reduced-motion. Retirer le badge moins cher uniquement des listes (simple et personnalisée).

Vérification : types/lint/build WWW, lookup paginé et absence de substitution, parcours réel franchise/accident/région, mise à jour prix et checkout, hausse/baisse et carte, clavier/mobile, absence de prix obsolète en cas d’indisponibilité. Pas de migration, nouvelle dépendance, données fictives tarifaires ou accès Figma supposé ; le composant existant fournit le dropdown.

Livraison locale et oracles : [ledger](../evidence/health-model-editing.md). Types, lint, 3 tests ciblés et build passés ; parcours bureau/mobile vérifié. Prix masqué/inert pendant le recalcul avec espace conservé, hauteur de popup mesurée. Année 2027 désactivée tant qu’aucune navigation historique explicite n’est définie. Limites de recette et état du workspace consignés dans le ledger.
