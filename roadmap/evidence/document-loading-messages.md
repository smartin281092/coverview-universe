# Messages pendant les traitements longs — 2026-09-07

Demande utilisateur : faire varier le texte après quelques secondes pour rassurer pendant une opération longue et éviter les actualisations inutiles.

Implémentation : cadence de huit secondes, trois messages par étape (préparation, transfert, file, antivirus, lecture). Le texte indique la mise à jour automatique sans inventer de pourcentage ou d’étape. Retour au premier message à chaque changement d’étape, arrêt du timer au démontage, à la fin ou à l’erreur. Annonce polie et atomique aux lecteurs d’écran, zone de texte réservée pour limiter les sauts de mise en page. Si le suivi réseau est suspendu ou si la dernière réponse serveur date de plus de vingt secondes au passage du timer, un message d’attente de connexion remplace les affirmations d’activité.

Aucune nouvelle lecture, mutation métier, dépendance ou changement des délais/retries serveur. **Vérifié V0/V1** : build et typage Wallet (7 tâches Turbo avec dépendances partagées), lint ciblé et formatage réussis. Aucun test de surface ni traitement facturable déclenché pour observer le texte ; la rotation pendant un prochain traitement réel reste à observer.
