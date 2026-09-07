# Plafond de recette documentaire — 2026-09-07

Signalement utilisateur : dernier PDF bloqué par la limite sur 24 heures, taille suspectée.

**Diagnostic vérifié** : requêtes PostgreSQL en transaction READ ONLY, limitées au document signalé et aux compteurs de son propriétaire, sans afficher contenu, nom ni données extraites. Original de 332 561 octets, PDF, scan réussi, aucun appel réservé pour ce document. Son propriétaire a trois réservations sur 24 heures : une complétée, deux sans usage enregistré. Première réservation expirant le 2026-09-08 à 12:35:12 UTC. Le refus `ai_daily_limit` précède l’appel fournisseur, sans lien avec le nombre de pages ou les crédits rechargés.

**Correction locale** : plafond de recette par défaut relevé de 3 à 20, au sein de la borne existante. Hors local/development et en NODE_ENV=production, défaut inchangé à 3 ; configuration explicite toujours prioritaire. Aucun effacement des tentatives incertaines, aucune modification de quota fournisseur, aucun changement d’autorisation ou de session. Aucun renvoi automatique du document pour consommer le nouveau budget : reprise par l’action existante dans Wallet.

**Vérifié** : build et typage API, lint ciblé ; cinq contrôles de configuration isolés (local et development à 20, production et local/NODE_ENV production à 3, valeur explicite à 5 prioritaire). Aucun appel fournisseur ni mutation SQL dans ces contrôles. La lecture de ce PDF reste à reprendre ; le diagnostic ne prouve ni son nombre de pages ni une extraction réussie.
