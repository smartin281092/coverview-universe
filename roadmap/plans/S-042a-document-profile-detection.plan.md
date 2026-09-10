# S-042a — Profil détecté à la lecture documentaire

## Mandat et décision

Demande du 10 septembre 2026 : rapprocher le prénom extrait des profils du compte, comparer aussi la date de naissance lorsqu’elle existe, créer et compléter une personne si aucun profil ne correspond, puis rattacher le document. Réponse utilisateur : demander en cas d’homonymie ou de date contradictoire, sans enrichir ni créer en double. Exécution autorisée par le mandat courant ; aucune nouvelle slice.

## Parcours et limites

- Les nouveaux dépôts de la bibliothèque Wallet demandent la détection. Une cible explicitement choisie (pièce d’identité, autorisation ou Admin) et les documents existants conservent leur attribution. Aucun retraitement payant d’anciens documents.
- Comparaison exacte du prénom normalisé (casse, accents et espaces), sans deviner un surnom ou découper un prénom composé. La date peut départager les homonymes ; une contradiction reste à résoudre. Sans prénom exploitable, sujet ambigu ou société, demander un choix sans attribuer les données au titulaire par défaut.
- Une nouvelle personne reprend uniquement les valeurs valides extraites. Les champs existants ne sont jamais écrasés ; origine et dates conservées. Le plafond existant de cinquante dossiers est respecté. Les créations, rattachements et enrichissements sont transactionnels sous verrou propriétaire ; les retries/concurrences ne créent pas de doublons.
- Un document non attribué conserve son original et son extraction ; aucune comparaison, action de données ou synchronisation ne vise arbitrairement le titulaire. Choix explicite du profil dans le détail avec contrôle propriétaire, révision et idempotence. Les documents de tous les profils restent visibles dans Documents via une portée additive ; les listes antérieures et Admin restent ciblées.

## Contrôles et oracles

G-02/G-03/G-10, DATA-02/03/07 et CTR-02 : migration additive, contrats compatibles, frontières publiques profiles/identity, aucune nouvelle dépendance. Tests PostgreSQL isolés : correspondance titulaire/personne, date/homonymes, création/enrichissement, non-écrasement, isolation, concurrence/rejeu, sélection manuelle, absence d’actions tant que non attribué et visibilité en bibliothèque. Types/lint/build/frontières ; recette UI en lecture seule. Aucun upload factice, enrichissement, déplacement ou appel IA sur le compte réel pour tester.

Journal : `roadmap/evidence/document-profile-detection.md`. Hors périmètre : fusion de profils, identité/KYC, parenté, création de société déduite du prénom, déplacement d’une pièce déjà liée à une signature. Session GPT-6 ; effort effectif non exposé.
