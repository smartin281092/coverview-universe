# Club — cartes d’avantages

Demande du 2 octobre 2026, changement de présentation WWW, exécuté sous le mandat autonome existant. Session Codex GPT-6 ; effort non exposé. Pas de nouveau parcours métier ni de nouvelle règle tarifaire.

- **Vérifié** : les avantages du filtre Club existant sont présentés en grille de deux colonnes ; chaque carte contient une icône contextuelle, un titre gras et le texte de l’avantage provenant du catalogue. Zone visuelle de 150 px sur bureau et 110 px au viewport mobile contrôlé. Tons gris, titres sans troncature, compteurs conservés.
- **Vérifié** : conditions, réserves de validité, exclusions et sources accessibles en cliquant sur la carte, dans un dialogue distinct (FRONT-14). Échap ferme uniquement ce dialogue et restitue le focus à la carte ; la propagation de l’événement cancel aux dialogues parents est arrêtée.
- **Vérifié** : recette réelle PharMed/Assura, cinq cartes pour une pastille Club de cinq, bureau 1280×720 et mobile 390×844. Colonnes mobiles 142/142 px, panneau 340 px et scrollWidth 340 px : aucun débordement horizontal. Ouverture du détail fitness, réserve 2027 et source visibles, fermeture Échap et retour à la grille confirmés. Aucune erreur console observée. Vue temporaire réinitialisée et onglet fermé.
- **Vérifié** : typecheck WWW (83 fichiers, zéro diagnostic), ESLint ciblé, formatage et diff ciblés ; build WWW (45 pages). L’avertissement Vite préexistant sur les chunks > 500 Ko reste présent.

Aucune dépendance, image distante, migration, variable d’environnement, permission, donnée persistée, événement, room ou job ajouté. Icônes vectorielles dans le composant existant ; aucun appel à une IA pour choisir ou réécrire les avantages. Données et limites contractuelles du catalogue inchangées. Pas de test unitaire de rendu ajouté pour cette évolution visuelle ; recette navigateur effectuée. Tactile matériel non testé. Aucun push ni déploiement. Les travaux préexistants hors de cette demande sont laissés intacts.
