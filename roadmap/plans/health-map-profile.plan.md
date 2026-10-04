# Carte plein écran, frontaliers et profil — 1er octobre 2026

Mandat utilisateur explicite : exécuter ces évolutions avec autonomie, sans nouveau GO. Protéger les données et les travaux déjà présents.

- [x] Inventorier/importer les primes officielles UE/AELE/UK 2027 avec provenance, pays de résidence et grain distinct du catalogue suisse. Afficher les pays voisins sur la carte et les résultats ; ne pas réutiliser les avantages suisses non documentés pour les frontaliers.
- [x] Carte en fond sur tout l’écran, îlots superposés et utilisables sur mobile ; retirer l’icône Profil, aligner les textes du questionnaire et supprimer le motif technique au-dessus des questions.
- [x] Remplacer le choix de périmètre du questionnaire par l’utilisation de la franchise du profil ; garder l’optimisation en option explicite avancée.
- [x] Sexe facultatif en début de profil, branches pertinentes côté serveur, sans effet sur les primes ni assimilation à une condition médicale. Réutiliser les informations tarifaires déjà fournies, sans confirmation redondante. Mettre « Je n’ai pas de préférence, tout me convient » en premier.
- [x] Géolocalisation déclenchée volontairement, permission navigateur, précision et refus gérés ; pas de persistance ni de coordonnées dans l’URL ou les logs. Une position actuelle ne prouve pas le domicile.
- [x] Tests ciblés tarif frontalier, âge/accident, branches et informations déjà connues ; types/lint/build concernés puis recette navigateur bureau et mobile.

Source d’autorité : contrats API Zod et services serveur existants ; composants du design system. Identifiants assureurs/modèles conservés, noms commerciaux utilisés. Risques : ne pas confondre ZE/ZR avec pays de résidence, ne pas simuler des coûts médicaux transfrontaliers avec les règles suisses ordinaires. L’affiliation et le droit d’option restent à vérifier, aucune souscription automatique. Oracle : source OFSP 2027 confrontée aux prix importés, API réelle et parcours navigateur avec données fictives. Pas de nouvelle dépendance applicative ni de communication à un assureur.

