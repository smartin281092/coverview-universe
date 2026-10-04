# Assurance actuelle 2026 et différence de primes

Mandat utilisateur du 2 octobre 2026, exécution autonome PROG-23. Interprétation annoncée : comparer la prime du contrat actuel 2026 aux offres 2027 affichées. La répétition orale « 2026 et 2026 » n’est pas utilisée pour modifier l’année du comparateur.

## Parcours

En bas du profil, bouton « Sélectionner mon modèle actuel ». Dialogue en deux étapes : cartes de compagnies avec leurs logos, puis cartes des modèles réellement tarifés en 2026. Franchise et accident du contrat actuel préremplis depuis le profil, modifiables et conservés séparément des paramètres 2027. Prix officiel 2026 et écarts mensuels/annuels dans les résultats et la fiche ; aucune estimation inventée ni déduction de subside. L’écart porte sur les primes brutes, pas le coût des soins.

## Réalisation

1. Audit indépendant des archives officielles 2026 (CDX-05), téléchargements, empreintes et couverture CH/UE. Conserver sources et millésimes exacts, signaler toute indisponibilité.
2. Paramétrer l’import annuel existant ; snapshots isolés, noms assureurs historiques préservés, import idempotent et atomique, aucune activation/désactivation de prestations 2027 lors de l’import 2026.
3. API publique dédiée, contrats Zod additifs et calcul des écarts côté serveur. Âge selon chaque année, couverture communale/région vérifiée, configuration 2026 indépendante. Absence de tarif explicitement retournée, aucun rapprochement de modèles par simple ressemblance.
4. WWW : sélecteur en deux étapes et affichage des écarts, annulation des réponses obsolètes, navigation clavier/mobile, absence de persistance personnelle.
5. Vérifier intégrité et idempotence de l’import, années/âge/franchises et sens des écarts, règles communales et tarifs manquants, contrat API, types/lint/build, parcours réel bureau/mobile.

## Frontières

Réutilisation de Fastify/PostgreSQL/Drizzle, des clients publics et des dialogues/logos WWW. Aucune nouvelle dépendance prévue. Les conditions médicales et programmes 2027 ne sont pas reportés en 2026. Aucun compte, demande d’offre, permission ou transmission tierce ajouté. Les travaux préexistants hors du périmètre restent intacts. Si une commune a changé sans correspondance historique vérifiée, demander la localisation 2026 ou afficher la réserve au lieu d’inventer une région.

## Vérification et état

Implémenté et vérifié localement. [Journal de vérification](../evidence/health-current-2026.md) : imports CH/UE répétés, 2027 préservé, 13 tests passés, 466 tarifs rapprochés des CSV bruts, types/lint/builds et parcours réel bureau/mobile. Taxonomie 2026 native conservée, K1 confirmé contre les PDF malgré les libellés ALT erronés, logo AMB historique non retrouvé. Aucun déploiement ni commit global des travaux préexistants.
