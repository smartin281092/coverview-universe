# Packaging et présentation des modèles

Mandat utilisateur du 1 octobre 2026, autorisation d'exécution autonome (PROG-23). Référence : image MediTel fournie par l'utilisateur ; elle guide la composition visuelle, pas les règles métier.

## Périmètre

- WWW : compteurs Prestations/Club issus du même catalogue que les lignes affichées ; suppression du libellé répétitif « À contrôler pour cette année », sans transformer une donnée incertaine en prestation vérifiée.
- Fiche : logo puis modèle, packaging au-dessus du prix, badge tarifaire à droite du montant. Miniature du même actif dans le checkout et le panier.
- Actifs : photographie de packaging inspirée de la référence, palettes issues des logos officiels existants, noms exacts des modèles. Inventaire 153 modèles suisses et 14 identifiants frontaliers. Génération intégrée imagegen, sans nouvelle API payante, clé ou dépendance.

## Réalisation et vérification

1. Auditer l'inventaire et les palettes (lecture indépendante bornée déléguée selon CDX-05).
2. Générer les images et conserver prompts, identifiants et provenance dans le workspace ; contrôler composition, texte et couverture effective.
3. Partager le chargement du catalogue entre pastilles et prestations, intégrer les actifs sur les consommateurs.
4. Types/lint/build, vérification des actifs et recette bureau/mobile du détail et du checkout. Aucun envoi réel d'offre pendant la recette.

Pas de changement du classement, des prix, des permissions ni des données contractuelles. Les illustrations ne portent pas de promesses médicales inventées. Les autres changements du dépôt restent hors commit.
