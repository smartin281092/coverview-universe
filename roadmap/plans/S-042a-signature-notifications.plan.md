# Signature directe et notifications Admin

Demande utilisateur : retirer la réponse libre des actions nécessitant une signature ; une signature reçue termine l’action immédiatement et informe l’Admin. Exécution autorisée dans le mandat courant, sans nouvelle demande de GO.

Implémentation ciblée : actions d’autorisation sans choix de résolution générique, refus serveur avant tout rejeu de cache, anciens signalements conservés en historique mais ne déterminant plus le statut. Procuration/mandat complets uniquement avec signature courante, LSA45 complète uniquement avec ouverture enregistrée. Les autres demandes au service client restent inchangées. Une liste Admin Notifications expose les réceptions de signatures persistées, paginées et datées, avec compte/profil et lien dossier ; projection des preuves existantes pour éviter événement perdu et doublon, sans email ni mutation de consentement. Le retrait ou transfert d’une signature reste explicite dans la liste.

Pas de nouvelle table, dépendance ni variable. Permissions administration.access + MFA et audit d’accès ; aucune signature exposée aux autres clients. Tests PostgreSQL : réponse arbitraire refusée, ancien cache refusé, ancienne demande n’envoie plus en cours, signature → complete, notification unique au rejeu, pagination ; tests HTTP droits/MFA. Types/lint/build API/Admin/Wallet, vérification visuelle sans signer de document réel. Modèle hôte GPT-6, effort effectif non observable.

Journal : inspection confirme que la projection authorization utilise actuellement custom et les manual_reviews ; la signature est déjà transactionnelle/idempotente dans authorization_signatures.

Terminé : réponses libres retirées et refusées avant rejeu, anciens messages historiques n’influencent plus le statut, notifications Admin projetées depuis les signatures. Tests PostgreSQL/HTTP, types/lint/build/frontières et recette visuelle sans signature réelle passent. Résultats et limites : [ledger](../evidence/signature-notifications.md).
