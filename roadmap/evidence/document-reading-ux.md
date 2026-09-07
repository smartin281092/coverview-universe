# Lecture documentaire : priorité aux informations — 2026-09-07

L’utilisateur confirme une analyse réelle réussie après ajout de crédits. Nouvelle demande : barre de progression, aucun nom de fournisseur IA dans l’interface, informations extraites immédiatement sous le titre ; explication des actions de classement et de vérification.

**Implémenté** : informations remontées avant l’état technique, les métadonnées du fichier et les actions. Barre d’activité GSAP pendant préparation/transfert puis queued/scanning/reading, sans pourcentage inventé : aucun avancement en octets/pages n’est fourni par l’API actuelle. Le libellé suit l’étape réelle. Le mouvement respecte la réduction des animations et est détruit au démontage. Fournisseur et détails techniques retirés des textes Wallet ; consentement au traitement externe, caractère automatique et confirmation personnelle restent explicites.

**Actions conservées** : « Corriger le type » modifie uniquement la catégorie documentaire. « Vérifier » ouvre source/proposition/valeur courante, puis permet conserver, utiliser ou corriger ; aucune écriture au simple clic. La confirmation finale applique un champ au profil si compatible, sinon conserve sa valeur sur le document. Aucun changement métier, API, migration, dépendance ou nouvelle extraction.

**Vérifié V0/V1** : lint ciblé, typage et build Wallet passent. Recherche des fournisseurs dans les sources des interfaces : aucune occurrence OpenAI restante. Pas de test de surface ajouté. Vérification navigateur après intégration à consigner ; la barre en activité nécessite un nouveau traitement réel et n’est pas validée par le seul build.
