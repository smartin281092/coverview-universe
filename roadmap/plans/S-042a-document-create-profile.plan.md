# Création explicite de profil depuis un document — 11 septembre 2026

Mandat utilisateur : expliquer la lecture interrompue du document ouvert et ajouter « Créer un nouveau profil » à la résolution de son attribution. Exécution autorisée dans la demande, sans nouvelle confirmation.

- Diagnostic : le journal de l’API indique `ai_invalid_result`, diagnostic `source_quote`. La réponse OpenAI a échoué au contrôle de correspondance citation/transcription ; aucun résultat rejeté ne doit alimenter un profil. Ne pas déduire la cause textuelle exacte d’une réponse non conservée.
- Étendre la commande d’attribution existante de façon compatible : choix d’un profil existant ou création explicite depuis l’extraction validée conservée côté serveur. Création, enrichissement avec provenance et attribution atomiques sous verrou propriétaire, révision et idempotence (G-02/03/09/10, CTR-02).
- Proposer un dossier personne avec prénom valide ou société avec raison sociale valide ; refuser une identité mixte ou absente. Conserver les limites et l’absence de droits/compte WorkOS implicites. L’utilisateur peut résoudre une homonymie en créant explicitement un autre dossier.
- Wallet : bouton demandé, nom proposé visible, états en cours/erreur et explication si la lecture ne fournit pas de données utilisables. Aucun profil vide créé à partir d’une lecture rejetée.
- Vérifier sur PostgreSQL isolé : création/remplissage/attribution, provenance, concurrence/rejeu, propriétaire étranger, révision, absence d’extraction et plafond. Types, lint, builds API/Wallet et contrôle visuel réel sans créer de profil client de test.

Périmètre : contracts, profils, documents, api-client dérivé, Wallet. Pas de migration, dépendance, nouveau fournisseur, appel IA de recette ou modification d’un original. Satellites consultés : environnement, sécurité, LLM, contrats, backend, frontend, tests ; README document-intelligence et profiles.

## Vérification

- Vérifié : 24 tests ciblés passent (détection/attribution sur PostgreSQL réel isolé, ciblage documentaire, extraction assurantielle et adapter LLM). Trois nouveaux tests couvrent création personne/société, données et sources, isolation, révision, double soumission/rejeu, refus d’identité absente/mixte, lecture échouée et plafond. Les extractions de ces tests sont synthétiques ; aucun appel OpenAI réel.
- Vérifié : Wallet authentifié affiche le nouveau bouton désactivé et l’explication sur le document réel en échec. Capture visuelle inspectée. La lecture existante reste en échec ; aucun profil client créé ou original modifié pendant la recette.
- Limite du diagnostic : la réponse fournisseur rejetée n’est pas conservée, donc l’écart textuel exact ne peut pas être reproduit depuis les journaux. Le contrôle de citation reste strict ; aucune donnée rejetée n’est acceptée pour contourner cet échec.
- Vérifié : types API/Wallet, ESLint ciblé, builds API/Wallet, dependency-cruiser et knip passent. Le build Wallet conserve l’avertissement préexistant sur les chunks dépassant 500 Ko. Aucune migration ni dépendance ajoutée.
